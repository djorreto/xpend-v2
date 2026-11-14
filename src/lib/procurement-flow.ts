import type { SupabaseClient } from '@supabase/supabase-js'

export const APPROVER_ROLES = ['admin', 'manager', 'super_admin'] as const

const GATED_STATUSES = new Set(['published', 'evaluation', 'awarded', 'contract_signed'])

export function canApprove(role?: string | null) {
  return !!role && (APPROVER_ROLES as readonly string[]).includes(role)
}

export function statusGateMessage(role: string | null | undefined, status: string) {
  if (!GATED_STATUSES.has(status) || canApprove(role)) return null
  return 'Publicar, evaluar o adjudicar lo aprueba un jefe, manager o admin.'
}

/**
 * Si el proceso ya tiene licitaciones adjudicadas, el ahorro real es esa suma.
 * El monto tipeado en la iniciativa solo vale cuando no hay proceso vinculado.
 * Así el plan no cuenta dos veces el mismo ahorro.
 */
export function realizedSavings(
  stored: number | null | undefined,
  linked?: number | null,
  hasAward = false
) {
  if (hasAward) return Number(linked) || 0
  const linkedN = Number(linked) || 0
  if (linkedN !== 0) return linkedN
  return Number(stored) || 0
}

/** Ahorro de una licitación: línea base menos lo adjudicado. */
export function awardSavings(baseline: number | null | undefined, awarded: number | null | undefined) {
  const base = Number(baseline)
  const won = Number(awarded)
  if (!Number.isFinite(base) || !Number.isFinite(won) || base === 0 || awarded == null || baseline == null) {
    return { savings_amount: null as number | null, savings_percentage: null as number | null }
  }
  const savings = Math.round((base - won) * 100) / 100
  return {
    savings_amount: savings,
    savings_percentage: Math.round((savings / base) * 10000) / 100,
  }
}

export type CurrencySavings = { currency: string; projected: number; actual: number; rate: number }

type PlanMoney = {
  id: string
  currency?: string | null
  projected_savings_amount?: number | null
  actual_savings_amount?: number | null
}

type LinkMoney = {
  plan_id: string
  savings_amount?: number | null
  currency?: string | null
  awarded?: boolean
}

/** Proyectado y adjudicado por moneda. No suma CLP con USD. */
export function savingsByCurrency(plans: PlanMoney[], links: LinkMoney[]): CurrencySavings[] {
  const projected = new Map<string, number>()
  const actual = new Map<string, number>()
  const linksByPlan = new Map<string, LinkMoney[]>()
  for (const link of links) {
    const list = linksByPlan.get(link.plan_id) || []
    list.push(link)
    linksByPlan.set(link.plan_id, list)
  }
  for (const plan of plans) {
    const currency = normalizePlanCurrency(plan.currency)
    const projectedAmount = Number(plan.projected_savings_amount) || 0
    if (projectedAmount) projected.set(currency, (projected.get(currency) || 0) + projectedAmount)
    const planLinks = linksByPlan.get(plan.id) || []
    const awardedLinks = planLinks.filter(link => link.awarded && link.savings_amount != null)
    if (awardedLinks.length) {
      for (const link of awardedLinks) {
        const amount = Number(link.savings_amount) || 0
        const code = normalizePlanCurrency(link.currency || plan.currency)
        actual.set(code, (actual.get(code) || 0) + amount)
      }
    } else {
      const stored = Number(plan.actual_savings_amount) || 0
      if (stored) actual.set(currency, (actual.get(currency) || 0) + stored)
    }
  }
  const currencies = Array.from(new Set(Array.from(projected.keys()).concat(Array.from(actual.keys()))))
  return currencies.sort().map(currency => {
    const projectedAmount = projected.get(currency) || 0
    const actualAmount = actual.get(currency) || 0
    return {
      currency,
      projected: projectedAmount,
      actual: actualAmount,
      rate: projectedAmount > 0 ? (actualAmount / projectedAmount) * 100 : 0,
    }
  })
}

function normalizePlanCurrency(value?: string | null) {
  const code = String(value || 'CLP').trim().toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : 'CLP'
}

export async function syncPlanFromLicitacion(
  supabase: SupabaseClient,
  licitacionId: string,
  status: string
) {
  if (status === 'planned' || status === 'bases_review') return
  const { data: links } = await supabase
    .from('sourcing_plan_licitaciones')
    .select('plan_id')
    .eq('licitacion_id', licitacionId)

  const planIds = (links || []).map(link => link.plan_id).filter(Boolean)
  if (!planIds.length) return

  const awarded = status === 'awarded' || status === 'contract_signed'

  await supabase
    .from('sourcing_plans')
    .update(
      awarded
        ? { status: 'completed', actual_completion_date: new Date().toISOString().slice(0, 10) }
        : { status: 'in_progress' }
    )
    .in('id', planIds)
    .neq('status', 'cancelled')
}

export type SupplierBlock = { id: string; reason: string }

