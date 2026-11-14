import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { hasRole, type Profile } from '@/lib/auth-helpers'
import { SPEND_ROLE_DENIED } from '@/lib/spend-privacy'

export const runtime = 'nodejs'

async function companyContext() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_id, role')
    .eq('id', session.user.id)
    .single()
  if (!profile?.company_id) return { error: NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 }) }
  if (!hasRole(profile as Profile, 'analyst')) {
    return { error: NextResponse.json({ error: SPEND_ROLE_DENIED }, { status: 403 }) }
  }
  return { supabase, profile }
}

export async function GET() {
  const ctx = await companyContext()
  if ('error' in ctx && ctx.error) return ctx.error
  const { supabase, profile } = ctx as Exclude<Awaited<ReturnType<typeof companyContext>>, { error: NextResponse }>
  const { data, error } = await supabase
    .from('si_learning_rules')
    .select('id, rule_type, pattern, category, subcategory, source, success_rate')
    .eq('company_id', profile.company_id)
    .in('rule_type', ['taxonomy', 'synonym', 'supplier', 'keyword'])
    .order('category')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rules: data || [] })
}

export async function POST(request: NextRequest) {
  const ctx = await companyContext()
  if ('error' in ctx && ctx.error) return ctx.error
  const { supabase, profile } = ctx as Exclude<Awaited<ReturnType<typeof companyContext>>, { error: NextResponse }>
  const body = await request.json()
  const family = String(body.family || '').trim()
  const name = String(body.name || '').trim()

  if (body.op === 'delete') {
    const { error } = await supabase
      .from('si_learning_rules')
      .delete()
      .eq('id', body.id)
      .eq('company_id', profile.company_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (!family || !name) {
    return NextResponse.json({ error: 'Familia y subcategoría son obligatorias' }, { status: 400 })
  }

  const row = body.op === 'synonym'
    ? {
        company_id: profile.company_id,
        rule_type: 'synonym',
        pattern: String(body.synonym || '').trim().toLowerCase(),
        category: family,
        subcategory: name,
        confidence_boost: 0.15,
        source: 'manual',
        usage_count: 0,
        success_rate: 1,
        created_by: profile.id,
      }
    : {
        company_id: profile.company_id,
        rule_type: 'taxonomy',
        pattern: String(body.code || name).trim(),
        category: family,
        subcategory: name,
        confidence_boost: 0.2,
        source: 'manual',
        usage_count: 0,
        success_rate: 1,
        created_by: profile.id,
      }

  if (body.op === 'synonym' && row.pattern.length < 3) {
    return NextResponse.json({ error: 'El sinónimo necesita al menos 3 letras' }, { status: 400 })
  }

  const { error } = await supabase.from('si_learning_rules').insert(row)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
