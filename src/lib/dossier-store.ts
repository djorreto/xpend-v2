import type { SupabaseClient } from '@supabase/supabase-js'

export type DossierStage = 'oportunidad' | 'iniciativa' | 'bases' | 'licitacion' | 'sala' | 'adjudicada'

export type DossierAward = {
  supplier_id?: string
  amount?: number
  savings_amount?: number | null
  savings_percentage?: number | null
}

export type Dossier = {
  id: string
  company_id: string
  title: string
  group_id?: string | null
  upload_id?: string | null
  sourcing_plan_id?: string | null
  rfx_project_id?: string | null
  licitacion_id?: string | null
  offer_event_id?: string | null
  currency?: string | null
  net_spend?: number | null
  country_code?: string | null
  stage: DossierStage
  bases_text?: string | null
  award?: DossierAward | null
}

export const DOSSIER_STEPS: { stage: DossierStage; label: string }[] = [
  { stage: 'oportunidad', label: 'Oportunidad' },
  { stage: 'iniciativa', label: 'Iniciativa' },
  { stage: 'bases', label: 'Bases' },
  { stage: 'licitacion', label: 'Licitación' },
  { stage: 'sala', label: 'Sala' },
  { stage: 'adjudicada', label: 'Adjudicación' },
]

const RANK: Record<DossierStage, number> = {
  oportunidad: 0,
  iniciativa: 1,
  bases: 2,
  licitacion: 3,
  sala: 4,
  adjudicada: 5,
}

export function advanceStage(current: DossierStage, next: DossierStage): DossierStage {
  return RANK[next] > RANK[current] ? next : current
}

export function canOpenOpportunity(uploads: { decisions_confirmed?: boolean | null }[]) {
  return uploads.some(upload => upload.decisions_confirmed === true)
}

export function pilotPathComplete(dossier: Partial<Dossier> | null | undefined) {
  if (!dossier) return false
  return Boolean(
    dossier.sourcing_plan_id
    && dossier.rfx_project_id
    && dossier.licitacion_id
    && dossier.offer_event_id
    && dossier.award
    && dossier.award.amount != null
    && dossier.net_spend != null
    && dossier.currency
  )
}

type Answer = { question: string; answer: string }

export function composeBases(input: {
  title: string
  technical: Answer[]
  administrative: Answer[]
}) {
  const block = (items: Answer[], empty: string) => {
    if (!items.length) return empty
    return items.map((item, index) => `## ${index + 1}. ${item.question}\n\n${item.answer.trim() || 'Por completar.'}`).join('\n\n')
  }
  const technical = [`# Base técnica`, ``, input.title, ``, block(input.technical, '## Alcance\n\nPor completar.')].join('\n')
  const administrative = [`# Base administrativa`, ``, input.title, ``, block(input.administrative, '## Condiciones\n\nPor completar.')].join('\n')
  return { technical, administrative, published: `${technical}\n\n${administrative}` }
}

export function publishedParagraph(bases: string, needle: string) {
  return bases.includes(needle)
}

type SaveInput = {
  companyId: string
  userId?: string | null
  title?: string
  groupId?: string | null
  uploadId?: string | null
  sourcingPlanId?: string | null
  rfxProjectId?: string | null
  licitacionId?: string | null
  offerEventId?: string | null
  currency?: string | null
  netSpend?: number | null
  countryCode?: string | null
  stage?: DossierStage
  basesText?: string | null
  award?: DossierAward | null
}

export async function saveDossier(supabase: SupabaseClient, input: SaveInput) {
  const filters = [
    input.sourcingPlanId ? `sourcing_plan_id.eq.${input.sourcingPlanId}` : '',
    input.rfxProjectId ? `rfx_project_id.eq.${input.rfxProjectId}` : '',
    input.licitacionId ? `licitacion_id.eq.${input.licitacionId}` : '',
    input.offerEventId ? `offer_event_id.eq.${input.offerEventId}` : '',
  ].filter(Boolean)

  let existing: Dossier | null = null
  if (filters.length) {
    const { data } = await supabase
      .from('procurement_dossiers')
      .select('*')
      .eq('company_id', input.companyId)
      .or(filters.join(','))
      .limit(1)
    existing = (data?.[0] as Dossier | undefined) || null
  }

  const stage = advanceStage(existing?.stage || 'oportunidad', input.stage || existing?.stage || 'oportunidad')
  const row = {
    company_id: input.companyId,
    title: input.title || existing?.title || 'Expediente',
    group_id: input.groupId ?? existing?.group_id ?? null,
    upload_id: input.uploadId ?? existing?.upload_id ?? null,
    sourcing_plan_id: input.sourcingPlanId ?? existing?.sourcing_plan_id ?? null,
    rfx_project_id: input.rfxProjectId ?? existing?.rfx_project_id ?? null,
    licitacion_id: input.licitacionId ?? existing?.licitacion_id ?? null,
    offer_event_id: input.offerEventId ?? existing?.offer_event_id ?? null,
    currency: input.currency ?? existing?.currency ?? null,
    net_spend: input.netSpend ?? existing?.net_spend ?? null,
    country_code: input.countryCode ?? existing?.country_code ?? null,
    stage,
    bases_text: input.basesText ?? existing?.bases_text ?? null,
    award: input.award ?? existing?.award ?? null,
    created_by: input.userId || null,
    updated_at: new Date().toISOString(),
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from('procurement_dossiers')
      .update(row)
      .eq('id', existing.id)
      .select('*')
      .limit(1)
    if (error) return null
    return (data?.[0] as Dossier) || null
  }

  const { data, error } = await supabase.from('procurement_dossiers').insert(row).select('*').limit(1)
  if (error) return null
  return (data?.[0] as Dossier) || null
}

export function dossierHref(dossier: Dossier, stage: DossierStage) {
  if (stage === 'oportunidad' && dossier.group_id) return `/sourcing-intelligence/grupo/${dossier.group_id}`
  if (stage === 'iniciativa' && dossier.sourcing_plan_id) return `/sourcing-plan/${dossier.sourcing_plan_id}`
  if (stage === 'bases' && dossier.rfx_project_id) return `/rfx-maker/${dossier.rfx_project_id}`
  if (stage === 'licitacion' && dossier.licitacion_id) return `/licitaciones/${dossier.licitacion_id}`
  if (stage === 'sala' && dossier.offer_event_id) return `/sala/${dossier.offer_event_id}`
  if (stage === 'adjudicada') return '/comite'
  return null
}