export async function blockedSuppliers(
  supabase: SupabaseClient,
  companyId: string,
  supplierIds: string[]
): Promise<SupplierBlock[]> {
  if (!supplierIds.length) return []

  const overall = await supabase
    .from('administrative_evaluations')
    .select('supplier_id, overall_score, valid_until')
    .eq('company_id', companyId)
    .in('supplier_id', supplierIds)

  let rows = overall.data || []
  if (overall.error) {
    const legacy = await supabase
      .from('administrative_evaluations')
      .select('supplier_id, final_score, valid_until')
      .eq('company_id', companyId)
      .in('supplier_id', supplierIds)
    if (legacy.error) return []
    rows = (legacy.data || []).map(row => ({
      supplier_id: row.supplier_id,
      overall_score: row.final_score,
      valid_until: row.valid_until,
    }))
  }

  const latest = new Map<string, { score: number | null; valid_until: string | null }>()
  for (const row of rows) {
    const prev = latest.get(row.supplier_id)
    if (!prev || String(row.valid_until || '') > String(prev.valid_until || '')) {
      latest.set(row.supplier_id, {
        score: row.overall_score,
        valid_until: row.valid_until,
      })
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const blocked: SupplierBlock[] = []
  for (const id of supplierIds) {
    const evalRow = latest.get(id)
    if (!evalRow) {
      blocked.push({ id, reason: 'sin evaluación administrativa' })
      continue
    }
    if (!evalRow.valid_until || evalRow.valid_until < today) {
      blocked.push({ id, reason: 'evaluación vencida' })
      continue
    }
    if (evalRow.score != null && Number(evalRow.score) < 60) {
      blocked.push({ id, reason: 'puntaje bajo 60' })
    }
  }
  return blocked
}

export type QueueItem = { id: string; title: string; detail: string; href: string }

export type MorningQueue = {
  decisions: QueueItem[]
  stalled: QueueItem[]
  withoutOwner: QueueItem[]
  withoutProcess: QueueItem[]
  needsReview: number
}

function currentQuarter(date = new Date()) {
  return `Q${Math.floor(date.getMonth() / 3) + 1}`
}

function quarterRank(quarter: string | null | undefined) {
  const match = String(quarter || '').match(/(\d)/)
  return match ? Number(match[1]) : 0
}

export async function loadMorningQueue(
  supabase: SupabaseClient,
  companyId: string
): Promise<MorningQueue> {
  const empty: MorningQueue = {
    decisions: [],
    stalled: [],
    withoutOwner: [],
    withoutProcess: [],
    needsReview: 0,
  }

  const year = new Date().getFullYear()
  const quarter = currentQuarter()
  const stallBefore = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [licitacionesRes, plansRes, linksRes, reviewRes] = await Promise.all([
    supabase
      .from('licitaciones')
      .select('id, name, status, updated_at')
      .eq('company_id', companyId),
    supabase
      .from('sourcing_plans')
      .select('id, title, status, quarter, responsible_user_id, is_spot')
      .eq('company_id', companyId)
      .eq('plan_year', year)
      .neq('status', 'cancelled'),
    supabase.from('sourcing_plan_licitaciones').select('plan_id, licitacion_id'),
    supabase
      .from('si_spend_lines')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('needs_review', true),
  ])

  const licitaciones = licitacionesRes.data || []
  const plans = plansRes.data || []
  const linkedPlanIds = new Set((linksRes.data || []).map(link => link.plan_id))

  const decisions = licitaciones
    .filter(item => item.status === 'bases_review')
    .slice(0, 6)
    .map(item => ({
      id: item.id,
      title: item.name || 'Licitación',
      detail: 'Bases en revisión. Falta la aprobación para publicar.',
      href: `/licitaciones/${item.id}/edit`,
    }))

  const stalled = licitaciones
    .filter(item =>
      ['published', 'evaluation', 'bases_review'].includes(item.status) &&
      item.updated_at &&
      item.updated_at < stallBefore
    )
    .slice(0, 6)
    .map(item => ({
      id: item.id,
      title: item.name || 'Licitación',
      detail: 'Sin movimiento hace más de 14 días.',
      href: `/licitaciones/${item.id}`,
    }))

  const nowRank = quarterRank(quarter)
  const openPlans = plans.filter(plan => {
    if (plan.is_spot || !['planned', 'in_progress'].includes(plan.status)) return false
    const rank = quarterRank(plan.quarter)
    return rank === 0 || rank <= nowRank
  })

  const quarterNote = (planQuarter: string | null | undefined, pending: string) => {
    const rank = quarterRank(planQuarter)
    if (rank > 0 && rank < nowRank) return `${planQuarter} ya venció y ${pending}`
    return `${planQuarter || 'Sin trimestre'}: ${pending}`
  }

  const withoutOwner = openPlans
    .filter(plan => !plan.responsible_user_id)
    .slice(0, 8)
    .map(plan => ({
      id: plan.id,
      title: plan.title,
      detail: quarterNote(plan.quarter, 'sigue sin responsable.'),
      href: `/sourcing-plan/${plan.id}`,
    }))

  const withoutProcess = openPlans
    .filter(plan => !linkedPlanIds.has(plan.id))
    .slice(0, 8)
    .map(plan => ({
      id: plan.id,
      title: plan.title,
      detail: quarterNote(plan.quarter, 'sigue sin licitación.'),
      href: `/sourcing-plan/${plan.id}`,
    }))

  return {
    decisions,
    stalled,
    withoutOwner,
    withoutProcess,
    needsReview: reviewRes.count || empty.needsReview,
  }
}
