// «Lo que requiere tu atención» (gerencia) y «Qué hago hoy» (comprador). Reglas determinísticas sobre registros reales:
// cada alerta dice por qué aparece y a dónde ir. No hay IA ni datos de pantalla.

import { daysBetween, viewTasks, type DeliverableRow, type Fact, type TaskRow, type TaskView } from './project.ts'
import type { MethodologyRules } from './methodology.ts'

export type AttentionProject = {
  id: string
  title: string
  owner_id: string | null
  status: string
  sourcing_plan_id: string
  start_date: string | null
  created_at: string
  methodology_kind: string | null
  methodology_snapshot: { rules?: Partial<MethodologyRules> } | null
}
export type AttentionInput = {
  today: string
  projects: AttentionProject[]
  tasks: TaskRow[]
  deliverables: DeliverableRow[]
  facts: Map<string, Fact[]>
  approvals: { id: string; project_id: string | null; subject_kind: string; subject_id: string; requested_by: string; approver_id: string; status: string; created_at: string }[]
  baselines: { project_id: string; status: string }[]
  lastActivity: Map<string, string>
  contracts: { id: string; name: string | null; code: string | null; status: string; ends_on: string | null; owner_id: string | null }[]
  relations: { from_contract_id: string }[]
  projectContracts: { contract_id: string; project_id: string; role: string }[]
  initiatives: { id: string; title: string | null; status: string | null; responsible_user_id: string | null; projected_savings_amount: number | null; currency: string | null; planned_end_date: string | null; is_spot?: boolean | null }[]
  savings: { id: string; sourcing_plan_id: string | null; status: string; declared_at: string | null; validated_amount: number | null; currency: string | null }[]
  names: Map<string, string>
}

export type AttentionRule =
  | 'late_project' | 'milestone_at_risk' | 'no_owner' | 'stalled_approval' | 'unbalanced_load' | 'expiring_contract'
  | 'missing_baseline' | 'missing_documents' | 'pending_savings' | 'low_capture' | 'no_activity'

export const RULE_LABEL: Record<AttentionRule, string> = {
  late_project: 'Proyectos atrasados',
  milestone_at_risk: 'Hitos en riesgo',
  no_owner: 'Sin responsable',
  stalled_approval: 'Aprobaciones detenidas',
  unbalanced_load: 'Carga desbalanceada',
  expiring_contract: 'Contratos por vencer sin renovación',
  missing_baseline: 'Sin línea base aprobada',
  missing_documents: 'Entregables sin documento',
  pending_savings: 'Ahorros por validar',
  low_capture: 'Captura baja de ahorro',
  no_activity: 'Sin actividad reciente',
}

export type Severity = 'alta' | 'media'
export type AttentionItem = { id: string; rule: AttentionRule; severity: Severity; title: string; why: string; action: { label: string; href: string } }

const ACTIVE_PROJECT = ['planned', 'active', 'on_hold']
const STALLED_APPROVAL_DAYS = 3
const EXPIRY_DAYS = 120
const NO_ACTIVITY_DAYS = 14
const PENDING_SAVINGS_DAYS = 7
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
const day = (value: string | null | undefined) => (value ? value.slice(0, 10) : null)
const href = (project: string, tab?: string, extra = '') => `/proyectos/${project}${tab ? `?tab=${tab}${extra}` : ''}`

function viewsByProject(input: AttentionInput) {
  const out = new Map<string, TaskView[]>()
  for (const project of input.projects) {
    out.set(project.id, viewTasks(input.tasks.filter(task => task.project_id === project.id), input.facts.get(project.id) || [], input.today))
  }
  return out
}

const topLevel = (views: TaskView[]) => views.filter(view => !view.parent_id && view.state !== 'na')

