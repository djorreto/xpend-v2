import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { hasRole, type Profile } from '@/lib/auth-helpers'
import { purgeExpiredSpend } from '@/lib/spend-access'
import { retainUntilFromSettings, SPEND_ROLE_DENIED } from '@/lib/spend-privacy'
import {
  countryName,
  matchCountry,
  netFromGross,
  normalizeMoneyCode,
  parseRate,
  parseRateMap,
  referenceFor,
} from '@/lib/spend-basis'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutos

const MAX_FILE_BYTES = 80 * 1024 * 1024 // 80 MB
const MAX_ROWS = 200_000
const INSERT_BATCH = 750

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // 1. Autenticación
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 2. Obtener perfil y company_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, company_id, role')
      .eq('id', session.user.id)
      .single()

    if (!profile?.company_id) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    if (!hasRole(profile as Profile, 'manager')) {
      return NextResponse.json({ error: SPEND_ROLE_DENIED }, { status: 403 })
    }

    const { data: company } = await supabase
      .from('companies')
      .select('settings')
      .eq('id', profile.company_id)
      .single()

    await purgeExpiredSpend(supabase, profile.company_id)

    // 3. Obtener archivo del form
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `Archivo demasiado grande. Máximo ${MAX_FILE_BYTES / (1024 * 1024)} MB.` },
        { status: 400 }
      )
    }

    const sheetNameParam = (formData.get('sheet_name') as string | null)?.trim() || null

    // 4. Leer archivo (Excel o CSV)
    const buffer = await file.arrayBuffer()
    let rows: any[] = []
    let columns: string[] = []
    let sheetUsed: string | null = null
    let availableSheets: string[] = []

    if (file.name.endsWith('.csv')) {
      const text = new TextDecoder().decode(buffer)
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
      rows = parsed.data as any[]
      columns = parsed.meta.fields || []
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      availableSheets = workbook.SheetNames || []
      const pick =
        sheetNameParam && availableSheets.includes(sheetNameParam)
          ? sheetNameParam
          : availableSheets[0]
      sheetUsed = pick || null
      if (!pick) {
        return NextResponse.json({ error: 'El libro Excel no tiene hojas legibles.' }, { status: 400 })
      }
      const sheet = workbook.Sheets[pick]
      rows = XLSX.utils.sheet_to_json(sheet)

      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + '1'
        columns.push(sheet[address]?.v != null ? String(sheet[address].v) : `Column_${C}`)
      }
    } else {
      return NextResponse.json({ error: 'Formato no soportado. Use CSV o Excel (.xlsx, .xls).' }, { status: 400 })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        {
          error: `El archivo supera el máximo de ${MAX_ROWS.toLocaleString()} filas. Divide el archivo o contacta soporte.`,
        },
        { status: 400 }
      )
    }

    const detected = detectColumns(columns, rows[0] || {})
    const clientMapping = parseMapping(formData.get('mapping'))
    const columnMapping: Record<string, string> = {
      ...detected,
      ...clientMapping,
      ...(sheetUsed ? { sheet_used: sheetUsed } : {}),
    }
    const stats = tallyRows(rows, columnMapping)

    if (formData.get('preview') === '1') {
      return NextResponse.json({
        preview: true,
        columns,
        column_mapping: columnMapping,
        total_rows: rows.length,
        sheet_used: sheetUsed,
        available_sheets: availableSheets.length ? availableSheets : undefined,
        stats,
      })
    }

    if (!columnMapping.description || !columnMapping.amount) {
      return NextResponse.json({
        error: 'Falta mapear descripción y monto.',
        columns,
        column_mapping: columnMapping,
        stats,
      }, { status: 400 })
    }

    const decision = parseDecision(formData.get('decisions'))
    const resolved = resolveLoad(rows, columnMapping, decision, stats)
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error, columns, column_mapping: columnMapping, stats }, { status: 400 })
    }

    let groupId = resolved.groupId
    const newGroupName = String(decision.new_group_name || '').trim()
    if (newGroupName) {
      const { data: group, error: groupError } = await supabase
        .from('si_spend_groups')
        .insert({
          company_id: profile.company_id,
          name: newGroupName,
          display_currency: resolved.uploadPatch.display_currency,
          created_by: profile.id,
        })
        .select('id')
        .single()
      if (groupError || !group) {
        return NextResponse.json({
          error: groupError && /unique|duplicate/i.test(groupError.message) ? 'Ya existe un grupo con ese nombre.' : 'No se pudo crear el grupo.',
        }, { status: 400 })
      }
      groupId = group.id
    }

    // 6. Crear registro de upload
    const uploadRow = {
      company_id: profile.company_id,
      user_id: profile.id,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type || 'application/octet-stream',
      total_rows: rows.length,
      processed_rows: 0,
      status: 'uploaded',
      column_mapping: columnMapping,
      retain_until: retainUntilFromSettings(company?.settings),
      group_id: groupId,
      ...resolved.uploadPatch,
    }

    let { data: upload, error: uploadError } = await supabase
      .from('si_uploads')
      .insert(uploadRow)
      .select()
      .single()

    if (uploadError && /retain_until/.test(uploadError.message || '')) {
      const { retain_until: _ignored, ...legacyRow } = uploadRow
      const retry = await supabase.from('si_uploads').insert(legacyRow).select().single()
      upload = retry.data
      uploadError = retry.error
    }

    if (uploadError) throw uploadError

    const spendLines = resolved.lines.map((line, index) => ({
      ...line,
      upload_id: upload.id,
      company_id: profile.company_id,
      line_number: index + 1,
      needs_review: true,
    }))

    for (let i = 0; i < spendLines.length; i += INSERT_BATCH) {
      const chunk = spendLines.slice(i, i + INSERT_BATCH)
      const { error: linesError } = await supabase.from('si_spend_lines').insert(chunk)
      if (linesError) throw linesError
    }

    await supabase
      .from('si_uploads')
      .update({ processed_rows: spendLines.length, status: 'processing' })
      .eq('id', upload.id)

    await supabase.from('si_spend_decisions').insert({
      company_id: profile.company_id,
      upload_id: upload.id,
      group_id: groupId,
      created_by: profile.id,
      snapshot: resolved.snapshot,
    })

    return NextResponse.json({
      success: true,
      upload_id: upload.id,
      total_rows: rows.length,
      processed_rows: spendLines.length,
      column_mapping: columnMapping,
      columns,
      sheet_used: sheetUsed,
      available_sheets: availableSheets.length ? availableSheets : undefined,
      summary: resolved.snapshot,
      message: `Se importaron ${spendLines.length.toLocaleString()} líneas en neto.`,
    })

  } catch {
    console.error('Error in SI upload')
    return NextResponse.json({ error: 'No se pudo importar el archivo' }, { status: 500 })
  }
}

