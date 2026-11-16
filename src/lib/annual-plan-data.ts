import type { SupabaseClient } from '@supabase/supabase-js'
import { can } from './navigation.ts'
import {
  EMPTY_FACTS,
  autoBlocks,
  initiativeHealth,
  projectCascade,
  systemActuals,
  todayISO,
  viewMilestones,
  type InitiativeHealth,
  type MilestoneRow,
  type MilestoneView,
  type ProcessFacts,
  type RescheduleCause,
  type SnapshotLine,
} from './milestones.ts'

export type AnnualPlan = { id: string; plan_year: number; name: string | null; status: 'draft' | 'committed'; committed_at: string | null; committed_by: string | null }
export type AnnualLine = {
  id: string
  annual_plan_id: string
  category_id: string
  currency: string
  historical_spend: number | null
  target_amount: number | null
  owner_user_id: string | null
  priority: number
  notes: string | null
}
export type PlanChange = { id: string; line_id: string | null; change_kind: string; old_values: Record<string, unknown> | null; new_values: Record<string, unknown>; reason: string; changed_by: string | null; changed_at: string }

export type AnnualPlanBundle = {
  plan: AnnualPlan | null
  lines: AnnualLine[]
  snapshot: { taken_at: string; lines: SnapshotLine[] } | null
  changes: PlanChange[]
}

const num = (value: unknown) => (value == null ? null : Number(value))

export async function loadAnnualPlan(supabase: SupabaseClient, companyId: string, year: number): Promise<AnnualPlanBundle> {
  const { data: plan } = await supabase.from('annual_plans').select('id, plan_year, name, status, committed_at, committed_by').eq('company_id', companyId).eq('plan_year', year).maybeSingle()
  if (!plan) return { plan: null, lines: [], snapshot: null, changes: [] }
  const [lines, snapshot, changes] = await Promise.all([
    supabase.from('annual_plan_lines').select('id, annual_plan_id, category_id, currency, historical_spend, target_amount, owner_user_id, priority, notes').eq('annual_plan_id', plan.id),
    supabase.from('annual_plan_snapshots').select('taken_at, lines').eq('annual_plan_id', plan.id).maybeSingle(),
    supabase.from('annual_plan_changes').select('id, line_id, change_kind, old_values, new_values, reason, changed_by, changed_at').eq('annual_plan_id', plan.id).order('changed_at', { ascending: false }).limit(50),
  ])
  return {
    plan: plan as AnnualPlan,
    lines: ((lines.data || []) as AnnualLine[]).map(line => ({ ...line, historical_spend: num(line.historical_spend), target_amount: num(line.target_amount) })),
    snapshot: snapshot.data ? { taken_at: snapshot.data.taken_at, lines: (snapshot.data.lines || []) as SnapshotLine[] } : null,
    changes: (changes.data || []) as PlanChange[],
  }
}

export type InitiativeRow = {
  id: string
  title: string
  status: string | null
  plan_year: number
  quarter: string | null
  category: string | null
  category_id: string | null
  currency: string | null
  department_id: string | null
  responsible_user_id: string | null
  backup_user_id: string | null
  team_id: string | null
  projected_savings_amount: number | null
  estimated_spend: number | null
}

export type InitiativeSchedule = {
  initiative: InitiativeRow
  milestones: MilestoneView[]
  health: InitiativeHealth
  projection: ReturnType<typeof projectCascade>
  lastCause: Record<string, RescheduleCause | null>
  hasMilestones: boolean
}

type LicRow = {
  id: string
  status: string | null
  created_at: string | null
  publication_date: string | null
  publish_approved_at: string | null
  proposal_closing_date: string | null
  committee_date: string | null
  award_date: string | null
  award_approved_at: string | null
  contract_signature_date: string | null
}

