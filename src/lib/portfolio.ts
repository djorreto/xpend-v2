// Etapa 2: categorías de abastecimiento, responsables y equipos de Procurement.
// Funciones puras (sin acceso a datos): la pantalla y las pruebas usan la misma lógica.
// Procurement Team (quién compra) es distinto de departments (qué gerencia solicita).

export type PortfolioScope = 'all' | 'mine' | 'team' | 'area'

export type Category = {
  id: string
  name: string
  parent_id: string | null
  source: 'taxonomia_spend' | 'plan' | 'manual'
  taxonomy_ref: string | null
  is_active: boolean
}

export type CategoryAssignment = {
  category_id: string
  manager_user_id: string | null
  backup_user_id: string | null
  team_id: string | null
}

export type TeamMember = { team_id: string; user_id: string; member_role: 'lead' | 'member' }
export type Team = { id: string; name: string; description: string | null; lead_user_id: string | null; is_active: boolean }

export type PlanLike = {
  id: string
  title?: string | null
  category?: string | null
  category_id?: string | null
  department_id?: string | null
  responsible_user_id?: string | null
  backup_user_id?: string | null
  team_id?: string | null
  status?: string | null
}

export const PORTFOLIO_LABELS = {
  all: 'Todo el plan',
  mine: 'Mi portafolio',
  team: 'Mi equipo',
  area: 'Área solicitante',
  noOwner: 'Sin responsable',
  noCategory: 'Sin categoría vinculada',
  categoryManager: 'Category Manager',
  backup: 'Suplente',
} as const

export function normalizeName(value: string | null | undefined) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export type LinkSuggestion =
  | { kind: 'exact'; planId: string; categoryId: string }
  | { kind: 'ambiguous'; planId: string; candidates: string[] }
  | { kind: 'unmatched'; planId: string }

// Sugiere (nunca aplica) el vínculo entre la categoría escrita a mano en una iniciativa y una categoría estable.
// Solo hay coincidencia "exacta" con el mismo nombre normalizado; coincidencias parciales son ambiguas y requieren a una persona.
export function suggestCategoryLinks(plans: PlanLike[], categories: Category[]): LinkSuggestion[] {
  const active = categories.filter(category => category.is_active)
  const exact = new Map<string, Category[]>()
  for (const category of active) {
    const key = normalizeName(category.name)
    exact.set(key, [...(exact.get(key) || []), category])
  }
  const out: LinkSuggestion[] = []
  for (const plan of plans) {
    if (plan.category_id) continue
    const key = normalizeName(plan.category)
    if (!key) {
      out.push({ kind: 'unmatched', planId: plan.id })
      continue
    }
    const hits = exact.get(key) || []
    if (hits.length === 1) {
      out.push({ kind: 'exact', planId: plan.id, categoryId: hits[0].id })
      continue
    }
    const partial = active.filter(category => {
      const name = normalizeName(category.name)
      return name.length >= 4 && (key.includes(name) || name.includes(key))
    })
    if (hits.length > 1 || partial.length > 0) {
      out.push({ kind: 'ambiguous', planId: plan.id, candidates: (hits.length ? hits : partial).map(category => category.id) })
    } else {
      out.push({ kind: 'unmatched', planId: plan.id })
    }
  }
  return out
}

// Quién es responsable efectivo de una iniciativa: el asignado a ella; si no lo hay, el Category Manager de su categoría.
export function effectiveOwner(plan: PlanLike, assignments: Map<string, CategoryAssignment> | Record<string, CategoryAssignment>) {
  const lookup = (id: string) => (assignments instanceof Map ? assignments.get(id) : assignments[id])
  if (plan.responsible_user_id) return { userId: plan.responsible_user_id, source: 'iniciativa' as const }
  const fromCategory = plan.category_id ? lookup(plan.category_id)?.manager_user_id : null
  if (fromCategory) return { userId: fromCategory, source: 'categoria' as const }
  return { userId: null, source: 'sin_responsable' as const }
}

export type ScopeContext = {
  userId: string
  teamIds: string[]
  areaId?: string | null
  assignments: Map<string, CategoryAssignment> | Record<string, CategoryAssignment>
}

