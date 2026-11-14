import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { hasRole, type Profile } from '@/lib/auth-helpers'
import { EXTERNAL_AI_DISABLED, externalAiAllowed, SPEND_ROLE_DENIED } from '@/lib/spend-privacy'

type SpendRole = 'analyst' | 'manager' | 'admin'

export const SUPABASE_PROJECT_MISMATCH =
  'La URL de Supabase y las llaves son de proyectos distintos. No se leyó ni se envió información.'

export function supabaseProjectsMatch() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  try {
    const urlRef = new URL(url).hostname.split('.')[0]
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()) as { ref?: string }
    return Boolean(urlRef && payload.ref && urlRef === payload.ref)
  } catch {
    return false
  }
}

export async function requireSpendAccess(minimum: SpendRole) {
  if (!supabaseProjectsMatch()) {
    return { ok: false as const, response: NextResponse.json({ error: SUPABASE_PROJECT_MISMATCH }, { status: 503 }) }
  }
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return { ok: false as const, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_id, role')
    .eq('id', session.user.id)
    .single()

  if (!profile?.company_id) {
    return { ok: false as const, response: NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 }) }
  }

  if (!hasRole(profile as Profile, minimum)) {
    return { ok: false as const, response: NextResponse.json({ error: SPEND_ROLE_DENIED }, { status: 403 }) }
  }

  const { data: company } = await supabase
    .from('companies')
    .select('settings')
    .eq('id', profile.company_id)
    .single()

  return {
    ok: true as const,
    supabase,
    profile,
    settings: company?.settings || {},
  }
}

export async function rejectIfExternalAiOff(supabase: { auth: { getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }> }; from: (table: string) => any }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', session.user.id)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }

  const { data: company } = await supabase
    .from('companies')
    .select('settings')
    .eq('id', profile.company_id)
    .single()

  if (!externalAiAllowed(company?.settings)) {
    return NextResponse.json({ error: EXTERNAL_AI_DISABLED }, { status: 403 })
  }

  return null
}

export async function requireExternalAi(minimum: SpendRole = 'analyst') {
  const access = await requireSpendAccess(minimum)
  if (!access.ok) return access
  if (!externalAiAllowed(access.settings)) {
    return { ok: false as const, response: NextResponse.json({ error: EXTERNAL_AI_DISABLED }, { status: 403 }) }
  }
  return access
}

export async function recordExternalAiCall(
  supabase: { from: (table: string) => any },
  row: { company_id: string; user_id: string; outcome: 'sent' | 'blocked'; block_reason?: string | null; model: string; payload_chars: number }
) {
  const { error } = await supabase.from('si_ai_calls').insert({
    company_id: row.company_id,
    user_id: row.user_id,
    line_id: null,
    outcome: row.outcome,
    block_reason: row.block_reason || null,
    model: row.model,
    payload_chars: row.payload_chars,
  })
  return !error
}

export async function purgeExpiredSpend(
  supabase: { from: (table: string) => any },
  companyId: string
) {
  const { data, error } = await supabase
    .from('si_uploads')
    .delete()
    .eq('company_id', companyId)
    .lt('retain_until', new Date().toISOString())
    .select('id')

  if (error) return { deleted: 0 }
  return { deleted: data?.length || 0 }
}
