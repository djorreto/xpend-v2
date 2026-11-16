// Proyecto de sourcing: estado efectivo de tareas y entregables, filas del Gantt y siguiente acción.
// Todo se deriva de los registros (project_tasks, project_deliverables, project_facts); nada se inventa en pantalla.

import { STANDARD_EVENTS, type MethodologyDefinition, type StandardEvent } from './methodology.ts'

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked'
export type TaskRow = {
  id: string
  project_id: string
  parent_id: string | null
  template_task_key: string | null
  stage_key: string
  seq: number
  code: string | null
  title: string
  description: string | null
  kind: 'task' | 'milestone' | 'approval'
  event_key: StandardEvent | null
  deliverable_key: string | null
  role: string | null
  optional: boolean
  is_custom: boolean
  not_applicable: boolean
  na_reason: string | null
  status: TaskStatus
  assignee_id: string | null
  collaborator_ids: string[]
  priority: number
  depends_on: string[]
  original_start: string | null
  original_end: string | null
  committed_start: string | null
  committed_end: string | null
  actual_start: string | null
  actual_end: string | null
  block_cause: string | null
  block_note: string | null
}

export type DeliverableRow = {
  id: string
  project_id: string
  deliverable_key: string
  title: string
  stage_key: string
  description: string | null
  requires_approval: boolean
  approver_role: string | null
  document_required: boolean
  owner_id: string | null
  status: 'pending' | 'draft' | 'in_review' | 'approved' | 'rejected' | 'not_applicable'
  due_date: string | null
  current_version: number
  approved_version: number | null
  approved_by: string | null
  approved_at: string | null
  decision_note: string | null
}

export type Fact = { event_key: string; occurred_at: string | null; done_count: number; total_count: number }

export type EffectiveState = 'done' | 'in_progress' | 'blocked' | 'late' | 'at_risk' | 'pending' | 'na'

export const STATE_LABEL: Record<EffectiveState, string> = {
  done: 'Completada',
  in_progress: 'En curso',
  blocked: 'Bloqueada',
  late: 'Atrasada',
  at_risk: 'En riesgo',
  pending: 'Pendiente',
  na: 'No aplica',
}

export const DELIVERABLE_LABEL: Record<DeliverableRow['status'], string> = {
  pending: 'Sin documento',
  draft: 'Borrador',
  in_review: 'En aprobación',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  not_applicable: 'No aplica',
}

export const CAUSE_OPTIONS = [
  { id: 'comprador', label: 'Compras' },
  { id: 'aprobador', label: 'Aprobador' },
  { id: 'proveedor', label: 'Proveedor' },
  { id: 'area_solicitante', label: 'Área solicitante' },
  { id: 'externo', label: 'Externo' },
] as const

const RISK_DAYS = 3

export function todayISO(now = new Date()) {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
}

// Un hito con evento se cumple solo con el hecho real. Para eventos de procesos, cuando todos los procesos formales del
// proyecto lo cumplen; para la línea base o el pliego, cuando existe la aprobación.
export function eventDone(fact: Fact | undefined) {
  if (!fact || fact.done_count === 0) return false
  return fact.done_count >= fact.total_count
}

export function eventProgress(fact: Fact | undefined) {
  if (!fact || fact.total_count === 0) return null
  return `${fact.done_count} de ${fact.total_count}`
}

export type TaskView = TaskRow & {
  state: EffectiveState
  done: boolean
  actualEnd: string | null
  lateDays: number
  slipDays: number
  eventLabel: string | null
  eventProgress: string | null
}

export function viewTask(task: TaskRow, facts: Map<string, Fact>, today: string): TaskView {
  const fact = task.event_key ? facts.get(task.event_key) : undefined
  const done = task.event_key ? eventDone(fact) : task.status === 'done'
  const actualEnd = task.event_key ? (done && fact?.occurred_at ? fact.occurred_at.slice(0, 10) : null) : task.actual_end
  let state: EffectiveState
  if (task.not_applicable) state = 'na'
  else if (done) state = 'done'
  else if (task.status === 'blocked') state = 'blocked'
  else if (task.committed_end && task.committed_end < today) state = 'late'
  else if (task.status === 'in_progress' || (task.event_key && fact && fact.done_count > 0)) state = 'in_progress'
  else if (task.committed_end && daysBetween(today, task.committed_end) <= RISK_DAYS && !task.actual_start) state = 'at_risk'
  else state = 'pending'
  const lateDays = state === 'late' && task.committed_end ? daysBetween(task.committed_end, today) : 0
  const reference = actualEnd || task.committed_end
  const slipDays = reference && task.original_end ? daysBetween(task.original_end, reference) : 0
  return {
    ...task,
    state,
    done,
    actualEnd,
    lateDays,
    slipDays,
    eventLabel: task.event_key ? STANDARD_EVENTS[task.event_key] : null,
    eventProgress: task.event_key ? eventProgress(fact) : null,
  }
}

