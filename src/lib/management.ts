// Etapa 5: indicadores de gestión. Funciones puras sobre iniciativas con sus hitos (InitiativeSchedule).
// Regla: toda cifra se puede abrir hasta las iniciativas o registros que la componen; por eso cada función devuelve las
// iniciativas, no solo el conteo.
import { effectiveOwner, type CategoryAssignment, type PlanLike } from './portfolio.ts'
import { addDays, daysBetween, MILESTONES, type InitiativeHealth, type MilestoneKind, type MilestoneView } from './milestones.ts'

export type ScheduleLike = {
  initiative: PlanLike & { title: string; category_id?: string | null; currency?: string | null; projected_savings_amount?: number | null }
  milestones: MilestoneView[]
  health: InitiativeHealth
  hasMilestones: boolean
}

type Assignments = Map<string, CategoryAssignment> | Record<string, CategoryAssignment>

export type StageKey = MilestoneKind | 'completada' | 'sin_hitos'
export const STAGE_ORDER: StageKey[] = ['sin_hitos', ...MILESTONES.map(item => item.kind), 'completada']
export const STAGE_LABEL: Record<StageKey, string> = {
  sin_hitos: 'Sin hitos',
  ...(Object.fromEntries(MILESTONES.map(item => [item.kind, item.label])) as Record<MilestoneKind, string>),
  completada: 'Completada',
}

export const isOpen = (item: ScheduleLike) => item.initiative.status !== 'completed' && item.initiative.status !== 'cancelled'

// Etapa actual = primer hito aún sin fecha real. Sin hitos creados, la iniciativa figura "Sin hitos", no en la primera etapa.
export function currentStage(item: ScheduleLike): StageKey {
  if (!item.hasMilestones || item.milestones.length === 0) return 'sin_hitos'
  const next = item.milestones.find(view => view.status !== 'completed')
  return next ? next.kind : 'completada'
}

export type Compliance = { total: number; measured: number; onTrack: number; dueSoon: number; completed: number; late: number; blocked: number; noDates: number; pct: number | null }

// Cumplimiento del plan = iniciativas con hitos fechados que no están atrasadas ni bloqueadas, sobre las que tienen fechas.
// Las que no tienen fechas no se cuentan como cumplidas ni como incumplidas: se informan aparte.
export function planCompliance(items: ScheduleLike[]): Compliance {
  const open = items.filter(isOpen)
  const count = (health: InitiativeHealth) => open.filter(item => item.health === health).length
  const result = { total: open.length, onTrack: count('on_time'), dueSoon: count('due_soon'), completed: count('completed'), late: count('late'), blocked: count('blocked'), noDates: count('no_dates') }
  const measured = result.total - result.noDates
  const good = result.onTrack + result.dueSoon + result.completed
  return { ...result, measured, pct: measured > 0 ? Math.round((good / measured) * 100) : null }
}

export function riskInitiatives(items: ScheduleLike[]) {
  const rank = { blocked: 0, late: 1 } as Record<string, number>
  const maxLate = (item: ScheduleLike) => Math.max(0, ...item.milestones.map(view => view.lateDays))
  return items
    .filter(item => isOpen(item) && (item.health === 'blocked' || item.health === 'late'))
    .sort((a, b) => rank[a.health] - rank[b.health] || maxLate(b) - maxLate(a))
}

export type StageRow = { key: string; categoryId: string | null; ownerId: string | null; counts: Partial<Record<StageKey, number>>; total: number; items: ScheduleLike[] }

// Procesos por categoría y etapa. La persona se muestra por categoría: el responsable efectivo de cada iniciativa.
export function stageMatrix(items: ScheduleLike[], assignments: Assignments, by: 'category' | 'owner' = 'category'): StageRow[] {
  const rows = new Map<string, StageRow>()
  for (const item of items.filter(isOpen)) {
    const ownerId = effectiveOwner(item.initiative, assignments).userId
    const categoryId = item.initiative.category_id ?? null
    const key = by === 'category' ? categoryId || 'sin_categoria' : ownerId || 'sin_responsable'
    const row = rows.get(key) || { key, categoryId: by === 'category' ? categoryId : null, ownerId: by === 'owner' ? ownerId : null, counts: {}, total: 0, items: [] }
    const stage = currentStage(item)
    row.counts[stage] = (row.counts[stage] || 0) + 1
    row.total += 1
    row.items.push(item)
    rows.set(key, row)
  }
  return Array.from(rows.values()).sort((a, b) => b.total - a.total)
}

export type PersonLoad = { userId: string | null; owner: number; backup: number; late: number; blocked: number; dueSoon: number }

// Carga por persona (responsable efectivo y suplente). "Sin responsable" se muestra como fila propia, no se oculta.
export function personLoad(items: ScheduleLike[], assignments: Assignments): PersonLoad[] {
  const rows = new Map<string, PersonLoad>()
  const touch = (id: string | null) => {
    const key = id || 'sin_responsable'
    const row = rows.get(key) || { userId: id, owner: 0, backup: 0, late: 0, blocked: 0, dueSoon: 0 }
    rows.set(key, row)
    return row
  }
  const lookup = (id: string) => (assignments instanceof Map ? assignments.get(id) : assignments[id])
  for (const item of items.filter(isOpen)) {
    const owner = touch(effectiveOwner(item.initiative, assignments).userId)
    owner.owner += 1
    if (item.health === 'late') owner.late += 1
    if (item.health === 'blocked') owner.blocked += 1
    if (item.health === 'due_soon') owner.dueSoon += 1
    const backupId = item.initiative.backup_user_id || (item.initiative.category_id ? lookup(item.initiative.category_id)?.backup_user_id : null)
    if (backupId) touch(backupId).backup += 1
  }
  return Array.from(rows.values()).sort((a, b) => b.owner - a.owner || b.backup - a.backup)
}

export type MilestoneEntry = { item: ScheduleLike; view: MilestoneView }

// Hitos aún no cumplidos con fecha comprometida dentro de la ventana. Los atrasados no se incluyen: tienen su propia lista.
export function upcomingMilestones(items: ScheduleLike[], today: string, days = 30): MilestoneEntry[] {
  const limit = addDays(today, days)
  return items
    .filter(isOpen)
    .flatMap(item => item.milestones.filter(view => view.status !== 'completed' && view.status !== 'blocked' && view.committed_date && view.committed_date >= today && view.committed_date <= limit).map(view => ({ item, view })))
    .sort((a, b) => String(a.view.committed_date).localeCompare(String(b.view.committed_date)))
}

export function milestonesByStatus(items: ScheduleLike[], status: 'late' | 'blocked'): MilestoneEntry[] {
  return items
    .filter(isOpen)
    .flatMap(item => item.milestones.filter(view => view.status === status).map(view => ({ item, view })))
    .sort((a, b) => b.view.lateDays - a.view.lateDays)
}

export const daysFrom = (today: string, date: string | null) => (date ? daysBetween(today, date) : null)
