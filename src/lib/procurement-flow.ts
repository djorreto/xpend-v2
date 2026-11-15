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
 * Cinco conceptos de ahorro. Ninguno se presta el nombre de otro.
 * - Objetivo: meta de la iniciativa.
 * - Negociado: línea base menos monto adjudicado. Solo nace de una adjudicación de comité
 *   (`process_awards`) con base comparable. Es una estimación.
 * - Declarado: número que alguien tipeó (iniciativa o formulario de licitación). Sin validación.
 * - Validado: todavía no existe en XPEND.
 * - Realizado: todavía no existe en XPEND. Solo habrá con evidencia posterior.
 */
export const SAVINGS_LABELS = {
  target: 'Ahorro objetivo',
  negotiated: 'Ahorro negociado (estimado)',
  declared: 'Ahorro declarado, sin validación',
  validated: 'Ahorro validado',
  realized: 'Ahorro realizado',
  negotiatedVsTarget: 'Negociado vs objetivo',
  noInfo: 'Sin información',
  pendingValidation: 'Pendiente de validación',
} as const

/** El realizado no se mide todavía. Nunca se muestra como cero. */
export function realizedSavingsLabel() {
  return SAVINGS_LABELS.noInfo
}

/** El validado no existe todavía: hay algo por validar solo si hay un negociado. */
export function validatedSavingsLabel(hasNegotiated: boolean) {
  return hasNegotiated ? SAVINGS_LABELS.pendingValidation : SAVINGS_LABELS.noInfo
}

export type MoneyAmount = { currency: string; amount: number }

/** Texto plano para CSV: «5000 USD; 100 CLP», o «Sin información» si no hay ninguna cifra. */
export function moneyListText(list: MoneyAmount[]) {
  if (!list.length) return SAVINGS_LABELS.noInfo
  return list.map(row => `${row.amount} ${row.currency}`).join('; ')
}

/** Una licitación vinculada a una iniciativa, con su adjudicación de comité si existe. */
export type SavingsLink = {
  plan_id: string
  licitacion_id?: string | null
  status?: string | null
  /** moneda de la línea base de la licitación */
  currency?: string | null
  /** licitaciones.savings_amount. Puede venir del comité o de un formulario tipeado. */
  savings_amount?: number | null
  /** process_awards de la licitación. Solo existe si el comité adjudicó. */
  award?: { estimated_savings?: number | null; currency?: string | null } | null
}

export type LinkSavings =
  | { kind: 'negotiated'; amount: number; currency: string }
  | { kind: 'declared'; amount: number; currency: string }
  | { kind: 'none'; reason: 'not_comparable' | 'no_amount' }

/**
 * Clasifica el ahorro de una licitación.
 * Con adjudicación de comité manda `estimated_savings`, que la base calcula solo si la moneda y el alcance
 * son comparables. Sin adjudicación de comité, lo que haya en `savings_amount` lo tipeó una persona.
 * El estado de la licitación (adjudicada o con contrato firmado) no cambia la clasificación.
 */
export function classifyLinkSavings(link: SavingsLink): LinkSavings {
  const currency = normalizePlanCurrency(link.award?.currency || link.currency)
  if (link.award) {
    const estimated = link.award.estimated_savings
    if (estimated == null || !Number.isFinite(Number(estimated))) {
      return { kind: 'none', reason: 'not_comparable' }
    }
    return { kind: 'negotiated', amount: Number(estimated), currency }
  }
  const typed = link.savings_amount
  if (typed == null || !Number.isFinite(Number(typed))) return { kind: 'none', reason: 'no_amount' }
  return { kind: 'declared', amount: Number(typed), currency: normalizePlanCurrency(link.currency) }
}

type LicitacionSavingsInput = {
  status?: string | null
  baseline_currency?: string | null
  savings_amount?: number | null
  savings_percentage?: number | null
  award?:
    | { estimated_savings?: number | null; estimated_percentage?: number | null; currency?: string | null }
    | { estimated_savings?: number | null; estimated_percentage?: number | null; currency?: string | null }[]
    | null
}

export type LicitacionSavingsView =
  | { kind: 'negotiated' | 'declared'; amount: number; percentage: number | null; currency: string }
  | { kind: 'none'; reason: 'not_comparable' | 'no_amount' }

/** Lo que una licitación puede mostrar como ahorro, con su nombre correcto. */
export function licitacionSavingsView(lic: LicitacionSavingsInput): LicitacionSavingsView {
  const award = Array.isArray(lic.award) ? lic.award[0] ?? null : lic.award ?? null
  const result = classifyLinkSavings({
    plan_id: '',
    status: lic.status,
    currency: lic.baseline_currency,
    savings_amount: lic.savings_amount,
    award,
  })
  if (result.kind === 'none') return result
  const percentage = result.kind === 'negotiated' ? award?.estimated_percentage : lic.savings_percentage
  return {
    kind: result.kind,
    amount: result.amount,
    percentage: percentage == null || !Number.isFinite(Number(percentage)) ? null : Number(percentage),
    currency: result.currency,
  }
}

function addTo(map: Map<string, number>, currency: string, amount: number) {
  map.set(currency, (map.get(currency) || 0) + amount)
}

function toMoney(map: Map<string, number>): MoneyAmount[] {
  return Array.from(map.entries())
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}