export function viewTasks(tasks: TaskRow[], facts: Fact[], today: string) {
  const map = new Map(facts.map(fact => [fact.event_key, fact]))
  return [...tasks].sort((a, b) => a.seq - b.seq).map(task => viewTask(task, map, today))
}

export type ProjectSummary = {
  total: number
  done: number
  progress: number
  late: number
  blocked: number
  atRisk: number
  na: number
  currentStage: string | null
  nextMilestone: TaskView | null
  slipDays: number
}

export function summarize(views: TaskView[], definition: Pick<MethodologyDefinition, 'stages'>): ProjectSummary {
  const main = views.filter(view => !view.parent_id && view.state !== 'na')
  const done = main.filter(view => view.done).length
  const firstOpen = main.find(view => !view.done)
  const nextMilestone = main.find(view => !view.done && (view.kind === 'milestone' || view.kind === 'approval')) || null
  const last = main.filter(view => view.committed_end).map(view => view.committed_end as string).sort().pop()
  const lastOriginal = main.filter(view => view.original_end).map(view => view.original_end as string).sort().pop()
  return {
    total: main.length,
    done,
    progress: main.length ? Math.round((done / main.length) * 100) : 0,
    late: main.filter(view => view.state === 'late').length,
    blocked: main.filter(view => view.state === 'blocked').length,
    atRisk: main.filter(view => view.state === 'at_risk').length,
    na: views.filter(view => !view.parent_id && view.state === 'na').length,
    currentStage: firstOpen ? definition.stages.find(stage => stage.key === firstOpen.stage_key)?.name || firstOpen.stage_key : null,
    nextMilestone,
    slipDays: last && lastOriginal ? daysBetween(lastOriginal, last) : 0,
  }
}

export type NextAction = { title: string; reason: string; tab: string; taskId?: string; deliverableId?: string }

// Siguiente acción determinística: primero lo bloqueado, luego lo atrasado, luego entregables por aprobar, luego lo que sigue.
export function nextAction(views: TaskView[], deliverables: DeliverableRow[], userId: string | null): NextAction | null {
  const main = views.filter(view => !view.parent_id && view.state !== 'na')
  const blocked = main.find(view => view.state === 'blocked')
  if (blocked) return { title: `Destrabar «${blocked.title}»`, reason: `Está bloqueada${blocked.block_note ? `: ${blocked.block_note}` : ''}. Las tareas que dependen de ella no avanzan.`, tab: 'tablero', taskId: blocked.id }
  const late = main.filter(view => view.state === 'late').sort((a, b) => b.lateDays - a.lateDays)[0]
  if (late) return { title: `Cerrar o reprogramar «${late.title}»`, reason: `Venció hace ${late.lateDays} ${late.lateDays === 1 ? 'día' : 'días'}. Si cambió el plan, reprograma con causa y motivo.`, tab: 'tablero', taskId: late.id }
  const review = deliverables.find(item => item.status === 'in_review')
  if (review) return { title: `Resolver la aprobación de «${review.title}»`, reason: 'El entregable espera una decisión. Sin ella no avanza la etapa.', tab: 'entregables', deliverableId: review.id }
  const rejected = deliverables.find(item => item.status === 'rejected')
  if (rejected) return { title: `Corregir «${rejected.title}»`, reason: `Fue rechazado${rejected.decision_note ? `: ${rejected.decision_note}` : ''}. Sube una nueva versión.`, tab: 'entregables', deliverableId: rejected.id }
  const mine = main.find(view => !view.done && view.assignee_id === userId && !view.event_key)
  const open = mine || main.find(view => !view.done)
  if (!open) return null
  if (open.event_key) return { title: `Registrar en XPEND: ${open.eventLabel}`, reason: 'Este hito se cumple con el registro real del proceso, no a mano.', tab: 'rfx', taskId: open.id }
  return { title: open.title, reason: open.assignee_id ? 'Es la próxima actividad del plan de trabajo.' : 'Es la próxima actividad y no tiene responsable.', tab: 'tablero', taskId: open.id }
}