// Función para detectar columnas automáticamente
function detectColumns(columns: string[], sampleRow: any): Record<string, string> {
  const mapping: Record<string, string> = {}

  columns.forEach(col => {
    const lowerCol = col.toLowerCase().trim()

    // Detectar descripción
    if (!mapping.description && (
      lowerCol.includes('descri') ||
      lowerCol.includes('detalle') ||
      lowerCol.includes('item') ||
      lowerCol.includes('producto') ||
      lowerCol.includes('servicio')
    )) {
      mapping.description = col
    }
    // Detectar proveedor
    else if (!mapping.supplier_name && (
      lowerCol.includes('prove') ||
      lowerCol.includes('supplier') ||
      lowerCol.includes('vendor') ||
      lowerCol.includes('vendedor')
    )) {
      mapping.supplier_name = col
    }
    // Detectar monto
    else if (!mapping.amount && (
      lowerCol.includes('monto') ||
      lowerCol.includes('amount') ||
      lowerCol.includes('total') ||
      lowerCol.includes('precio') ||
      lowerCol.includes('valor') ||
      lowerCol.includes('importe')
    )) {
      mapping.amount = col
    }
    // Detectar OC
    else if (!mapping.purchase_order && (
      lowerCol.includes('oc') ||
      lowerCol.includes('orden') ||
      lowerCol.includes('po') ||
      lowerCol.includes('purchase')
    )) {
      mapping.purchase_order = col
    }
    // Detectar moneda
    else if (!mapping.currency && (
      lowerCol.includes('moneda') ||
      lowerCol.includes('currency') ||
      lowerCol.includes('coin')
    )) {
      mapping.currency = col
    }
    // Detectar centro de costo
    else if (!mapping.cost_center && (
      lowerCol.includes('centro') ||
      lowerCol.includes('cost center') ||
      lowerCol.includes('cc') ||
      lowerCol.includes('ceco')
    )) {
      mapping.cost_center = col
    }
    // Detectar fecha
    else if (!mapping.purchase_date && (
      lowerCol.includes('fecha') ||
      lowerCol.includes('date') ||
      lowerCol.includes('dia')
    )) {
      mapping.purchase_date = col
    }
    // Detectar país
    else if (!mapping.country && (
      lowerCol.includes('país') ||
      lowerCol.includes('pais') ||
      lowerCol.includes('country')
    )) {
      mapping.country = col
    }
  })

  // Asegurar que al menos descripción y monto estén mapeados (fallback)
  if (!mapping.description && columns.length > 0) {
    // Buscar la columna con textos más largos
    const longestTextCol = columns[0] // Por defecto la primera
    mapping.description = longestTextCol
  }

  if (!mapping.amount && columns.length > 1) {
    // Buscar la columna con números
    const numericCol = columns.find(col => {
      const value = sampleRow[col]
      return !isNaN(parseFloat(String(value).replace(/[^0-9.-]/g, '')))
    }) || columns[1]
    mapping.amount = numericCol
  }

  return mapping
}

