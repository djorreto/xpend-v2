// Etapa 3: hitos S2C de cada iniciativa, estados, desviaciones, causas y proyección de impacto.
// Funciones puras: las fechas se comparan como días calendario (AAAA-MM-DD) para no depender de la zona horaria.

export type MilestoneKind = 'inicio' | 'preparacion_rfx' | 'invitacion' | 'recepcion' | 'evaluacion' | 'comite_adjudicacion' | 'formalizacion'

export const MILESTONES: { kind: MilestoneKind; seq: number; label: string }[] = [
  { kind: 'inicio', seq: 1, label: 'Inicio' },
  { kind: 'preparacion_rfx', seq: 2, label: 'Preparación RFx' },
  { kind: 'invitacion', seq: 3, label: 'Invitación y publicación' },
  { kind: 'recepcion', seq: 4, label: 'Recepción de propuestas' },
  { kind: 'evaluacion', seq: 5, label: 'Evaluación' },
  { kind: 'comite_adjudicacion', seq: 6, label: 'Comité y adjudicación' },
  { kind: 'formalizacion', seq: 7, label: 'Formalización contractual' },
]

export const MILESTONE_LABEL = Object.fromEntries(MILESTONES.map(item => [item.kind, item.label])) as Record<MilestoneKind, string>

export type DelayCause = 'comprador' | 'aprobador' | 'proveedor' | 'area_solicitante' | 'externo'
export type RescheduleCause = DelayCause | 'arrastre'

export const CAUSE_LABEL: Record<RescheduleCause, string> = {
  comprador: 'Equipo de compras',
  aprobador: 'Aprobación pendiente',
  proveedor: 'Proveedor',
  area_solicitante: 'Área solicitante',
  externo: 'Causa externa',
  arrastre: 'Arrastre de un hito anterior',
}

export const NO_CAUSE_LABEL = 'Sin causa registrada'

export type MilestoneRow = {
  id: string
  sourcing_plan_id: string
  kind: MilestoneKind
  seq: number
  original_date: string | null
  committed_date: string | null
  actual_date: string | null
  blocked: boolean
  block_cause: DelayCause | null
  block_note: string | null
}

export type MilestoneStatus = 'completed' | 'blocked' | 'late' | 'due_soon' | 'on_time' | 'no_date'

export const STATUS_LABEL: Record<MilestoneStatus, string> = {
  completed: 'Completado',
  blocked: 'Bloqueado',
  late: 'Atrasado',
  due_soon: 'Próximo a vencer',
  on_time: 'Al día',
  no_date: 'Sin fecha comprometida',
}

export const DUE_SOON_DAYS = 7

const DAY_MS = 86_400_000