// ---------------------------------------------------------------- Gantt

export type GanttRow = {
  id: string
  parentId: string | null
  label: string
  meta?: string
  level: number
  start: string | null
  end: string | null
  originalStart?: string | null
  originalEnd?: string | null
  actualEnd?: string | null
  milestone?: boolean
  summary?: boolean
  state: EffectiveState
  owner?: string | null
  href?: string
  depends?: string[]
  progress?: number
}

function span(items: { start: string | null; end: string | null }[]) {
  const starts = items.map(item => item.start).filter(Boolean) as string[]
  const ends = items.map(item => item.end).filter(Boolean) as string[]
  return { start: starts.sort()[0] || null, end: ends.sort().pop() || null }
}

export function rollupState(states: EffectiveState[]): EffectiveState {
  const live = states.filter(state => state !== 'na')
  if (live.length === 0) return 'na'
  if (live.every(state => state === 'done')) return 'done'
  for (const state of ['blocked', 'late', 'at_risk', 'in_progress'] as const) if ((live as string[]).includes(state)) return state
  return live.some(state => state === 'done') ? 'in_progress' : 'pending'
}

export function projectGanttRows(views: TaskView[], definition: Pick<MethodologyDefinition, 'stages'>, person: (id: string | null) => string, projectHref?: string): GanttRow[] {
  const rows: GanttRow[] = []
  for (const stage of definition.stages) {
    const stageTasks = views.filter(view => view.stage_key === stage.key && !view.parent_id)
    if (stageTasks.length === 0) continue
    const range = span(stageTasks.filter(view => view.state !== 'na').map(view => ({ start: view.committed_start, end: view.committed_end })))
    const original = span(stageTasks.filter(view => view.state !== 'na').map(view => ({ start: view.original_start, end: view.original_end })))
    const live = stageTasks.filter(view => view.state !== 'na')
    rows.push({
      id: `stage-${stage.key}`,
      parentId: null,
      label: stage.name,
      meta: `${live.filter(view => view.done).length}/${live.length}`,
      level: 0,
      ...range,
      originalStart: original.start,
      originalEnd: original.end,
      summary: true,
      state: rollupState(stageTasks.map(view => view.state)),
      progress: live.length ? live.filter(view => view.done).length / live.length : 0,
    })
    for (const task of stageTasks) {
      rows.push(taskRow(task, `stage-${stage.key}`, 1, person, projectHref))
      for (const sub of views.filter(view => view.parent_id === task.id)) rows.push(taskRow(sub, task.id, 2, person, projectHref))
    }
  }
  return rows
}

function taskRow(view: TaskView, parentId: string, level: number, person: (id: string | null) => string, projectHref?: string): GanttRow {
  return {
    id: view.id,
    parentId,
    label: view.code ? `${view.code}. ${view.title}` : view.title,
    meta: view.eventProgress ? `${view.eventLabel} · ${view.eventProgress}` : view.eventLabel || undefined,
    level,
    start: view.committed_start,
    end: view.committed_end,
    originalStart: view.original_start,
    originalEnd: view.original_end,
    actualEnd: view.actualEnd,
    milestone: view.kind === 'milestone',
    state: view.state,
    owner: view.assignee_id ? person(view.assignee_id) : null,
    href: projectHref ? `${projectHref}?tab=tablero&tarea=${view.id}` : undefined,
    depends: view.depends_on,
  }
}

// Portafolio: iniciativa → proyecto → etapa. Una iniciativa sin proyecto se muestra con sus hitos del plan (initiative_milestones),
// para no duplicar fechas: cuando existe un proyecto, mandan sus tareas.
export type PortfolioInitiative = {
  id: string
  title: string
  owner: string | null
  milestones: { id: string; label: string; committed_date: string | null; original_date: string | null; actual: string | null; status: string }[]
}
export type PortfolioProject = { id: string; title: string; owner: string | null; initiativeId: string; definition: Pick<MethodologyDefinition, 'stages'>; views: TaskView[] }

const MILESTONE_STATE: Record<string, EffectiveState> = { completed: 'done', blocked: 'blocked', late: 'late', due_soon: 'at_risk', on_time: 'pending', no_date: 'pending' }