export function managerAttention(input: AttentionInput): AttentionItem[] {
  const out: AttentionItem[] = []
  const active = input.projects.filter(project => ACTIVE_PROJECT.includes(project.status))
  const views = viewsByProject(input)
  const name = (id: string | null) => (id ? input.names.get(id) || 'Sin nombre' : 'sin responsable')

  for (const project of active) {
    const main = topLevel(views.get(project.id) || [])
    const late = main.filter(view => view.state === 'late').sort((a, b) => b.lateDays - a.lateDays)
    if (late.length) {
      out.push({ id: `late-${project.id}`, rule: 'late_project', severity: late[0].lateDays > 7 || late.length >= 3 ? 'alta' : 'media', title: project.title,
        why: `${plural(late.length, 'actividad atrasada', 'actividades atrasadas')}; la más antigua, «${late[0].title}», venció hace ${plural(late[0].lateDays, 'día', 'días')}.`,
        action: { label: 'Abrir Gantt', href: href(project.id, 'gantt') } })
    }
    const risk = main.filter(view => (view.kind !== 'task' || view.event_key) && !view.done && view.state !== 'late' && view.committed_end && daysBetween(input.today, view.committed_end) <= 7)
    for (const milestone of risk.slice(0, 2)) {
      const notStarted = !milestone.actual_start && milestone.status === 'pending'
      if (milestone.state !== 'at_risk' && milestone.state !== 'blocked' && !notStarted) continue
      out.push({ id: `risk-${milestone.id}`, rule: 'milestone_at_risk', severity: milestone.state === 'blocked' ? 'alta' : 'media', title: `${milestone.title} · ${project.title}`,
        why: `Vence en ${plural(Math.max(0, daysBetween(input.today, milestone.committed_end!)), 'día', 'días')} y ${milestone.state === 'blocked' ? 'está bloqueado' : 'no ha comenzado'}${milestone.event_key ? '; se cumple con el registro real del proceso' : ''}.`,
        action: { label: 'Ver hito', href: href(project.id, 'tablero', `&tarea=${milestone.id}`) } })
    }
    if (!project.owner_id) {
      out.push({ id: `owner-${project.id}`, rule: 'no_owner', severity: 'alta', title: project.title, why: 'El proyecto no tiene responsable: nadie recibe sus atrasos ni sus aprobaciones.', action: { label: 'Asignar', href: href(project.id, 'resumen') } })
    } else {
      const due = main.filter(view => !view.done && !view.assignee_id && view.committed_start && view.committed_start <= input.today)
      if (due.length) out.push({ id: `unassigned-${project.id}`, rule: 'no_owner', severity: 'media', title: project.title, why: `${plural(due.length, 'actividad que ya debía comenzar no tiene', 'actividades que ya debían comenzar no tienen')} responsable.`, action: { label: 'Asignar', href: href(project.id, 'tablero') } })
    }

    const rules = project.methodology_snapshot?.rules || {}
    const approvedBaseline = input.baselines.some(item => item.project_id === project.id && item.status === 'approved')
    const published = (input.facts.get(project.id) || []).find(fact => fact.event_key === 'rfx_published')
    if (rules.baselineRequired && !approvedBaseline) {
      const rfxOut = !!published && published.done_count > 0
      const age = daysBetween(day(project.start_date) || day(project.created_at)!, input.today)
      if (rfxOut || (rules.baselineApproval === 'formal' && age >= 30)) {
        out.push({ id: `baseline-${project.id}`, rule: 'missing_baseline', severity: rfxOut ? 'alta' : 'media', title: project.title,
          why: rfxOut
            ? `Ya hay un proceso publicado y no existe línea base aprobada: el ahorro no podrá validarse${rules.baselineApproval === 'formal' ? ' (la metodología exige una línea base formal antes de usarla)' : ''}.`
            : `Lleva ${age} días y la metodología exige una línea base formal aprobada antes de publicar.`,
          action: { label: 'Preparar línea base', href: href(project.id, 'ahorro') } })
      }
    }

    const tasksByDeliverable = new Map(main.filter(view => view.deliverable_key).map(view => [view.deliverable_key as string, view]))
    const missing = input.deliverables.filter(item => item.project_id === project.id && item.document_required && ['pending', 'rejected'].includes(item.status)).filter(item => {
      const task = tasksByDeliverable.get(item.deliverable_key)
      const due = task?.committed_end || item.due_date
      return !!due && daysBetween(input.today, due) <= 7
    })
    if (missing.length) {
      out.push({ id: `docs-${project.id}`, rule: 'missing_documents', severity: missing.some(item => (tasksByDeliverable.get(item.deliverable_key)?.state === 'late')) ? 'alta' : 'media', title: project.title,
        why: `${plural(missing.length, 'entregable', 'entregables')} sin documento vigente cerca de su fecha: ${missing.slice(0, 3).map(item => `«${item.title}»`).join(', ')}${missing.length > 3 ? '…' : ''}.`,
        action: { label: 'Ver entregables', href: href(project.id, 'entregables') } })
    }

    const last = input.lastActivity.get(project.id) || project.created_at
    const idle = daysBetween(day(last)!, input.today)
    if (project.status !== 'on_hold' && idle >= NO_ACTIVITY_DAYS && main.some(view => !view.done)) {
      out.push({ id: `idle-${project.id}`, rule: 'no_activity', severity: 'media', title: project.title, why: `Sin movimientos registrados hace ${idle} días (tareas, comentarios, documentos ni aprobaciones).`, action: { label: 'Ver actividad', href: href(project.id, 'actividad') } })
    }
  }

  for (const request of input.approvals.filter(item => item.status === 'pending')) {
    const age = daysBetween(day(request.created_at)!, input.today)
    if (age < STALLED_APPROVAL_DAYS) continue
    const project = input.projects.find(item => item.id === request.project_id)
    out.push({ id: `approval-${request.id}`, rule: 'stalled_approval', severity: age >= 7 ? 'alta' : 'media', title: project?.title || 'Aprobación',
      why: `${request.subject_kind === 'baseline' ? 'Una línea base' : 'Un entregable'} espera la decisión de ${name(request.approver_id)} hace ${age} días.`,
      action: { label: 'Ver aprobación', href: project ? href(project.id, request.subject_kind === 'baseline' ? 'ahorro' : 'entregables') : '/dashboard' } })
  }

  const load = new Map<string, { open: number; late: number }>()
  for (const project of active) {
    for (const view of topLevel(views.get(project.id) || [])) {
      if (view.done || !view.assignee_id) continue
      const entry = load.get(view.assignee_id) || { open: 0, late: 0 }
      entry.open += 1
      if (view.state === 'late') entry.late += 1
      load.set(view.assignee_id, entry)
    }
  }
  if (load.size >= 2) {
    const average = Array.from(load.values()).reduce((sum, item) => sum + item.open, 0) / load.size
    for (const [person, entry] of Array.from(load.entries())) {
      if (entry.open >= Math.max(8, average * 1.6) || entry.late >= 3) {
        out.push({ id: `load-${person}`, rule: 'unbalanced_load', severity: entry.late >= 3 ? 'alta' : 'media', title: name(person),
          why: `${plural(entry.open, 'actividad abierta', 'actividades abiertas')} (promedio del equipo: ${average.toFixed(1)})${entry.late ? `, ${entry.late} atrasadas` : ''}.`,
          action: { label: 'Ver plan anual', href: `/plan-anual?vista=gantt` } })
      }
    }
  }

  const renewed = new Set(input.relations.map(item => item.from_contract_id))
  const covered = new Set(input.projectContracts.filter(item => item.role === 'affected' && input.projects.some(project => project.id === item.project_id && ACTIVE_PROJECT.includes(project.status))).map(item => item.contract_id))
  for (const contract of input.contracts) {
    if (contract.status !== 'active' || !contract.ends_on || renewed.has(contract.id) || covered.has(contract.id)) continue
    const left = daysBetween(input.today, contract.ends_on)
    if (left < 0 || left > EXPIRY_DAYS) continue
    out.push({ id: `contract-${contract.id}`, rule: 'expiring_contract', severity: left <= 60 ? 'alta' : 'media', title: contract.name || contract.code || 'Contrato',
      why: `Vence en ${plural(left, 'día', 'días')} y no tiene renovación, reemplazo ni un proyecto de sourcing que lo cubra.`,
      action: { label: 'Ver contrato', href: `/contratos/${contract.id}` } })
  }

  for (const saving of input.savings) {
    if (saving.status !== 'declared' || !saving.declared_at) continue
    const age = daysBetween(day(saving.declared_at)!, input.today)
    if (age < PENDING_SAVINGS_DAYS) continue
    const plan = input.initiatives.find(item => item.id === saving.sourcing_plan_id)
    out.push({ id: `saving-${saving.id}`, rule: 'pending_savings', severity: age >= 21 ? 'alta' : 'media', title: plan?.title || 'Ahorro declarado', why: `Ahorro declarado hace ${age} días que nadie ha validado ni devuelto.`, action: { label: 'Validar ahorros', href: '/ahorros' } })
  }

  for (const plan of input.initiatives) {
    if (plan.is_spot || !['planned', 'in_progress'].includes(plan.status || '') || !plan.projected_savings_amount || !plan.planned_end_date) continue
    const left = daysBetween(input.today, plan.planned_end_date)
    if (left > 60) continue
    const validated = input.savings.filter(item => item.sourcing_plan_id === plan.id && item.status === 'validated' && (item.currency || plan.currency) === plan.currency).reduce((sum, item) => sum + Number(item.validated_amount || 0), 0)
    const share = validated / Number(plan.projected_savings_amount)
    if (share >= 0.5) continue
    out.push({ id: `capture-${plan.id}`, rule: 'low_capture', severity: left < 0 ? 'alta' : 'media', title: plan.title || 'Iniciativa',
      why: `${left < 0 ? `Su término planificado pasó hace ${-left} días` : `Termina en ${left} días`} y lleva validado el ${Math.round(share * 100)}% del ahorro proyectado (${plan.currency || 'sin moneda'}).`,
      action: { label: 'Abrir iniciativa', href: `/sourcing-plan/${plan.id}` } })
  }
  for (const plan of input.initiatives) {
    if (plan.is_spot || !['planned', 'in_progress'].includes(plan.status || '') || plan.responsible_user_id) continue
    out.push({ id: `plan-owner-${plan.id}`, rule: 'no_owner', severity: 'media', title: plan.title || 'Iniciativa', why: 'La iniciativa del plan no tiene responsable asignado.', action: { label: 'Asignar', href: `/sourcing-plan/${plan.id}` } })
  }

  const order: Record<Severity, number> = { alta: 0, media: 1 }
  return out.sort((a, b) => order[a.severity] - order[b.severity])
}