export type PlanSavings = {
  currency: string
  target: number | null
  negotiated: MoneyAmount[]
  declared: MoneyAmount[]
  /** adjudicaciones de comité sin base comparable: no hay ahorro negociado que mostrar */
  withoutComparableBase: number
  /** porcentaje solo en la moneda de la iniciativa; null si falta objetivo o negociado */
  negotiatedVsTarget: number | null
}

type PlanMoney = {
  id: string
  currency?: string | null
  projected_savings_amount?: number | null
  actual_savings_amount?: number | null
}

/**
 * Ahorros de una iniciativa. El monto tipeado en la iniciativa se muestra como declarado solo si
 * ninguna licitación vinculada trae uno tipeado, para no contar dos veces la misma cifra.
 */
export function planSavings(plan: PlanMoney, links: SavingsLink[]): PlanSavings {
  const currency = normalizePlanCurrency(plan.currency)
  const negotiated = new Map<string, number>()
  const linkDeclared = new Map<string, number>()
  let withoutComparableBase = 0
  for (const link of links) {
    if (link.plan_id !== plan.id) continue
    const result = classifyLinkSavings(link)
    if (result.kind === 'negotiated') addTo(negotiated, result.currency, result.amount)
    else if (result.kind === 'declared') addTo(linkDeclared, result.currency, result.amount)
    else if (result.reason === 'not_comparable') withoutComparableBase += 1
  }
  const declared = new Map(linkDeclared)
  const typed = Number(plan.actual_savings_amount)
  if (!declared.size && Number.isFinite(typed) && plan.actual_savings_amount != null && typed !== 0) {
    addTo(declared, currency, typed)
  }
  const targetRaw = Number(plan.projected_savings_amount)
  const target = plan.projected_savings_amount != null && Number.isFinite(targetRaw) && targetRaw !== 0 ? targetRaw : null
  const negotiatedHere = negotiated.get(currency)
  return {
    currency,
    target,
    negotiated: toMoney(negotiated),
    declared: toMoney(declared),
    withoutComparableBase,
    negotiatedVsTarget:
      target != null && target > 0 && negotiatedHere != null ? (negotiatedHere / target) * 100 : null,
  }
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

/**
 * Una fila por moneda. `negotiated` y `declared` son null cuando no hay ninguna cifra en esa moneda:
 * la pantalla muestra «Sin información», nunca cero. No se suma CLP con USD.
 */
export type CurrencySavings = {
  currency: string
  target: number | null
  negotiated: number | null
  declared: number | null
  /** negociado / objetivo en esa moneda. null si falta alguno. */
  negotiatedVsTarget: number | null
}

export function savingsByCurrency(plans: PlanMoney[], links: SavingsLink[]): CurrencySavings[] {
  const target = new Map<string, number>()
  const negotiated = new Map<string, number>()
  const declared = new Map<string, number>()
  for (const plan of plans) {
    const summary = planSavings(plan, links)
    if (summary.target != null) addTo(target, summary.currency, summary.target)
    for (const row of summary.negotiated) addTo(negotiated, row.currency, row.amount)
    for (const row of summary.declared) addTo(declared, row.currency, row.amount)
  }
  const currencies = Array.from(
    new Set([...Array.from(target.keys()), ...Array.from(negotiated.keys()), ...Array.from(declared.keys())])
  ).sort()
  return currencies.map(currency => {
    const goal = target.get(currency) ?? null
    const negotiatedAmount = negotiated.get(currency) ?? null
    return {
      currency,
      target: goal,
      negotiated: negotiatedAmount,
      declared: declared.get(currency) ?? null,
      negotiatedVsTarget:
        goal != null && goal > 0 && negotiatedAmount != null ? (negotiatedAmount / goal) * 100 : null,
    }
  })
}

type LinkRow = {
  plan_id: string
  licitacion?: unknown
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null
  return value ?? null
}

/** Convierte las filas de `sourcing_plan_licitaciones` con su licitación y adjudicación en `SavingsLink`. */
export function toSavingsLinks(rows: LinkRow[] | null | undefined): SavingsLink[] {
  const links: SavingsLink[] = []
  for (const row of rows || []) {
    const lic = one(row.licitacion as Record<string, unknown> | Record<string, unknown>[] | null)
    if (!lic) continue
    const award = one(lic.award as Record<string, unknown> | Record<string, unknown>[] | null)
    links.push({
      plan_id: row.plan_id,
      licitacion_id: (lic.id as string | undefined) ?? null,
      status: (lic.status as string | undefined) ?? null,
      currency: (lic.baseline_currency as string | undefined) ?? null,
      savings_amount: (lic.savings_amount as number | null | undefined) ?? null,
      award: award
        ? {
            estimated_savings: (award.estimated_savings as number | null | undefined) ?? null,
            currency: (award.currency as string | undefined) ?? null,
          }
        : null,
    })
  }
  return links
}

/** Selección común: licitaciones vinculadas con su adjudicación de comité. */
export const SAVINGS_LINK_SELECT =
  'plan_id, licitacion:licitaciones(id, name, status, baseline_amount, baseline_currency, awarded_amount, savings_amount, award:process_awards(estimated_savings, currency))'

export async function loadPlanSavingsLinks(supabase: SupabaseClient, planIds: string[]): Promise<SavingsLink[]> {
  if (!planIds.length) return []
  const { data } = await supabase.from('sourcing_plan_licitaciones').select(SAVINGS_LINK_SELECT).in('plan_id', planIds)
  return toSavingsLinks(data as LinkRow[] | null)
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