export function portfolioGanttRows(initiatives: PortfolioInitiative[], projects: PortfolioProject[]): GanttRow[] {
  const rows: GanttRow[] = []
  for (const initiative of initiatives) {
    const own = projects.filter(project => project.initiativeId === initiative.id)
    const children: GanttRow[] = []
    if (own.length > 0) {
      for (const project of own) {
        const stageRows = projectGanttRows(project.views, project.definition, () => '').filter(row => row.level === 0)
        const live = project.views.filter(view => !view.parent_id && view.state !== 'na')
        const range = span(stageRows)
        const original = span(stageRows.map(row => ({ start: row.originalStart || null, end: row.originalEnd || null })))
        children.push({
          id: `project-${project.id}`, parentId: `initiative-${initiative.id}`, label: project.title, level: 1, ...range,
          originalStart: original.start, originalEnd: original.end, summary: true, owner: project.owner,
          state: rollupState(live.map(view => view.state)), progress: live.length ? live.filter(view => view.done).length / live.length : 0,
          href: `/proyectos/${project.id}?tab=gantt`, meta: `${live.filter(view => view.done).length}/${live.length}`,
        })
        for (const stage of stageRows) children.push({ ...stage, id: `${project.id}-${stage.id}`, parentId: `project-${project.id}`, level: 2, href: `/proyectos/${project.id}?tab=gantt` })
      }
    } else {
      for (const milestone of initiative.milestones.filter(item => item.committed_date)) {
        children.push({
          id: `milestone-${milestone.id}`, parentId: `initiative-${initiative.id}`, label: milestone.label, level: 1,
          start: milestone.committed_date, end: milestone.committed_date, originalStart: milestone.original_date, originalEnd: milestone.original_date,
          actualEnd: milestone.actual, milestone: true, state: MILESTONE_STATE[milestone.status] || 'pending', href: `/sourcing-plan/${initiative.id}`,
        })
      }
    }
    const range = span(children.filter(row => row.level === 1))
    rows.push({
      id: `initiative-${initiative.id}`, parentId: null, label: initiative.title, level: 0, ...range, summary: true, owner: initiative.owner,
      state: rollupState(children.filter(row => row.level === 1).map(row => row.state)),
      progress: children.filter(row => row.level === 1).length ? children.filter(row => row.level === 1 && row.state === 'done').length / children.filter(row => row.level === 1).length : 0,
      href: own.length === 1 ? `/proyectos/${own[0].id}` : `/sourcing-plan/${initiative.id}`,
      meta: own.length ? `${own.length} proyecto${own.length === 1 ? '' : 's'}` : 'Hitos del plan',
    }, ...children)
  }
  return rows
}

// ---------------------------------------------------------------- entregables

export type DeliverableView = DeliverableRow & { overdue: boolean; waitingMe: boolean }

export function viewDeliverables(items: DeliverableRow[], today: string, pendingApproverIds: Map<string, string>, userId: string | null): DeliverableView[] {
  return items.map(item => ({
    ...item,
    overdue: !!item.due_date && item.due_date < today && !['approved', 'not_applicable'].includes(item.status) && !(item.status === 'draft' && !item.requires_approval),
    waitingMe: item.status === 'in_review' && pendingApproverIds.get(item.id) === userId,
  }))
}

// ---------------------------------------------------------------- línea base

export type BaselineLine = { reference_price: number; adjustment_pct: number; projected_qty: number; awarded_price: number | null }

// Ahorro anualizado = Σ [(precio de referencia ajustado − precio adjudicado) × cantidad proyectada]. Solo líneas con precio adjudicado.
export function baselineSavings(lines: BaselineLine[]) {
  let reference = 0
  let awarded = 0
  let savings = 0
  let priced = 0
  for (const line of lines) {
    const adjusted = Number(line.reference_price) * (1 + Number(line.adjustment_pct) / 100)
    reference += adjusted * Number(line.projected_qty)
    if (line.awarded_price != null) {
      priced += 1
      awarded += Number(line.awarded_price) * Number(line.projected_qty)
      savings += (adjusted - Number(line.awarded_price)) * Number(line.projected_qty)
    }
  }
  return { reference, awarded: priced ? awarded : null, savings: priced ? savings : null, priced, lines: lines.length }
}