export type TodayItem = { id: string; title: string; detail: string; href: string }
export type BuyerToday = {
  today: TodayItem[]
  late: TodayItem[]
  dependsOnMe: TodayItem[]
  waiting: TodayItem[]
  missingDeliverables: TodayItem[]
  nextMilestone: TodayItem | null
  toApprove: TodayItem[]
  continueWith: TodayItem | null
}

export function buyerToday(input: AttentionInput, me: string, myLastActivity?: { project_id: string; summary: string; at: string } | null): BuyerToday {
  const result: BuyerToday = { today: [], late: [], dependsOnMe: [], waiting: [], missingDeliverables: [], nextMilestone: null, toApprove: [], continueWith: null }
  const views = viewsByProject(input)
  const active = input.projects.filter(project => ACTIVE_PROJECT.includes(project.status))
  const name = (id: string | null) => (id ? input.names.get(id) || 'otra persona' : 'sin responsable')
  let milestone: { view: TaskView; project: AttentionProject } | null = null

  for (const project of active) {
    const all = views.get(project.id) || []
    const main = topLevel(all)
    const byId = new Map(all.map(view => [view.id, view]))
    const mine = main.filter(view => view.assignee_id === me && !view.done)
    for (const view of mine) {
      const item = { id: view.id, title: view.title, detail: project.title, href: href(project.id, 'tablero', `&tarea=${view.id}`) }
      if (view.state === 'late') result.late.push({ ...item, detail: `${project.title} · venció hace ${plural(view.lateDays, 'día', 'días')}` })
      else if (view.state === 'in_progress' || view.state === 'at_risk' || view.state === 'blocked' || (view.committed_start && view.committed_start <= input.today)) result.today.push({ ...item, detail: `${project.title} · ${view.state === 'blocked' ? 'bloqueada' : view.committed_end ? `vence ${view.committed_end}` : 'en curso'}` })
      const blockers = view.depends_on.map(id => byId.get(id)).filter((dep): dep is TaskView => !!dep && !dep.done && dep.state !== 'na' && dep.assignee_id !== me)
      if (blockers.length) result.waiting.push({ ...item, id: `wait-${view.id}`, detail: `Esperas ${blockers.map(dep => `«${dep.title}» (${dep.event_key ? 'registro del proceso' : name(dep.assignee_id)})`).join(', ')}` })
      const dependents = main.filter(other => other.assignee_id !== me && !other.done && other.depends_on.includes(view.id))
      if (dependents.length) result.dependsOnMe.push({ ...item, id: `dep-${view.id}`, detail: `${project.title} · detiene ${plural(dependents.length, 'actividad', 'actividades')} de ${Array.from(new Set(dependents.map(other => name(other.assignee_id)))).join(', ')}` })
    }
    const involved = project.owner_id === me || main.some(view => view.assignee_id === me)
    if (!involved) continue
    const taskOf = new Map(main.filter(view => view.deliverable_key).map(view => [view.deliverable_key as string, view]))
    for (const item of input.deliverables.filter(row => row.project_id === project.id && row.document_required && ['pending', 'rejected'].includes(row.status))) {
      const task = taskOf.get(item.deliverable_key)
      const due = task?.committed_end || item.due_date
      if ((item.owner_id === me || task?.assignee_id === me || project.owner_id === me) && due && daysBetween(input.today, due) <= 10) {
        result.missingDeliverables.push({ id: item.id, title: item.title, detail: `${project.title} · ${item.status === 'rejected' ? 'rechazado, falta nueva versión' : `sin documento, vence ${due}`}`, href: href(project.id, 'entregables', `&entregable=${item.id}`) })
      }
    }
    const next = main.find(view => !view.done && (view.kind !== 'task' || view.event_key) && view.committed_end)
    if (next && (!milestone || (next.committed_end as string) < (milestone.view.committed_end as string))) milestone = { view: next, project }
  }
  if (milestone) result.nextMilestone = { id: milestone.view.id, title: milestone.view.title, detail: `${milestone.project.title} · ${milestone.view.committed_end}`, href: href(milestone.project.id, 'gantt') }
  for (const request of input.approvals.filter(item => item.status === 'pending' && item.approver_id === me)) {
    const project = input.projects.find(item => item.id === request.project_id)
    const subject = request.subject_kind === 'deliverable' ? input.deliverables.find(item => item.id === request.subject_id)?.title : 'Línea base'
    result.toApprove.push({ id: request.id, title: subject || 'Documento', detail: `${project?.title || ''} · pedido por ${name(request.requested_by)}`, href: project ? href(project.id, request.subject_kind === 'baseline' ? 'ahorro' : 'entregables') : '/dashboard' })
  }
  for (const request of input.approvals.filter(item => item.status === 'pending' && item.requested_by === me)) {
    const project = input.projects.find(item => item.id === request.project_id)
    result.waiting.push({ id: `appr-${request.id}`, title: request.subject_kind === 'baseline' ? 'Línea base' : input.deliverables.find(item => item.id === request.subject_id)?.title || 'Documento', detail: `Espera la aprobación de ${name(request.approver_id)}`, href: project ? href(project.id, request.subject_kind === 'baseline' ? 'ahorro' : 'entregables') : '/dashboard' })
  }
  if (myLastActivity) {
    const project = input.projects.find(item => item.id === myLastActivity.project_id)
    if (project) result.continueWith = { id: project.id, title: project.title, detail: myLastActivity.summary, href: href(project.id) }
  }
  result.late.sort((a, b) => a.detail.localeCompare(b.detail))
  return result
}
