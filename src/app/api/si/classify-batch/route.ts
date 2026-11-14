import { NextRequest, NextResponse } from 'next/server'
import { classifySpendLine, modelNeedsReview } from '@/lib/spend-assessment'
import { taxonomyFromRules } from '@/lib/spend-taxonomy'
import { requireSpendAccess } from '@/lib/spend-access'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const access = await requireSpendAccess('analyst')
    if (!access.ok) return access.response
    const { supabase, profile } = access

    const body = await request.json().catch(() => ({}))
    const uploadId = body?.upload_id
    if (!uploadId || typeof uploadId !== 'string') {
      return NextResponse.json({ error: 'upload_id requerido' }, { status: 400 })
    }

    const lineIds = Array.isArray(body?.line_ids)
      ? body.line_ids.filter((id: unknown) => typeof id === 'string').slice(0, 200)
      : null

    let query = supabase
      .from('si_spend_lines')
      .select('id, description, supplier_name')
      .eq('upload_id', uploadId)
      .eq('company_id', profile.company_id)

    if (lineIds) {
      if (!lineIds.length) {
        return NextResponse.json({
          success: true,
          classified_count: 0,
          pending_count: 0,
          external_ai: false,
          message: 'No hay líneas dentro del corte.',
        })
      }
      query = query.in('id', lineIds).is('category', null)
    } else {
      query = query.or('category.is.null,needs_review.eq.true').limit(500)
    }

    const { data: lines, error: linesError } = await query

    if (linesError) throw linesError
    if (!lines || lines.length === 0) {
      return NextResponse.json({
        success: true,
        classified_count: 0,
        pending_count: 0,
        external_ai: false,
        message: 'No hay líneas pendientes. No se envió gasto a un modelo externo.',
      })
    }

    const { data: rules } = await supabase
      .from('si_learning_rules')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('success_rate', { ascending: false })
      .limit(400)

    const nodes = taxonomyFromRules(rules || [])
    let classified_count = 0
    let pending_count = 0
    let model_count = 0

    for (const line of lines) {
      const remembered = await classifySpendLine(line.description, line.supplier_name, rules || [], nodes)
      if (!remembered) {
        pending_count++
        continue
      }
      if (remembered.source === 'modelo') model_count++
      const needs_review = remembered.source === 'modelo' && modelNeedsReview(remembered.confidence)
      const { error: updateError } = await supabase
        .from('si_spend_lines')
        .update({
          category: remembered.category,
          subcategory: remembered.subcategory,
          ai_confidence: remembered.confidence,
          ai_justification: remembered.justification,
          needs_review,
        })
        .eq('id', line.id)
        .eq('company_id', profile.company_id)
      if (updateError) throw updateError
      classified_count++
    }

    const { count } = await supabase
      .from('si_spend_lines')
      .select('id', { count: 'exact', head: true })
      .eq('upload_id', uploadId)
      .eq('company_id', profile.company_id)
      .eq('needs_review', true)

    await supabase
      .from('si_uploads')
      .update({ status: (count || 0) === 0 ? 'classified' : 'processing' })
      .eq('id', uploadId)
      .eq('company_id', profile.company_id)

    return NextResponse.json({
      success: true,
      classified_count,
      pending_count: count || pending_count,
      external_ai: false,
      message: `Se aplicaron reglas y el modelo propio a ${classified_count} líneas (${model_count} por el modelo). ${count || pending_count} quedan para revisión. No se envió gasto a un modelo externo.`,
    })
  } catch {
    console.error('Error in SI local classification')
    return NextResponse.json({ error: 'No se pudieron aplicar las reglas internas' }, { status: 500 })
  }
}
