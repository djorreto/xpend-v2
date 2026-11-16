// Etapa 4: control de ahorros. Cinco conceptos separados y siempre por moneda, sin conversión:
//   línea base documentada · objetivo · negociado · validado · realizado.
// Nada de lo negociado se convierte en validado o realizado por sí solo. Un dato ausente es null ("Sin información"), nunca 0.

export type Nature = 'reduccion_precio' | 'evitacion_costo'
export type Recurrence = 'unico' | 'recurrente'

export type AwardLite = {
  id: string
  licitacion_id: string | null
  currency: string | null
  amount: number | null
  baseline_amount: number | null
  baseline_currency: string | null
  estimated_savings: number | null
  awarded_at: string | null
  category_id?: string | null
  owner_user_id?: string | null
  team_id?: string | null
}

export type ValidationLite = {
  id: string
  award_id: string | null
  licitacion_id: string | null
  sourcing_plan_id: string | null
  category_id: string | null
  owner_user_id: string | null
  team_id: string | null
  source_kind: 'comite' | 'manual'
  currency: string
  baseline_amount: number
  awarded_amount: number
  declared_amount: number
  nature: Nature
  recurrence: Recurrence
  start_date: string
  end_date: string | null
  validated_amount: number | null
  status: 'declared' | 'validated' | 'returned' | 'withdrawn'
  declared_by: string
  validated_by: string | null
}

export type RecognitionLite = { id: string; validation_id: string; kind: 'recognition' | 'reversal'; period: string; currency: string; amount: number; reverses_id?: string | null }

export const SAVINGS_TEXT = {
  noInfo: 'Sin información',
  pending: 'Pendiente de validación',
  notComparable: 'No comparable. Falta línea base o moneda',
  manual: 'Manual, no pasó por comité',
} as const

// ---- Negociado comparable ------------------------------------------------------------------------------------------------

export type Negotiated = { comparable: true; amount: number; currency: string; baseline: number } | { comparable: false; reason: string }

// Negociado = línea base menos adjudicado, solo si ambos están en la misma moneda. Si no, no se compara.
export function awardNegotiated(award: Pick<AwardLite, 'amount' | 'currency' | 'baseline_amount' | 'baseline_currency'>): Negotiated {
  if (award.baseline_amount == null || award.amount == null || !award.currency || !award.baseline_currency) return { comparable: false, reason: SAVINGS_TEXT.notComparable }
  if (award.currency.toUpperCase() !== award.baseline_currency.toUpperCase()) return { comparable: false, reason: SAVINGS_TEXT.notComparable }
  return { comparable: true, amount: Math.max(award.baseline_amount - award.amount, 0), currency: award.currency.toUpperCase(), baseline: award.baseline_amount }
}

// ---- Calendario ----------------------------------------------------------------------------------------------------------

const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1

// Meses del año en que el beneficio está activo (por calendario de meses, inclusive el de inicio y el de término).
export function activeMonthsInYear(validation: Pick<ValidationLite, 'recurrence' | 'start_date' | 'end_date'>, year: number) {
  const yearStart = year * 12
  const yearEnd = year * 12 + 11
  const start = monthIndex(validation.start_date)
  const end = validation.recurrence === 'recurrente' && validation.end_date ? monthIndex(validation.end_date) : start
  const from = Math.max(start, yearStart)
  const to = Math.min(end, yearEnd)
  return to >= from ? to - from + 1 : 0
}

// Impacto planificado en el año calendario. Único: cuenta íntegro en el año de inicio. Recurrente: doceavos por mes activo.
export function calendarImpact(validation: ValidationLite, year: number): number | null {
  if (validation.status !== 'validated' || validation.validated_amount == null) return null
  if (validation.recurrence === 'unico') return Number(validation.start_date.slice(0, 4)) === year ? validation.validated_amount : 0
  return (validation.validated_amount / 12) * activeMonthsInYear(validation, year)
}

