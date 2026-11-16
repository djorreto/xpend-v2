import type { SupabaseClient } from '@supabase/supabase-js'
import type { MethodologyDefinition } from './methodology.ts'
import type { DeliverableRow, Fact, TaskRow } from './project.ts'

export type ProjectRow = {
  id: string
  company_id: string
  sourcing_plan_id: string
  category_id: string | null
  code: string | null
  title: string
  description: string | null
  owner_id: string | null
  backup_id: string | null
  priority: number
  status: 'planned' | 'active' | 'on_hold' | 'completed' | 'cancelled'
  template_id: string | null
  template_key: string | null
  template_version: number | null
  methodology_kind: 'light' | 'complete' | 'custom' | null
  methodology_snapshot: MethodologyDefinition
  start_date: string | null
  target_end_date: string | null
  created_at: string
}

export const PROJECT_COLUMNS = 'id, company_id, sourcing_plan_id, category_id, code, title, description, owner_id, backup_id, priority, status, template_id, template_key, template_version, methodology_kind, methodology_snapshot, start_date, target_end_date, created_at'
export const TASK_COLUMNS = 'id, project_id, parent_id, template_task_key, stage_key, seq, code, title, description, kind, event_key, deliverable_key, role, optional, is_custom, not_applicable, na_reason, status, assignee_id, collaborator_ids, priority, depends_on, original_start, original_end, committed_start, committed_end, actual_start, actual_end, block_cause, block_note'
export const DELIVERABLE_COLUMNS = 'id, project_id, deliverable_key, title, stage_key, description, requires_approval, approver_role, document_required, owner_id, status, due_date, current_version, approved_version, approved_by, approved_at, decision_note'

export const PROJECT_STATUS_LABEL: Record<ProjectRow['status'], string> = {
  planned: 'Planificado',
  active: 'En curso',
  on_hold: 'En pausa',
  completed: 'Cerrado',
  cancelled: 'Cancelado',
}
export const METHODOLOGY_LABEL: Record<string, string> = { light: 'Light', complete: 'Completa', custom: 'Personalizada' }

export type ApprovalRequest = {
  id: string
  project_id: string | null
  subject_kind: 'deliverable' | 'baseline'
  subject_id: string
  subject_version: number | null
  requested_by: string
  approver_id: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  request_note: string | null
  decision_note: string | null
  created_at: string
  decided_at: string | null
}

export type ProjectBundle = {
  project: ProjectRow
  initiative: { id: string; title: string; plan_year: number; category_id: string | null; currency: string | null } | null
  tasks: TaskRow[]
  deliverables: DeliverableRow[]
  facts: Fact[]
  approvals: ApprovalRequest[]
}

export async function loadProject(supabase: SupabaseClient, projectId: string): Promise<ProjectBundle | null> {
  const { data: project } = await supabase.from('sourcing_projects').select(PROJECT_COLUMNS).eq('id', projectId).maybeSingle()
  if (!project) return null
  const [initiative, tasks, deliverables, facts, approvals] = await Promise.all([
    supabase.from('sourcing_plans').select('id, title, plan_year, category_id, currency').eq('id', project.sourcing_plan_id).maybeSingle(),
    supabase.from('project_tasks').select(TASK_COLUMNS).eq('project_id', projectId).order('seq'),
    supabase.from('project_deliverables').select(DELIVERABLE_COLUMNS).eq('project_id', projectId),
    supabase.rpc('project_facts', { p_project: projectId }),
    supabase.from('approval_requests').select('id, project_id, subject_kind, subject_id, subject_version, requested_by, approver_id, status, request_note, decision_note, created_at, decided_at').eq('project_id', projectId).order('created_at', { ascending: false }),
  ])
  return {
    project: project as ProjectRow,
    initiative: (initiative.data || null) as ProjectBundle['initiative'],
    tasks: (tasks.data || []) as TaskRow[],
    deliverables: (deliverables.data || []) as DeliverableRow[],
    facts: (facts.data || []) as Fact[],
    approvals: (approvals.data || []) as ApprovalRequest[],
  }
}

export type PortfolioProjects = {
  projects: ProjectRow[]
  tasks: TaskRow[]
  deliverables: DeliverableRow[]
  facts: Map<string, Fact[]>
  approvals: ApprovalRequest[]
}

// Proyectos de un conjunto de iniciativas, con sus tareas y entregables. Los hechos se piden por proyecto (función con RLS).
export async function loadProjectsFor(supabase: SupabaseClient, companyId: string, planIds?: string[]): Promise<PortfolioProjects> {
  let query = supabase.from('sourcing_projects').select(PROJECT_COLUMNS).eq('company_id', companyId).neq('status', 'cancelled').order('created_at').limit(300)
  if (planIds) {
    if (planIds.length === 0) return { projects: [], tasks: [], deliverables: [], facts: new Map(), approvals: [] }
    query = query.in('sourcing_plan_id', planIds)
  }
  const { data } = await query
  const projects = (data || []) as ProjectRow[]
  if (projects.length === 0) return { projects, tasks: [], deliverables: [], facts: new Map(), approvals: [] }
  const ids = projects.map(item => item.id)
  const [tasks, deliverables, approvals, ...facts] = await Promise.all([
    supabase.from('project_tasks').select(TASK_COLUMNS).in('project_id', ids).order('seq').limit(5000),
    supabase.from('project_deliverables').select(DELIVERABLE_COLUMNS).in('project_id', ids).limit(2000),
    supabase.from('approval_requests').select('id, project_id, subject_kind, subject_id, subject_version, requested_by, approver_id, status, request_note, decision_note, created_at, decided_at').eq('company_id', companyId).eq('status', 'pending').limit(500),
    ...ids.map(id => supabase.rpc('project_facts', { p_project: id })),
  ])
  return {
    projects,
    tasks: (tasks.data || []) as TaskRow[],
    deliverables: (deliverables.data || []) as DeliverableRow[],
    facts: new Map(ids.map((id, position) => [id, ((facts[position] as { data: Fact[] | null }).data || []) as Fact[]])),
    approvals: (approvals.data || []) as ApprovalRequest[],
  }
}

export function projectHref(id: string, tab?: string) {
  return `/proyectos/${id}${tab ? `?tab=${tab}` : ''}`
}