// Carga iniciativas del año, sus hitos y los hechos de sus procesos. Las fechas reales NO se copian: se derivan de aquí.
export async function loadSchedules(supabase: SupabaseClient, companyId: string, year: number, role: string, today = todayISO(), onlyPlanId?: string): Promise<InitiativeSchedule[]> {
  const readContracts = can(role, 'readContracts')
  let query = supabase
    .from('sourcing_plans')
    .select('id, title, status, plan_year, quarter, category, category_id, currency, department_id, responsible_user_id, backup_user_id, team_id, projected_savings_amount, estimated_spend')
    .eq('company_id', companyId)
    .neq('status', 'cancelled')
    .limit(500)
  query = onlyPlanId ? query.eq('id', onlyPlanId) : query.eq('plan_year', year)
  const { data: plans } = await query
  const initiatives = ((plans || []) as InitiativeRow[]).map(item => ({ ...item, projected_savings_amount: num(item.projected_savings_amount), estimated_spend: num(item.estimated_spend) }))
  if (initiatives.length === 0) return []
  const planIds = initiatives.map(item => item.id)

  const none = Promise.resolve({ data: [] as unknown[] | null })
  const [milestones, links, rfx, salas, awards, decisions, contracts, versions] = await Promise.all([
    supabase.from('initiative_milestones').select('id, sourcing_plan_id, kind, seq, original_date, committed_date, actual_date, blocked, block_cause, block_note').in('sourcing_plan_id', planIds),
    supabase.from('sourcing_plan_licitaciones').select('plan_id, licitacion_id').in('plan_id', planIds),
    supabase.from('rfx_projects').select('id, status, sourcing_plan_id, created_at, updated_at').eq('company_id', companyId).in('sourcing_plan_id', planIds).is('archived_at', null),
    supabase.from('offer_events').select('id, status, modality, licitacion_id, sourcing_plan_id, created_at, opens_at, closes_at, offers_opened_at').eq('company_id', companyId).limit(1000),
    supabase.from('process_awards').select('id, licitacion_id, event_id, contract_id, awarded_at').eq('company_id', companyId).limit(1000),
    supabase.from('award_decisions').select('id, licitacion_id, outcome, packet:decision_packets(event_id)').eq('company_id', companyId).eq('outcome', 'pending').limit(500),
    readContracts ? supabase.from('contracts').select('id, status, licitacion_id, award_id, starts_on, updated_at').eq('company_id', companyId).limit(1000) : none,
    readContracts ? supabase.from('contract_versions').select('contract_id, status').eq('company_id', companyId).eq('status', 'returned').limit(500) : none,
  ])

  const licIds = Array.from(new Set(((links.data || []) as { licitacion_id: string }[]).map(link => link.licitacion_id)))
  const lics = licIds.length
    ? (await supabase.from('licitaciones').select('id, status, created_at, publication_date, publish_approved_at, proposal_closing_date, committee_date, award_date, award_approved_at, contract_signature_date').in('id', licIds)).data || []
    : []
  const licById = new Map((lics as LicRow[]).map(item => [item.id, item]))
  const licsByPlan = new Map<string, string[]>()
  for (const link of (links.data || []) as { plan_id: string; licitacion_id: string }[]) licsByPlan.set(link.plan_id, [...(licsByPlan.get(link.plan_id) || []), link.licitacion_id])

  type Sala = { id: string; status: string | null; modality: string | null; licitacion_id: string | null; sourcing_plan_id: string | null; created_at: string | null; opens_at: string | null; closes_at: string | null; offers_opened_at: string | null }
  type Award = { id: string; licitacion_id: string | null; event_id: string | null; contract_id: string | null; awarded_at: string | null }
  type Contract = { id: string; status: string | null; licitacion_id: string | null; award_id: string | null; starts_on: string | null; updated_at: string | null }
  const allSalas = (salas.data || []) as Sala[]
  const allAwards = (awards.data || []) as Award[]
  const allContracts = (contracts.data || []) as Contract[]
  const returnedContractIds = new Set(((versions.data || []) as { contract_id: string }[]).map(item => item.contract_id))
  const pending = (decisions.data || []) as { licitacion_id: string | null; packet?: { event_id?: string } | { event_id?: string }[] | null }[]

  const factsFor = (planId: string): ProcessFacts => {
    const licIdsForPlan = licsByPlan.get(planId) || []
    const planSalas = allSalas.filter(sala => sala.sourcing_plan_id === planId || (sala.licitacion_id && licIdsForPlan.includes(sala.licitacion_id)))
    const eventIds = planSalas.map(sala => sala.id)
    const planAwards = allAwards.filter(award => (award.licitacion_id && licIdsForPlan.includes(award.licitacion_id)) || (award.event_id && eventIds.includes(award.event_id)))
    const awardIds = planAwards.map(award => award.id)
    const planContracts = allContracts.filter(contract => (contract.licitacion_id && licIdsForPlan.includes(contract.licitacion_id)) || (contract.award_id && awardIds.includes(contract.award_id)))
    const pendingForPlan = pending.filter(decision => {
      const packet = Array.isArray(decision.packet) ? decision.packet[0] : decision.packet
      return (decision.licitacion_id && licIdsForPlan.includes(decision.licitacion_id)) || (packet?.event_id && eventIds.includes(packet.event_id))
    })
    return {
      ...EMPTY_FACTS,
      rfx: ((rfx.data || []) as { sourcing_plan_id: string; status: string | null; created_at: string | null; updated_at: string | null }[]).filter(item => item.sourcing_plan_id === planId),
      licitaciones: licIdsForPlan.map(id => licById.get(id)).filter((item): item is LicRow => !!item),
      salas: planSalas,
      awards: planAwards,
      contracts: planContracts,
      pendingDecisions: pendingForPlan.length,
      returnedContracts: planContracts.filter(contract => returnedContractIds.has(contract.id)).length,
    }
  }

  const milestoneRows = (milestones.data || []) as MilestoneRow[]
  const milestoneIds = milestoneRows.map(item => item.id)
  const causeChanges = milestoneIds.length
    ? (await supabase.from('initiative_milestone_changes').select('milestone_id, cause, changed_at').in('milestone_id', milestoneIds).eq('field', 'committed_date').not('cause', 'is', null).order('changed_at', { ascending: false }).limit(2000)).data || []
    : []
  const lastCauseByMilestone: Record<string, RescheduleCause | null> = {}
  for (const change of causeChanges as { milestone_id: string; cause: RescheduleCause }[]) {
    if (!(change.milestone_id in lastCauseByMilestone)) lastCauseByMilestone[change.milestone_id] = change.cause
  }

  return initiatives.map(initiative => {
    const facts = factsFor(initiative.id)
    const rows = milestoneRows.filter(row => row.sourcing_plan_id === initiative.id && (readContracts || row.kind !== 'formalizacion'))
    const views = viewMilestones(rows, { today, system: systemActuals(facts, today), autoBlocks: autoBlocks(facts) })
    return {
      initiative,
      milestones: views,
      health: initiativeHealth(views),
      projection: projectCascade(views, today),
      lastCause: lastCauseByMilestone,
      hasMilestones: rows.length > 0,
    }
  })
}