// Función para normalizar fechas de diferentes formatos
function normalizeDate(dateValue: any): string | null {
  if (!dateValue) return null

  try {
    // Si ya es un objeto Date
    if (dateValue instanceof Date) {
      return dateValue.toISOString().split('T')[0]
    }

    const dateStr = String(dateValue).trim()

    // Si está vacío
    if (!dateStr) return null

    // Si ya está en formato ISO (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr
    }

    // Intentar parsear diferentes formatos comunes
    let day: number, month: number, year: number

    // Formato: DD-MM-YY o DD/MM/YY
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2}$/.test(dateStr)) {
      const parts = dateStr.split(/[-/]/)
      day = parseInt(parts[0])
      month = parseInt(parts[1])
      year = parseInt(parts[2])
      // Convertir año de 2 dígitos a 4 dígitos
      year = year < 50 ? 2000 + year : 1900 + year
    }
    // Formato: DD-MM-YYYY o DD/MM/YYYY
    else if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(dateStr)) {
      const parts = dateStr.split(/[-/]/)
      day = parseInt(parts[0])
      month = parseInt(parts[1])
      year = parseInt(parts[2])
    }
    // Formato: YYYY-MM-DD o YYYY/MM/DD
    else if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(dateStr)) {
      const parts = dateStr.split(/[-/]/)
      year = parseInt(parts[0])
      month = parseInt(parts[1])
      day = parseInt(parts[2])
    }
    // Formato numérico de Excel (días desde 1900-01-01)
    else if (/^\d{5}$/.test(dateStr)) {
      const excelDate = parseInt(dateStr)
      const date = new Date((excelDate - 25569) * 86400 * 1000)
      return date.toISOString().split('T')[0]
    }
    // Intentar parsear con Date (último recurso)
    else {
      const parsed = new Date(dateStr)
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0]
      }
      return null
    }

    // Validar fecha
    if (isNaN(day) || isNaN(month) || isNaN(year) ||
        day < 1 || day > 31 || month < 1 || month > 12 ||
        year < 1900 || year > 2100) {
      return null
    }

    // Formatear como YYYY-MM-DD
    const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    // Validar que la fecha sea válida
    const testDate = new Date(formattedDate)
    if (isNaN(testDate.getTime())) {
      return null
    }

    return formattedDate
  } catch (error) {
    console.error('Error normalizing date')
    return null
  }
}

function parseMapping(raw: FormDataEntryValue | null) {
  if (typeof raw !== 'string' || !raw.trim()) return {}
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    const mapping: Record<string, string> = {}
    for (const key of ['description', 'amount', 'supplier_name', 'purchase_order', 'currency', 'cost_center', 'purchase_date', 'country']) {
      const column = value[key]
      if (typeof column === 'string' && column.trim()) mapping[key] = column.trim()
    }
    return mapping
  } catch {
    return {}
  }
}