// Filtros Mi portafolio / Equipo / Área. "Mi portafolio" incluye lo que la persona tiene como responsable, suplente
// o Category Manager de la categoría; no oculta nada a quien no filtra.
export function filterByScope<T extends PlanLike>(plans: T[], scope: PortfolioScope, context: ScopeContext): T[] {
  if (scope === 'all') return plans
  const lookup = (id: string) => (context.assignments instanceof Map ? context.assignments.get(id) : context.assignments[id])
  return plans.filter(plan => {
    if (scope === 'mine') {
      const category = plan.category_id ? lookup(plan.category_id) : undefined
      return (
        plan.responsible_user_id === context.userId ||
        plan.backup_user_id === context.userId ||
        category?.manager_user_id === context.userId ||
        category?.backup_user_id === context.userId
      )
    }
    if (scope === 'team') {
      const category = plan.category_id ? lookup(plan.category_id) : undefined
      const team = plan.team_id || category?.team_id
      return !!team && context.teamIds.includes(team)
    }
    return !!context.areaId && plan.department_id === context.areaId
  })
}

export type PortfolioGap = { withoutOwner: PlanLike[]; withoutCategory: PlanLike[]; withoutBackup: PlanLike[] }

// Iniciativas abiertas con huecos de asignación (para Inicio y el Plan). Cerradas o canceladas no cuentan.
export function assignmentGaps(plans: PlanLike[], assignments: Map<string, CategoryAssignment> | Record<string, CategoryAssignment>): PortfolioGap {
  const open = plans.filter(plan => plan.status !== 'completed' && plan.status !== 'cancelled')
  const lookup = (id: string) => (assignments instanceof Map ? assignments.get(id) : assignments[id])
  return {
    withoutOwner: open.filter(plan => !effectiveOwner(plan, assignments).userId),
    withoutCategory: open.filter(plan => !plan.category_id),
    withoutBackup: open.filter(plan => !plan.backup_user_id && !(plan.category_id && lookup(plan.category_id)?.backup_user_id)),
  }
}

export type WorkloadRow = { userId: string; initiatives: number; asBackup: number }

export function workloadByPerson(plans: PlanLike[], assignments: Map<string, CategoryAssignment> | Record<string, CategoryAssignment>): WorkloadRow[] {
  const rows = new Map<string, WorkloadRow>()
  const touch = (id: string) => {
    const row = rows.get(id) || { userId: id, initiatives: 0, asBackup: 0 }
    rows.set(id, row)
    return row
  }
  const lookup = (id: string) => (assignments instanceof Map ? assignments.get(id) : assignments[id])
  for (const plan of plans) {
    if (plan.status === 'completed' || plan.status === 'cancelled') continue
    const owner = effectiveOwner(plan, assignments).userId
    if (owner) touch(owner).initiatives += 1
    const backup = plan.backup_user_id || (plan.category_id ? lookup(plan.category_id)?.backup_user_id : null)
    if (backup) touch(backup).asBackup += 1
  }
  return Array.from(rows.values()).sort((a, b) => b.initiatives - a.initiatives)
}

export type HistoryEntry = {
  id: string
  entity_type: 'category' | 'initiative'
  entity_id: string
  role_kind: 'manager' | 'backup' | 'responsible' | 'team' | 'category'
  from_value: string | null
  to_value: string | null
  reason: string | null
  changed_by: string | null
  changed_at: string
}

const ROLE_KIND_LABELS: Record<HistoryEntry['role_kind'], string> = {
  manager: 'Category Manager',
  backup: 'Suplente',
  responsible: 'Responsable',
  team: 'Equipo',
  category: 'Categoría',
}

export function describeHistory(entry: HistoryEntry, names: Record<string, string>) {
  const show = (id: string | null) => (id ? names[id] || 'Valor eliminado' : 'Sin asignar')
  const kind = ROLE_KIND_LABELS[entry.role_kind]
  const verb = entry.from_value ? 'reasignado' : 'asignado'
  return `${kind} ${verb}: ${show(entry.from_value)} → ${show(entry.to_value)}${entry.reason ? ` (${entry.reason})` : ''}`
}
