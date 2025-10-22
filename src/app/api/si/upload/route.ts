import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutos

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

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    // 3. Obtener archivo del form
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    // Validar tamaño (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Archivo demasiado grande. Máximo 10MB.' }, { status: 400 })
    }

    // 4. Leer archivo (Excel o CSV)
    const buffer = await file.arrayBuffer()
    let rows: any[] = []
    let columns: string[] = []

    if (file.name.endsWith('.csv')) {
      // Procesar CSV
      const text = new TextDecoder().decode(buffer)
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
      rows = parsed.data
      columns = parsed.meta.fields || []
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      // Procesar Excel
      const workbook = XLSX.read(buffer)
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      rows = XLSX.utils.sheet_to_json(sheet)
      
      // Obtener nombres de columnas
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + '1'
        columns.push(sheet[address]?.v || `Column_${C}`)
      }
    } else {
      return NextResponse.json({ error: 'Formato no soportado. Use CSV o Excel (.xlsx, .xls).' }, { status: 400 })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
    }

    // 5. Detectar columnas automáticamente
    const columnMapping = detectColumns(columns, rows[0])

    // Validar que se detectaron columnas mínimas
    if (!columnMapping.description || !columnMapping.amount) {
      return NextResponse.json({ 
        error: 'No se pudieron detectar columnas de descripción y monto. Por favor mapee manualmente.',
        columns,
        detected: columnMapping
      }, { status: 400 })
    }

    // 6. Crear registro de upload
    const { data: upload, error: uploadError } = await supabase
      .from('si_uploads')
      .insert({
        company_id: profile.company_id,
        user_id: profile.id,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || 'application/octet-stream',
        total_rows: rows.length,
        processed_rows: 0,
        status: 'uploaded',
        column_mapping: columnMapping
      })
      .select()
      .single()

    if (uploadError) throw uploadError

    // 7. Insertar líneas de gasto (limitar a 5000 líneas)
    const maxRows = Math.min(rows.length, 5000)
    const spendLines = rows.slice(0, maxRows).map((row, index) => {
      const description = row[columnMapping.description] || ''
      const amountStr = String(row[columnMapping.amount] || '0').replace(/[^0-9.-]/g, '')
      const amount = parseFloat(amountStr) || 0

      return {
        upload_id: upload.id,
        company_id: profile.company_id,
        description,
        supplier_name: row[columnMapping.supplier_name] || null,
        amount,
        currency: row[columnMapping.currency] || 'USD',
        purchase_order: row[columnMapping.purchase_order] || null,
        line_number: index + 1,
        cost_center: row[columnMapping.cost_center] || null,
        purchase_date: row[columnMapping.purchase_date] || null,
        needs_review: true,
        raw_data: row
      }
    })

    const { error: linesError } = await supabase
      .from('si_spend_lines')
      .insert(spendLines)

    if (linesError) throw linesError

    // 8. Actualizar status
    await supabase
      .from('si_uploads')
      .update({ processed_rows: spendLines.length, status: 'processing' })
      .eq('id', upload.id)

    return NextResponse.json({
      success: true,
      upload_id: upload.id,
      total_rows: rows.length,
      processed_rows: spendLines.length,
      column_mapping: columnMapping,
      columns,
      message: rows.length > 5000 
        ? `Se procesaron las primeras 5,000 líneas de ${rows.length} totales.`
        : `Se procesaron ${spendLines.length} líneas correctamente.`
    })

  } catch (error: any) {
    console.error('Error in SI upload:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
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