// Ahorro anualizado vigente en el año (el "pipeline"): lo validado de beneficios activos ese año.
export function annualizedInYear(validation: ValidationLite, year: number): number | null {
  if (validation.status !== 'validated' || validation.validated_amount == null) return null
  return activeMonthsInYear(validation, year) > 0 ? validation.validated_amount : 0
}

export function netRecognized(recognitions: RecognitionLite[], filter: { validationId?: string; year?: number } = {}) {
  return recognitions
    .filter(item => (!filter.validationId || item.validation_id === filter.validationId) && (filter.year == null || item.period.startsWith(String(filter.year))))
    .reduce((total, item) => total + (item.kind === 'recognition' ? item.amount : -item.amount), 0)
}

// ---- Resumen por moneda ----------------------------------------------------------------------------------------------------

export type SavingsRow = {
  currency: string
  baseline: number | null
  target: number | null
  negotiated: number | null
  pendingValidation: number | null
  validatedAnnualized: number | null
  validatedYear: number | null
  realizedYear: number | null
  realizedTotal: number | null
  costAvoidance: { validatedAnnualized: number | null; validatedYear: number | null; realizedYear: number | null }
}

type Totals = Record<string, SavingsRow>

function row(map: Totals, currency: string): SavingsRow {
  const key = currency.toUpperCase()
  return (map[key] ||= {
    currency: key,
    baseline: null,
    target: null,
    negotiated: null,
    pendingValidation: null,
    validatedAnnualized: null,
    validatedYear: null,
    realizedYear: null,
    realizedTotal: null,
    costAvoidance: { validatedAnnualized: null, validatedYear: null, realizedYear: null },
  })
}

const add = (current: number | null, value: number) => (current ?? 0) + value

export type TargetLite = { currency: string; target_amount: number | null; category_id?: string | null; owner_user_id?: string | null; team_id?: string | null }

export type Scope = { categoryId?: string; ownerId?: string; teamId?: string }

function inScope(item: { category_id?: string | null; owner_user_id?: string | null; team_id?: string | null }, scope: Scope) {
  return (!scope.categoryId || item.category_id === scope.categoryId) && (!scope.ownerId || item.owner_user_id === scope.ownerId) && (!scope.teamId || item.team_id === scope.teamId)
}

// La cifra principal de validado y realizado es reducción de precio; la evitación de costo se muestra aparte.
export function summarizeSavings(input: {
  year: number
  awards: AwardLite[]
  validations: ValidationLite[]
  recognitions: RecognitionLite[]
  targets: TargetLite[]
  scope?: Scope
}): SavingsRow[] {
  const scope = input.scope || {}
  const map: Totals = {}

  for (const target of input.targets) {
    if (target.target_amount == null || !inScope(target, scope)) continue
    const r = row(map, target.currency)
    r.target = add(r.target, target.target_amount)
  }

  for (const award of input.awards) {
    if (!award.awarded_at || Number(award.awarded_at.slice(0, 4)) !== input.year || !inScope(award, scope)) continue
    const negotiated = awardNegotiated(award)
    if (!negotiated.comparable) continue
    const r = row(map, negotiated.currency)
    r.baseline = add(r.baseline, negotiated.baseline)
    r.negotiated = add(r.negotiated, negotiated.amount)
  }

  for (const validation of input.validations) {
    if (!inScope(validation, scope)) continue
    const r = row(map, validation.currency)
    if (validation.source_kind === 'manual' && (validation.status === 'declared' || validation.status === 'validated') && Number(validation.start_date.slice(0, 4)) === input.year) {
      // El negociado manual no está en process_awards; se suma una sola vez, con su origen visible en el detalle.
      r.baseline = add(r.baseline, validation.baseline_amount)
      r.negotiated = add(r.negotiated, Math.max(validation.baseline_amount - validation.awarded_amount, 0))
    }
    if (validation.status === 'declared') r.pendingValidation = add(r.pendingValidation, validation.declared_amount)
    if (validation.status !== 'validated') continue
    const annualized = annualizedInYear(validation, input.year)
    const impact = calendarImpact(validation, input.year)
    // Sin reconocimientos no hay medición: el realizado queda sin información, no en cero.
    const ownRows = input.recognitions.filter(item => item.validation_id === validation.id)
    const realized = ownRows.some(item => item.period.startsWith(String(input.year))) ? netRecognized(ownRows, { year: input.year }) : null
    const total = ownRows.length ? netRecognized(ownRows) : null
    if (validation.nature === 'reduccion_precio') {
      if (annualized != null) r.validatedAnnualized = add(r.validatedAnnualized, annualized)
      if (impact != null) r.validatedYear = add(r.validatedYear, impact)
      if (realized != null) r.realizedYear = add(r.realizedYear, realized)
      if (total != null) r.realizedTotal = add(r.realizedTotal, total)
    } else {
      if (annualized != null) r.costAvoidance.validatedAnnualized = add(r.costAvoidance.validatedAnnualized, annualized)
      if (impact != null) r.costAvoidance.validatedYear = add(r.costAvoidance.validatedYear, impact)
      if (realized != null) r.costAvoidance.realizedYear = add(r.costAvoidance.realizedYear, realized)
    }
  }
  return Object.values(map).sort((a, b) => a.currency.localeCompare(b.currency))
}

