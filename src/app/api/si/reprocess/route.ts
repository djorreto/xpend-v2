import { NextRequest, NextResponse } from 'next/server'
import { requireSpendAccess } from '@/lib/spend-access'

export const runtime = 'nodejs'
export const maxDuration = 60

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

    const { data: upload } = await supabase
      .from('si_uploads')
      .select('id, group_id')
      .eq('id', uploadId)
      .eq('company_id', profile.company_id)
      .limit(1)
    if (!upload?.length) {
      return NextResponse.json({ error: 'No se encontró la carga' }, { status: 404 })
    }

    const { error: linesError } = await supabase
      .from('si_spend_lines')
      .update({
        category: null,
        subcategory: null,
        ai_confidence: null,
        ai_justification: null,
        reviewed_by: null,
        reviewed_at: null,
        needs_review: true,
      })
      .eq('upload_id', uploadId)
      .eq('company_id', profile.company_id)
    if (linesError) throw linesError

    const { data: plans } = await supabase
      .from('si_procurement_plans')
      .select('id')
      .eq('upload_id', uploadId)
      .eq('company_id', profile.company_id)

    const planIds = (plans || []).map(plan => plan.id)
    if (planIds.length) {
      const { error: itemsError } = await supabase
        .from('si_plan_items')
        .delete()
        .in('plan_id', planIds)
      if (itemsError) throw itemsError
      const { error: plansError } = await supabase
        .from('si_procurement_plans')
        .delete()
        .in('id', planIds)
        .eq('company_id', profile.company_id)
      if (plansError) throw plansError
    }
    if (upload[0].group_id) {
      await supabase
        .from('si_procurement_plans')
        .update({ stale: true })
        .eq('group_id', upload[0].group_id)
        .eq('company_id', profile.company_id)
    }

    const { error: statusError } = await supabase
      .from('si_uploads')
      .update({ status: 'processing' })
      .eq('id', uploadId)
      .eq('company_id', profile.company_id)
    if (statusError) throw statusError

    return NextResponse.json({
      success: true,
      message: 'Se borraron las categorías, Kraljic y el plan. Las líneas siguen cargadas. Hay que clasificar de nuevo.',
    })
  } catch {
    console.error('Error reprocessing SI upload')
    return NextResponse.json({ error: 'No se pudo reprocesar la carga' }, { status: 500 })
  }
}