function dayNumber(value: string) {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

export function daysBetween(from: string, to: string) {
  return dayNumber(to) - dayNumber(from)
}

export function addDays(value: string, days: number) {
  return new Date((dayNumber(value) + days) * DAY_MS).toISOString().slice(0, 10)
}

export function todayISO(now: Date = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

// ---- Fechas reales derivadas de eventos del sistema (no se copian a la tabla de hitos) --------------------------------

export type ProcessFacts = {
  rfx: { status: string | null; created_at?: string | null; updated_at?: string | null }[]
  licitaciones: {
    status: string | null
    created_at?: string | null
    publication_date?: string | null
    publish_approved_at?: string | null
    proposal_closing_date?: string | null
    committee_date?: string | null
    award_date?: string | null
    award_approved_at?: string | null
    contract_signature_date?: string | null
  }[]
  salas: { status: string | null; created_at?: string | null; opens_at?: string | null; closes_at?: string | null; offers_opened_at?: string | null; modality?: string | null }[]
  awards: { awarded_at?: string | null }[]
  contracts: { status: string | null; starts_on?: string | null; updated_at?: string | null }[]
  pendingDecisions: number
  returnedContracts: number
}

export const EMPTY_FACTS: ProcessFacts = { rfx: [], licitaciones: [], salas: [], awards: [], contracts: [], pendingDecisions: 0, returnedContracts: 0 }

export type SystemActual = { date: string; source: 'rfx' | 'licitacion' | 'sala' | 'adjudicacion' | 'contrato' | 'proceso'; label: string }

const LIC_PAST_PUBLISH = ['published', 'evaluation', 'in_evaluation', 'committee', 'awarded', 'contract_signed']
const LIC_PAST_CLOSE = ['evaluation', 'in_evaluation', 'committee', 'awarded', 'contract_signed']

function earliest(values: (string | null | undefined)[]) {
  const clean = values.filter((value): value is string => !!value).map(value => value.slice(0, 10)).sort()
  return clean[0] || null
}

// Una fecha real solo existe cuando ocurrió el evento. Devuelve null si el sistema no sabe nada: el hito se registra a mano.
export function systemActuals(facts: ProcessFacts, today: string): Partial<Record<MilestoneKind, SystemActual>> {
  const out: Partial<Record<MilestoneKind, SystemActual>> = {}
  const started = earliest([...facts.rfx.map(r => r.created_at), ...facts.licitaciones.map(l => l.created_at), ...facts.salas.map(s => s.created_at)])
  if (started) out.inicio = { date: started, source: 'proceso', label: 'Primer proceso vinculado creado' }

  const rfxReady = facts.rfx.filter(r => r.status && r.status !== 'draft')
  const rfxDate = earliest(rfxReady.map(r => r.updated_at))
  if (rfxDate) out.preparacion_rfx = { date: rfxDate, source: 'rfx', label: 'Bases listas (RFx)' }

  const published = facts.licitaciones.filter(l => l.status && LIC_PAST_PUBLISH.includes(l.status))
  const pubDate = earliest(published.map(l => l.publish_approved_at || l.publication_date))
  const salaOpened = facts.salas.filter(s => s.status && ['open', 'closed', 'awarded'].includes(s.status))
  const salaOpen = earliest(salaOpened.map(s => s.opens_at))
  const invitation = earliest([pubDate, salaOpen])
  if (invitation) out.invitacion = { date: invitation, source: pubDate && invitation === pubDate ? 'licitacion' : 'sala', label: 'Proceso publicado' }

  const closedLic = earliest(facts.licitaciones.filter(l => l.status && LIC_PAST_CLOSE.includes(l.status)).map(l => l.proposal_closing_date))
  const closedSala = earliest(facts.salas.filter(s => s.status && ['closed', 'awarded'].includes(s.status)).map(s => s.offers_opened_at || s.closes_at))
  const reception = earliest([closedLic, closedSala])
  if (reception && reception <= today) out.recepcion = { date: reception, source: closedSala && reception === closedSala ? 'sala' : 'licitacion', label: 'Recepción cerrada' }

  const awarded = facts.licitaciones.filter(l => l.status && ['awarded', 'contract_signed'].includes(l.status))
  const committee = earliest(awarded.map(l => l.committee_date))
  if (committee && committee <= today) out.evaluacion = { date: committee, source: 'licitacion', label: 'Evaluación presentada al comité' }

  const award = earliest([...facts.awards.map(a => a.awarded_at), ...awarded.map(l => l.award_approved_at || l.award_date)])
  if (award) out.comite_adjudicacion = { date: award, source: 'adjudicacion', label: 'Adjudicación registrada' }
  // Si hubo adjudicación, la evaluación terminó como máximo ese día (sin inventar una fecha anterior).
  if (award && !out.evaluacion) out.evaluacion = { date: award, source: 'adjudicacion', label: 'Evaluación cerrada con la adjudicación' }

  const active = facts.contracts.filter(c => c.status === 'active')
  const contract = earliest([...active.map(c => c.starts_on || c.updated_at), ...awarded.filter(l => l.status === 'contract_signed').map(l => l.contract_signature_date)])
  if (contract) out.formalizacion = { date: contract, source: 'contrato', label: 'Contrato vigente' }
  return out
}

export type AutoBlock = { kind: MilestoneKind; cause: DelayCause; note: string }

// Causas conocidas del sistema. Una espera de aprobación NO se atribuye al comprador.
export function autoBlocks(facts: ProcessFacts): AutoBlock[] {
  const out: AutoBlock[] = []
  if (facts.licitaciones.some(l => l.status === 'bases_review')) {
    out.push({ kind: 'invitacion', cause: 'aprobador', note: 'Bases en revisión: esperan aprobación.' })
  }
  if (facts.pendingDecisions > 0) {
    out.push({ kind: 'comite_adjudicacion', cause: 'aprobador', note: 'Decisión de adjudicación sin votos completos.' })
  }
  if (facts.salas.some(s => s.status === 'closed' && (s.modality || 'sealed') === 'sealed' && !s.offers_opened_at)) {
    out.push({ kind: 'evaluacion', cause: 'aprobador', note: 'La sala cerró y las ofertas aún no se abren.' })
  }
  if (facts.contracts.some(c => c.status === 'in_review')) {
    out.push({ kind: 'formalizacion', cause: 'aprobador', note: 'El contrato está en revisión.' })
  }
  if (facts.returnedContracts > 0) {
    out.push({ kind: 'formalizacion', cause: 'comprador', note: 'El contrato fue devuelto para corregir.' })
  }
  return out
}

// ---- Estado de cada hito -------------------------------------------------------------------------------------------------

export type MilestoneView = MilestoneRow & {
  label: string
  actual: string | null
  actualSource: SystemActual['source'] | 'manual' | null
  status: MilestoneStatus
  lateDays: number
  deviationDays: number | null
  vsOriginalDays: number | null
  blockedBy: { cause: DelayCause; note: string; automatic: boolean } | null
}

export function viewMilestone(
  row: MilestoneRow,
  context: { today: string; system?: Partial<Record<MilestoneKind, SystemActual>>; autoBlocks?: AutoBlock[]; dueSoonDays?: number }
): MilestoneView {
  const system = context.system?.[row.kind]
  const actual = row.actual_date || system?.date || null
  const actualSource = row.actual_date ? ('manual' as const) : system?.source || null
  const auto = (context.autoBlocks || []).find(block => block.kind === row.kind)
  const blockedBy = row.blocked && row.block_cause
    ? { cause: row.block_cause, note: row.block_note || '', automatic: false }
    : auto && !actual
      ? { cause: auto.cause, note: auto.note, automatic: true }
      : null
  const committed = row.committed_date
  let status: MilestoneStatus
  if (actual) status = 'completed'
  else if (blockedBy) status = 'blocked'
  else if (!committed) status = 'no_date'
  else {
    const remaining = daysBetween(context.today, committed)
    status = remaining < 0 ? 'late' : remaining <= (context.dueSoonDays ?? DUE_SOON_DAYS) ? 'due_soon' : 'on_time'
  }
  const reference = actual || context.today
  const deviation = committed ? daysBetween(committed, reference) : null
  const lateDays = !actual && committed && deviation !== null && deviation > 0 ? deviation : 0
  return {
    ...row,
    label: MILESTONE_LABEL[row.kind],
    actual,
    actualSource,
    status,
    lateDays,
    deviationDays: actual ? deviation : lateDays > 0 ? lateDays : null,
    vsOriginalDays: row.original_date ? daysBetween(row.original_date, actual || committed || context.today) : null,
    blockedBy,
  }
}

export function viewMilestones(
  rows: MilestoneRow[],
  context: { today: string; system?: Partial<Record<MilestoneKind, SystemActual>>; autoBlocks?: AutoBlock[]; dueSoonDays?: number }
) {
  return [...rows].sort((a, b) => a.seq - b.seq).map(row => viewMilestone(row, context))
}

// ---- Atrasos y su causa -----------------------------------------------------------------------------------------------------

export type DelayAttribution = { cause: RescheduleCause | 'sin_causa'; label: string }

// La causa de un atraso sale del bloqueo vigente o de la última reprogramación. Sin dato, no se culpa a nadie.
export function delayCause(view: MilestoneView, lastRescheduleCause?: RescheduleCause | null): DelayAttribution {
  if (view.blockedBy) return { cause: view.blockedBy.cause, label: CAUSE_LABEL[view.blockedBy.cause] }
  if (lastRescheduleCause) return { cause: lastRescheduleCause, label: CAUSE_LABEL[lastRescheduleCause] }
  return { cause: 'sin_causa', label: NO_CAUSE_LABEL }
}

export function delaysByCause(views: { view: MilestoneView; lastCause?: RescheduleCause | null }[]) {
  const counts: Record<string, number> = {}
  for (const { view, lastCause } of views) {
    if (view.status !== 'late' && view.status !== 'blocked') continue
    const key = delayCause(view, lastCause).cause
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}

// ---- Proyección de impacto en cascada (nunca modifica fechas) ----------------------------------------------------------------

export type Projection = {
  milestoneId: string
  kind: MilestoneKind
  committed: string | null
  projected: string | null
  shiftDays: number
  affected: boolean
}

// Si un hito se atrasa, los siguientes conservan su separación original. Devuelve la fecha proyectada de cada uno y de término.
export function projectCascade(views: MilestoneView[], today: string): { items: Projection[]; projectedEnd: string | null; committedEnd: string | null; endShiftDays: number; originMilestone: MilestoneKind | null } {
  const ordered = [...views].sort((a, b) => a.seq - b.seq)
  const items: Projection[] = []
  let origin: MilestoneKind | null = null
  let prevCommitted: string | null = null
  let prevProjected: string | null = null
  for (const view of ordered) {
    const committed = view.committed_date
    if (view.actual) {
      const date = view.actual
      items.push({ milestoneId: view.id, kind: view.kind, committed, projected: date, shiftDays: committed ? daysBetween(committed, date) : 0, affected: false })
      prevCommitted = committed || prevCommitted
      prevProjected = date
      if (committed && daysBetween(committed, date) > 0 && !origin) origin = view.kind
      continue
    }
    if (!committed) {
      items.push({ milestoneId: view.id, kind: view.kind, committed: null, projected: null, shiftDays: 0, affected: false })
      continue
    }
    let projected = committed
    if (view.lateDays > 0) {
      projected = today
      if (!origin) origin = view.kind
    } else if (prevProjected && prevCommitted) {
      const gap = daysBetween(prevCommitted, committed)
      const candidate = addDays(prevProjected, Math.max(gap, 0))
      if (candidate > committed) projected = candidate
    }
    items.push({ milestoneId: view.id, kind: view.kind, committed, projected, shiftDays: daysBetween(committed, projected), affected: view.lateDays === 0 && projected > committed })
    prevCommitted = committed
    prevProjected = projected
  }
  const dated = items.filter(item => item.committed)
  const last = dated[dated.length - 1]
  return {
    items,
    projectedEnd: last?.projected || null,
    committedEnd: last?.committed || null,
    endShiftDays: last?.projected && last.committed ? daysBetween(last.committed, last.projected) : 0,
    originMilestone: origin,
  }
}

// Propuesta de fechas para "Ajustar siguientes". Una persona la confirma; esta función no escribe nada.
export function proposeAdjustments(projection: ReturnType<typeof projectCascade>) {
  return projection.items
    .filter(item => item.affected && item.projected && item.committed && item.projected !== item.committed)
    .map(item => ({ id: item.milestoneId, kind: item.kind, from: item.committed as string, to: item.projected as string }))
}

// ---- Salud agregada de una iniciativa y del portafolio ---------------------------------------------------------------------

export type InitiativeHealth = 'completed' | 'blocked' | 'late' | 'due_soon' | 'on_time' | 'no_dates'

export function initiativeHealth(views: MilestoneView[]): InitiativeHealth {
  if (views.length === 0 || views.every(view => view.status === 'no_date')) return 'no_dates'
  if (views.every(view => view.status === 'completed')) return 'completed'
  const open = views.filter(view => view.status !== 'completed')
  if (open.some(view => view.status === 'late')) return 'late'
  if (open.some(view => view.status === 'blocked')) return 'blocked'
  if (open.some(view => view.status === 'due_soon')) return 'due_soon'
  return 'on_time'
}

export const HEALTH_LABEL: Record<InitiativeHealth, string> = {
  completed: 'Completada',
  blocked: 'Bloqueada',
  late: 'Atrasada',
  due_soon: 'Próxima a vencer',
  on_time: 'Al día',
  no_dates: 'Sin fechas comprometidas',
}

// ---- Plan anual -----------------------------------------------------------------------------------------------------------

export type LineLike = { id?: string; category_id: string; currency: string; historical_spend: number | null; target_amount: number | null; owner_user_id: string | null; priority: number }
export type InitiativeTarget = { id: string; category_id: string | null; currency: string | null; projected_savings_amount: number | null; status?: string | null }

// Cobertura: cuánto de la meta de la línea está respaldado por el objetivo de las iniciativas de esa categoría y moneda.
// Las iniciativas descomponen la meta; no se suman a ella.
export function lineCoverage(line: LineLike, initiatives: InitiativeTarget[]) {
  const matching = initiatives.filter(item => item.category_id === line.category_id && String(item.currency || '').toUpperCase() === line.currency && item.status !== 'cancelled')
  const known = matching.filter(item => item.projected_savings_amount != null)
  const sum = known.reduce((total, item) => total + Number(item.projected_savings_amount), 0)
  return {
    initiatives: matching.length,
    initiativeTarget: known.length ? sum : null,
    coverage: line.target_amount && line.target_amount > 0 && known.length ? sum / line.target_amount : null,
    gap: line.target_amount != null && known.length ? Math.max(line.target_amount - sum, 0) : line.target_amount,
  }
}

export type SnapshotLine = { line_id: string; category_id: string; category?: string; currency: string; historical_spend: number | null; target_amount: number | null; owner_user_id: string | null; priority: number }

export type LineDiff = {
  category_id: string
  currency: string
  kind: 'unchanged' | 'revised' | 'added'
  targetOriginal: number | null
  targetCurrent: number | null
  targetDelta: number | null
}

// Compara el plan vigente con la foto del plan comprometido. Nada se pierde: lo agregado y lo revisado son visibles.
export function diffAgainstCommitted(snapshot: SnapshotLine[], current: LineLike[]): LineDiff[] {
  const key = (item: { category_id: string; currency: string }) => `${item.category_id}|${item.currency}`
  const original = new Map(snapshot.map(item => [key(item), item]))
  const diffs: LineDiff[] = current.map(item => {
    const base = original.get(key(item))
    if (!base) return { category_id: item.category_id, currency: item.currency, kind: 'added', targetOriginal: null, targetCurrent: item.target_amount, targetDelta: null }
    const changed = base.target_amount !== item.target_amount || base.owner_user_id !== item.owner_user_id || base.priority !== item.priority || base.historical_spend !== item.historical_spend
    return {
      category_id: item.category_id,
      currency: item.currency,
      kind: changed ? 'revised' : 'unchanged',
      targetOriginal: base.target_amount,
      targetCurrent: item.target_amount,
      targetDelta: base.target_amount != null && item.target_amount != null ? item.target_amount - base.target_amount : null,
    }
  })
  return diffs
}

// Totales por moneda: nunca se convierten ni se suman monedas distintas.
export function totalsByCurrency(lines: { currency: string; target_amount: number | null; historical_spend: number | null }[]) {
  const out = new Map<string, { currency: string; target: number | null; spend: number | null }>()
  for (const line of lines) {
    const row = out.get(line.currency) || { currency: line.currency, target: null, spend: null }
    if (line.target_amount != null) row.target = (row.target ?? 0) + line.target_amount
    if (line.historical_spend != null) row.spend = (row.spend ?? 0) + line.historical_spend
    out.set(line.currency, row)
  }
  return Array.from(out.values()).sort((a, b) => a.currency.localeCompare(b.currency))
}