// ---- Cobertura de metas ----------------------------------------------------------------------------------------------------

// Meta por persona o equipo: cada línea del plan se cuenta una sola vez, en su responsable (línea o Category Manager).
export function targetsByOwner(
  lines: { category_id: string; currency: string; target_amount: number | null; owner_user_id: string | null }[],
  categoryManagers: Record<string, string | null>
) {
  const out = new Map<string, { ownerId: string | null; currency: string; target: number }>()
  for (const line of lines) {
    if (line.target_amount == null) continue
    const owner = line.owner_user_id || categoryManagers[line.category_id] || null
    const key = `${owner ?? 'sin_responsable'}|${line.currency}`
    const current = out.get(key) || { ownerId: owner, currency: line.currency, target: 0 }
    current.target += line.target_amount
    out.set(key, current)
  }
  return Array.from(out.values())
}

// ---- Pendientes ------------------------------------------------------------------------------------------------------------

export type PendingItem = { awardId: string; licitacionId: string | null; currency: string; negotiated: number; awardedAt: string | null }

// Adjudicaciones con negociado comparable y sin declaración activa: son las que esperan "Declarar ahorro".
export function pendingDeclarations(awards: AwardLite[], validations: ValidationLite[]): PendingItem[] {
  const active = new Set(validations.filter(item => item.award_id && (item.status === 'declared' || item.status === 'validated')).map(item => item.award_id))
  const out: PendingItem[] = []
  for (const award of awards) {
    if (active.has(award.id)) continue
    const negotiated = awardNegotiated(award)
    if (!negotiated.comparable || negotiated.amount <= 0) continue
    out.push({ awardId: award.id, licitacionId: award.licitacion_id, currency: negotiated.currency, negotiated: negotiated.amount, awardedAt: award.awarded_at })
  }
  return out.sort((a, b) => String(a.awardedAt).localeCompare(String(b.awardedAt)))
}

// Quien declaró no valida: devuelve si una persona puede validar esa declaración.
export function canValidate(validation: Pick<ValidationLite, 'declared_by' | 'status'>, userId: string, role: string) {
  return validation.status === 'declared' && validation.declared_by !== userId && ['super_admin', 'admin', 'manager'].includes(role)
}

export function describeNature(nature: Nature, recurrence: Recurrence) {
  return `${nature === 'reduccion_precio' ? 'Reducción de precio' : 'Evitación de costo'} · ${recurrence === 'unico' ? 'único' : 'recurrente'}`
}