function parseDecision(raw: FormDataEntryValue | null) {
  if (typeof raw !== 'string' || !raw.trim()) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function cellAmount(value: unknown) {
  const amount = parseFloat(String(value ?? '0').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(amount) ? amount : 0
}

function tallyRows(rows: any[], mapping: Record<string, string>) {
  const currencies = new Map<string, number>()
  const countries = new Map<string, number>()
  let dated = 0
  let min: string | null = null
  let max: string | null = null
  let blankCurrency = 0
  let unknownCurrency = 0
  for (const row of rows) {
    if (mapping.currency) {
      const raw = row[mapping.currency]
      const code = normalizeMoneyCode(raw)
      if (raw == null || String(raw).trim() === '') blankCurrency += 1
      else if (!code) unknownCurrency += 1
      else currencies.set(code, (currencies.get(code) || 0) + 1)
    }
    if (mapping.country) {
      const code = matchCountry(row[mapping.country]) || 'sin-pais'
      countries.set(code, (countries.get(code) || 0) + 1)
    }
    if (mapping.purchase_date && row[mapping.purchase_date]) {
      const date = normalizeDate(row[mapping.purchase_date])
      if (date) {
        dated += 1
        if (!min || date < min) min = date
        if (!max || date > max) max = date
      }
    }
  }
  return {
    currencies: Array.from(currencies.entries()).map(([code, count]) => ({ code, count })),
    countries: Array.from(countries.entries()).map(([code, count]) => ({
      code,
      count,
      name: code === 'sin-pais' ? 'Sin país' : countryName(code),
    })),
    dated,
    min,
    max,
    blankCurrency,
    unknownCurrency,
    total: rows.length,
  }
}

function resolveLoad(
  rows: any[],
  mapping: Record<string, string>,
  decision: Record<string, unknown>,
  stats: ReturnType<typeof tallyRows>
) {
  const fallback = normalizeMoneyCode(decision.fallback_currency)
  if (!mapping.currency && !fallback) {
    return { error: 'El archivo no trae moneda. Elige la moneda de esta base.' }
  }
  if ((stats.blankCurrency > 0 || stats.unknownCurrency > 0 || stats.currencies.length === 0) && mapping.currency && !fallback) {
    return { error: 'Hay montos sin una moneda reconocible. Elige la moneda que les corresponde.' }
  }

  const fileCountries = stats.countries.map(item => item.code).filter(code => code !== 'sin-pais')
  const missingCountry = stats.countries.some(item => item.code === 'sin-pais')
  let countryMixed = false
  let countryCode: string | null = null
  if (mapping.country && fileCountries.length > 1) {
    if (missingCountry) return { error: 'Hay líneas sin país. Completa el país en el archivo o elige un país para toda la base y no mapees esa columna.' }
    countryMixed = true
  } else if (mapping.country && fileCountries.length === 1 && !missingCountry) {
    countryCode = fileCountries[0]
  } else {
    countryCode = matchCountry(decision.country_code)
    if (!countryCode) return { error: 'Indica de qué país es esta base de gasto.' }
  }

  const taxBasis = decision.tax_basis === 'gross' ? 'gross' : decision.tax_basis === 'net' ? 'net' : null
  if (!taxBasis) return { error: 'Indica si los montos vienen sin impuesto o con impuesto.' }
  if (!stats.dated && decision.acknowledge_no_date !== true) {
    return { error: 'Esta base no tiene fecha. Confírmalo para cargarla sin año móvil ni gráfico.' }
  }

  const taxRates = parseRateMap(decision.tax_rates)
  let taxRate: number | null = null
  let taxKind: 'official' | 'custom' | 'none' = 'none'
  if (taxBasis === 'gross' && !countryMixed) {
    taxRate = parseRate(decision.tax_rate)
    if (taxRate == null) return { error: 'Escribe el porcentaje de impuesto para dejar el gasto en neto.' }
    const official = referenceFor(countryCode)?.rate
    taxKind = official != null && official === taxRate ? 'official' : 'custom'
  }
  if (taxBasis === 'gross' && countryMixed) {
    for (const code of fileCountries) {
      if (taxRates[code] == null) return { error: `Falta la tasa de impuesto de ${countryName(code)}.` }
    }
    taxKind = decision.tax_rate_kind === 'custom' ? 'custom' : 'official'
  }

  const display = normalizeMoneyCode(decision.display_currency) || fallback || stats.currencies[0]?.code || null
  const lines = rows.map(row => {
    const amount = cellAmount(row[mapping.amount])
    const lineCountry = countryMixed ? matchCountry(row[mapping.country]) : countryCode
    const rate = taxBasis === 'net' ? 0 : countryMixed ? taxRates[lineCountry || ''] : taxRate
    const amountNet = taxBasis === 'net' ? amount : netFromGross(amount, rate ?? -1)
    const rawCurrency = mapping.currency ? row[mapping.currency] : null
    const currency = normalizeMoneyCode(rawCurrency) || fallback
    return {
      description: String(row[mapping.description] || ''),
      supplier_name: mapping.supplier_name ? row[mapping.supplier_name] || null : null,
      amount,
      amount_net: amountNet,
      currency,
      country_code: lineCountry,
      tax_rate_applied: rate,
      purchase_order: mapping.purchase_order ? row[mapping.purchase_order] || null : null,
      cost_center: mapping.cost_center ? row[mapping.cost_center] || null : null,
      purchase_date: mapping.purchase_date ? normalizeDate(row[mapping.purchase_date]) : null,
    }
  })
  if (lines.some(line => line.amount_net == null || !line.currency)) {
    return { error: 'No se pudo dejar el gasto en neto. Revisa moneda y tasa.' }
  }

  const uploadPatch = {
    country_code: countryCode,
    country_mixed: countryMixed,
    tax_basis: taxBasis,
    tax_rate: taxRate,
    tax_rate_kind: taxKind,
    tax_rates: countryMixed ? taxRates : {},
    decisions_confirmed: true,
    has_dates: stats.dated > 0,
    display_currency: display,
    fx_mode: 'native',
    fx_rates: {},
    window_mode: 'all',
  }
  return {
    groupId: typeof decision.group_id === 'string' && decision.group_id ? decision.group_id : null,
    lines,
    uploadPatch,
    snapshot: {
      source: 'carga',
      ...uploadPatch,
      currencies: stats.currencies,
      dated: stats.dated,
      min: stats.min,
      max: stats.max,
    },
  }
}

