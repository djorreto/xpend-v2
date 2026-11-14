import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

export const PROCESS_ACTIONS = [
  'technical_closed',
  'publish',
  'award',
  'family_confirmed',
  'spend_closed',
  'acta',
  'performance',
] as const

export type ProcessAction = (typeof PROCESS_ACTIONS)[number]

export type ProcessEvent = {
  id: string
  action: string
  metadata: Record<string, unknown>
  performed_by: string | null
  performed_at: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function appendProcessEvent(input: {
  companyId: string
  actorId: string
  action: ProcessAction
  licitacionId?: string | null
  planId?: string | null
  payload?: Record<string, unknown>
}) {
  if (!supabaseAdmin) return { error: 'Falta la service role' as string | null }
  const { error } = await supabaseAdmin.from('rfx_audit_log').insert({
    entity_type: 'process',
    entity_id: input.planId && UUID.test(input.planId) ? input.planId : randomUUID(),
    action: input.action,
    metadata: {
      company_id: input.companyId,
      licitacion_id: input.licitacionId || null,
      plan_id: input.planId || null,
      ...(input.payload || {}),
    },
    performed_by: input.actorId,
  })
  return { error: error?.message || null }
}

export async function listProcessEvents(companyId: string) {
  if (!supabaseAdmin) return [] as ProcessEvent[]
  const { data, error } = await supabaseAdmin
    .from('rfx_audit_log')
    .select('id, action, metadata, performed_by, performed_at')
    .eq('entity_type', 'process')
    .contains('metadata', { company_id: companyId })
    .order('performed_at', { ascending: false })
    .limit(300)
  if (error || !data) return [] as ProcessEvent[]
  return data as ProcessEvent[]
}
