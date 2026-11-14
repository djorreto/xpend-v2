import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { requireSpendAccess } from '@/lib/spend-access'
import { inferClassificationSource, SOURCE_LABEL } from '@/lib/spend-flow'
import { modelInUseLabel } from '@/lib/spend-brain'

export const runtime = 'nodejs'
export const maxDuration = 60

type Line = {
  line_number: number | null
  description: string
  supplier_name: string | null
  amount: number
  amount_net?: number | null
  currency: string
  country_code?: string | null
  category: string | null
  subcategory: string | null
  ai_confidence: number | null
  ai_justification: string | null
  needs_review: boolean
  reviewed_at: string | null
  reviewed_by: string | null
}

function quadrantOf(impact: number, risk: number) {
  if (impact > 0.6 && risk > 0.6) return 'Estratégico'
  if (impact > 0.6) return 'Apalancable'
  if (risk > 0.6) return 'Cuello de botella'
  return 'No crítico'
}

export async function GET(request: NextRequest) {
  const access = await requireSpendAccess('analyst')
  if (!access.ok) return access.response
  const { supabase, profile } = access

  const uploadId = request.nextUrl.searchParams.get('upload_id')
  if (!uploadId) {
    return NextResponse.json({ error: 'upload_id requerido' }, { status: 400 })
  }

  const { data: upload, error: uploadError } = await supabase
    .from('si_uploads')
    .select('id, file_name, status, total_rows, processed_rows')
    .eq('id', uploadId)
    .eq('company_id', profile.company_id)
    .single()

  if (uploadError || !upload) {
    return NextResponse.json({ error: 'Carga no encontrada' }, { status: 404 })
  }

  const { data: lines } = await supabase
    .from('si_spend_lines')
    .select('line_number, description, supplier_name, amount, amount_net, currency, country_code, category, subcategory, ai_confidence, ai_justification, needs_review, reviewed_at, reviewed_by')
    .eq('upload_id', uploadId)
    .eq('company_id', profile.company_id)
    .order('line_number', { ascending: true })
    .limit(200000)

  const rows = (lines || []) as Line[]

  const lineSheet = rows.map(line => {
    const source = inferClassificationSource(line)
    return {
      Linea: line.line_number,
      Descripcion: line.description,
      Proveedor: line.supplier_name || '',
      Monto_original: line.amount,
      Monto_neto: line.amount_net ?? line.amount,
      Moneda: line.currency,
      Pais: line.country_code || '',
      Familia: line.category || '',
      Subcategoria: line.subcategory || '',
      Origen: SOURCE_LABEL[source],
      Confianza: line.ai_confidence == null ? '' : Math.round(line.ai_confidence * 100),
      Requiere_revision: line.needs_review ? 'si' : 'no',
      Justificacion: line.ai_justification || '',
    }
  })

  const byFamily = new Map<string, { family: string; currency: string; spend: number; lines: number; suppliers: Set<string>; supplierSpend: Map<string, number> }>()
  for (const line of rows) {
    const family = line.category || 'Sin categoría'
    const currency = line.currency || ''
    const key = `${family}||${currency}`
    const current = byFamily.get(key) || { family, currency, spend: 0, lines: 0, suppliers: new Set<string>(), supplierSpend: new Map<string, number>() }
    const amount = Number(line.amount_net ?? line.amount) || 0
    current.spend += amount
    current.lines += 1
    if (line.supplier_name) {
      current.suppliers.add(line.supplier_name)
      current.supplierSpend.set(line.supplier_name, (current.supplierSpend.get(line.supplier_name) || 0) + amount)
    }
    byFamily.set(key, current)
  }
  const familyRows = Array.from(byFamily.values())
    .map(value => ({
      Familia: value.family,
      Moneda: value.currency,
      Gasto_neto: value.spend,
      Lineas: value.lines,
      Proveedores: value.suppliers.size,
    }))
    .sort((a, b) => b.Gasto_neto - a.Gasto_neto)

  const { data: plans } = await supabase
    .from('si_procurement_plans')
    .select('id')
    .eq('upload_id', uploadId)
    .eq('company_id', profile.company_id)
    .limit(1)
  const plan = plans?.[0]

  const { data: planItems } = plan
    ? await supabase
        .from('si_plan_items')
        .select('category, total_spend, supplier_count, supplier_concentration, impact_score, risk_score, kraljic_quadrant')
        .eq('plan_id', plan.id)
    : { data: [] as Array<{ category: string; total_spend: number; supplier_count: number; supplier_concentration: number | null; impact_score: number | null; risk_score: number | null; kraljic_quadrant: string | null }> }

  const quadrantLabel: Record<string, string> = {
    strategic: 'Estratégico',
    leverage: 'Apalancable',
    bottleneck: 'Cuello de botella',
    non_critical: 'No crítico',
  }

  let kraljic
  if (planItems && planItems.length > 0) {
    kraljic = planItems.map(item => ({
      Familia: item.category,
      Gasto: item.total_spend,
      Proveedores: item.supplier_count,
      Concentracion: item.supplier_concentration == null ? '' : Number(item.supplier_concentration.toFixed(1)),
      Impacto: Number((item.impact_score || 0).toFixed(2)),
      Riesgo: Number((item.risk_score || 0).toFixed(2)),
      Cuadrante: quadrantLabel[item.kraljic_quadrant || ''] || item.kraljic_quadrant || '',
    }))
  } else {
    const maxSpend = Math.max(...familyRows.map(row => row.Gasto_neto), 1)
    const maxLines = Math.max(...familyRows.map(row => row.Lineas), 1)
    const maxSuppliers = Math.max(...familyRows.map(row => row.Proveedores), 1)
    kraljic = familyRows
      .filter(row => row.Familia !== 'Sin categoría')
      .map(row => {
        const bag = byFamily.get(`${row.Familia}||${row.Moneda}`)
        const suppliers = bag?.suppliers.size || 0
        let topShare = 0
        if (bag && bag.spend > 0) {
          bag.supplierSpend.forEach(value => {
            topShare = Math.max(topShare, value / bag.spend)
          })
        }
        const impact = (row.Gasto_neto / maxSpend) * 0.7 + (row.Lineas / maxLines) * 0.3
        const risk = topShare * 0.6 + (1 - suppliers / maxSuppliers) * 0.4
        return {
          Familia: row.Familia,
          Gasto: row.Gasto_neto,
          Moneda: row.Moneda,
          Proveedores: row.Proveedores,
          Concentracion: Number((topShare * 100).toFixed(1)),
          Impacto: Number(impact.toFixed(2)),
          Riesgo: Number(Math.min(risk, 1).toFixed(2)),
          Cuadrante: quadrantOf(impact, Math.min(risk, 1)),
        }
      })
  }

  const pending = lineSheet.filter(row => row.Requiere_revision === 'si')

  const notes = [
    { Nota: `Archivo: ${upload.file_name}` },
    { Nota: `Estado de la carga: ${upload.status}` },
    { Nota: `Filas: ${rows.length}` },
    { Nota: `Modelo en uso: ${modelInUseLabel()}` },
    { Nota: 'El monto y el proveedor van en esta descarga porque es el archivo del cliente. No se usaron para entrenar el modelo compartido.' },
    { Nota: 'Origen = de dónde salió la categoría: regla de la empresa, taxonomía, LLM, persona o pendiente.' },
    { Nota: 'Kraljic se calcula sobre las familias ya clasificadas. Sin categoría no entra al cuadrante.' },
    { Nota: 'Monto_neto es el gasto sin impuesto. Monto_original es el que vino en el archivo. El resumen no suma monedas distintas.' },
  ]

  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(lineSheet), 'Lineas')
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(familyRows), 'Resumen')
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(kraljic), 'Kraljic')
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(pending), 'Pendientes')
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(notes), 'Notas')

  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const filename = `gasto-clasificado-${upload.id.slice(0, 8)}.xlsx`
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
