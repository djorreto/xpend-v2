import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { appendProcessEvent } from '@/lib/process-log'
import { hasRole, type Profile } from '@/lib/auth-helpers'
import { SPEND_ROLE_DENIED } from '@/lib/spend-privacy'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, company_id, role')
      .eq('id', session.user.id)
      .single()
    if (!profile?.company_id) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    if (!hasRole(profile as Profile, 'analyst')) {
      return NextResponse.json({ error: SPEND_ROLE_DENIED }, { status: 403 })
    }

    const body = await request.json()
    const supplier = String(body.supplier || '').trim()
    const currency = String(body.currency || '').trim()
    let lineIds: string[] = Array.isArray(body.line_ids) ? body.line_ids : []

    if (supplier && currency) {
      const { data: openLines, error: openError } = await supabase
        .from('si_spend_lines')
        .select('id')
        .eq('company_id', profile.company_id)
        .eq('supplier_name', supplier)
        .eq('currency', currency)
        .or('category.is.null,needs_review.eq.true')
        .limit(2000)
      if (openError) throw openError
      if (openLines?.length) lineIds = openLines.map(row => row.id)
    }

    lineIds = lineIds.slice(0, 2000)
    if (!lineIds.length) return NextResponse.json({ error: 'No hay líneas abiertas en este grupo' }, { status: 400 })

    const confirmOnly = body.confirm === true
    const category = String(body.category || '').trim()
    const subcategory = String(body.subcategory || '').trim() || null
    if (!confirmOnly && !category) {
      return NextResponse.json({ error: 'Elige una familia' }, { status: 400 })
    }

    for (let index = 0; index < lineIds.length; index += 200) {
      const chunk = lineIds.slice(index, index + 200)
      const patch = confirmOnly
        ? { needs_review: false, reviewed_by: profile.id, reviewed_at: new Date().toISOString() }
        : {
            category,
            subcategory,
            ai_confidence: 1,
            needs_review: false,
            ai_justification: 'Validado en grupo por el analista.',
            reviewed_by: profile.id,
            reviewed_at: new Date().toISOString(),
          }
      const { error } = await supabase
        .from('si_spend_lines')
        .update(patch)
        .in('id', chunk)
        .eq('company_id', profile.company_id)
      if (error) throw error
    }

    if (!confirmOnly && supplier && supplier.toLowerCase() !== 'sin proveedor') {
      const pattern = supplier.toLowerCase()
      const { data: existing } = await supabase
        .from('si_learning_rules')
        .select('id, usage_count')
        .eq('company_id', profile.company_id)
        .eq('rule_type', 'supplier')
        .eq('pattern', pattern)
        .maybeSingle()
      if (existing) {
        await supabase.from('si_learning_rules').update({
          category,
          subcategory,
          usage_count: (existing.usage_count || 0) + lineIds.length,
          success_rate: 1,
        }).eq('id', existing.id)
      } else {
        await supabase.from('si_learning_rules').insert({
          company_id: profile.company_id,
          rule_type: 'supplier',
          pattern,
          category,
          subcategory,
          confidence_boost: 0.2,
          source: 'user_correction',
          usage_count: lineIds.length,
          success_rate: 1,
          created_by: profile.id,
        })
      }
    }

    const synonym = String(body.synonym || '').trim().toLowerCase()
    if (!confirmOnly && synonym.length >= 4 && category) {
      await supabase.from('si_learning_rules').insert({
        company_id: profile.company_id,
        rule_type: 'synonym',
        pattern: synonym,
        category,
        subcategory,
        confidence_boost: 0.15,
        source: 'user_correction',
        usage_count: 1,
        success_rate: 1,
        created_by: profile.id,
      })
    }

    await appendProcessEvent({
      companyId: profile.company_id,
      actorId: profile.id,
      action: 'family_confirmed',
      payload: {
        supplier,
        currency,
        category: category || null,
        lines: lineIds.length,
        samples: Array.isArray(body.samples) ? body.samples.slice(0, 5) : [],
      },
    })

    return NextResponse.json({ ok: true, lines: lineIds.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo validar el grupo'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
