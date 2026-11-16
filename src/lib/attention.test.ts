import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buyerToday, managerAttention, type AttentionInput } from './attention.ts'
import type { DeliverableRow, TaskRow } from './project.ts'

const today = '2027-03-15'
const task = (id: string, patch: Partial<TaskRow>): TaskRow => ({
  id, project_id: 'p1', parent_id: null, template_task_key: id, stage_key: 'E1', seq: Number(id.replace(/\D/g, '')) || 1, code: id, title: `Tarea ${id}`, description: null,
  kind: 'task', event_key: null, deliverable_key: null, role: 'buyer', optional: false, is_custom: false, not_applicable: false, na_reason: null,
  status: 'pending', assignee_id: 'ana', collaborator_ids: [], priority: 2, depends_on: [], original_start: '2027-03-01', original_end: '2027-03-10',
  committed_start: '2027-03-01', committed_end: '2027-03-10', actual_start: null, actual_end: null, block_cause: null, block_note: null, ...patch,
})
const deliverable = (id: string, patch: Partial<DeliverableRow>): DeliverableRow => ({
  id, project_id: 'p1', deliverable_key: id, title: `Entregable ${id}`, stage_key: 'E1', description: null, requires_approval: true, approver_role: 'manager',
  document_required: true, owner_id: null, status: 'pending', due_date: null, current_version: 0, approved_version: null, approved_by: null, approved_at: null, decision_note: null, ...patch,
})

function input(patch: Partial<AttentionInput> = {}): AttentionInput {
  return {
    today,
    projects: [{ id: 'p1', title: 'Contratación nacional de aseo', owner_id: 'ana', status: 'active', sourcing_plan_id: 'i1', start_date: '2027-01-10', created_at: '2027-01-10T10:00:00Z', methodology_kind: 'complete', methodology_snapshot: { rules: { baselineRequired: true, baselineApproval: 'formal' } } }],
    tasks: [
      task('t1', { status: 'done', actual_end: '2027-03-09' }),
      task('t2', { committed_end: '2027-03-05', depends_on: ['t1'] }),
      task('t3', { kind: 'milestone', event_key: 'rfx_published', committed_start: '2027-03-16', committed_end: '2027-03-18', assignee_id: 'luis', depends_on: ['t2'], deliverable_key: 'bases' }),
    ],
    deliverables: [deliverable('bases', {})],
    facts: new Map([['p1', [{ event_key: 'rfx_published', occurred_at: null, done_count: 0, total_count: 1 }]]]),
    approvals: [{ id: 'a1', project_id: 'p1', subject_kind: 'deliverable', subject_id: 'bases', requested_by: 'ana', approver_id: 'jefa', status: 'pending', created_at: '2027-03-05T10:00:00Z' }],
    baselines: [],
    lastActivity: new Map([['p1', '2027-03-14T10:00:00Z']]),
    contracts: [
      { id: 'c1', name: 'Aseo Santiago', code: null, status: 'active', ends_on: '2027-04-30', owner_id: null },
      { id: 'c2', name: 'Aseo Norte', code: null, status: 'active', ends_on: '2027-04-30', owner_id: null },
      { id: 'c3', name: 'Ascensores', code: null, status: 'active', ends_on: '2027-05-10', owner_id: null },
    ],
    relations: [{ from_contract_id: 'c2' }],
    projectContracts: [{ contract_id: 'c1', project_id: 'p1', role: 'affected' }],
    initiatives: [{ id: 'i1', title: 'Renovación de servicios de aseo 2027', status: 'in_progress', responsible_user_id: 'ana', projected_savings_amount: 1000, currency: 'CLP', planned_end_date: '2027-04-30' }],
    savings: [{ id: 's1', sourcing_plan_id: 'i1', status: 'declared', declared_at: '2027-03-01T10:00:00Z', validated_amount: null, currency: 'CLP' }],
    names: new Map([['ana', 'Ana'], ['luis', 'Luis'], ['jefa', 'Jefa']]),
    ...patch,
  }
}

test('la gerencia ve atrasos, hitos en riesgo, aprobaciones detenidas y contratos sin renovación, con su porqué', () => {
  const items = managerAttention(input())
  const rules = items.map(item => item.rule)
  assert.ok(rules.includes('late_project'))
  assert.ok(rules.includes('milestone_at_risk'))
  assert.ok(rules.includes('stalled_approval'))
  assert.ok(rules.includes('missing_documents'))
  assert.ok(rules.includes('pending_savings'))
  assert.ok(rules.includes('low_capture'))
  const contracts = items.filter(item => item.rule === 'expiring_contract')
  assert.deepEqual(contracts.map(item => item.title), ['Ascensores'], 'el cubierto por un proyecto y el ya renovado no alertan')
  const late = items.find(item => item.rule === 'late_project')!
  assert.match(late.why, /venció hace 10 días/)
  assert.equal(late.action.href, '/proyectos/p1?tab=gantt')
  assert.equal(items[0].severity, 'alta')
  assert.ok(!rules.includes('no_activity'))
})

test('la línea base depende de la metodología del proyecto', () => {
  const formal = managerAttention(input())
  assert.ok(formal.some(item => item.rule === 'missing_baseline'), 'Completa exige línea base formal a los 30 días')
  const light = managerAttention(input({ projects: [{ ...input().projects[0], methodology_kind: 'light', methodology_snapshot: { rules: { baselineRequired: true, baselineApproval: 'simple' } } }] }))
  assert.ok(!light.some(item => item.rule === 'missing_baseline'), 'Light solo alerta cuando ya hay un proceso publicado')
  const published = managerAttention(input({ facts: new Map([['p1', [{ event_key: 'rfx_published', occurred_at: '2027-03-01', done_count: 1, total_count: 1 }]]]) }))
  assert.equal(published.find(item => item.rule === 'missing_baseline')?.severity, 'alta')
  assert.ok(!managerAttention(input({ baselines: [{ project_id: 'p1', status: 'approved' }] })).some(item => item.rule === 'missing_baseline'))
})

test('sin actividad, sin responsable y carga desbalanceada', () => {
  const many = Array.from({ length: 9 }, (_, index) => task(`m${index + 10}`, { assignee_id: 'luis', committed_start: '2027-04-01', committed_end: '2027-05-01' }))
  const items = managerAttention(input({
    projects: [{ ...input().projects[0], owner_id: null }],
    tasks: [...input().tasks, ...many],
    lastActivity: new Map([['p1', '2027-02-01T10:00:00Z']]),
  }))
  assert.ok(items.some(item => item.rule === 'no_owner' && item.severity === 'alta'))
  assert.ok(items.some(item => item.rule === 'no_activity' && /42 días/.test(item.why)))
  const load = items.find(item => item.rule === 'unbalanced_load')
  assert.equal(load?.title, 'Luis')
})

test('el comprador ve su día: atrasos, lo que depende de él, lo que espera y lo que debe aprobar', () => {
  const ana = buyerToday(input(), 'ana', { project_id: 'p1', summary: 'Subiste el anexo técnico', at: '2027-03-14T10:00:00Z' })
  assert.deepEqual(ana.late.map(item => item.id), ['t2'])
  assert.equal(ana.dependsOnMe[0].id, 'dep-t2')
  assert.match(ana.dependsOnMe[0].detail, /Luis/)
  assert.match(ana.waiting.find(item => item.id === 'appr-a1')!.detail, /Jefa/)
  assert.equal(ana.missingDeliverables[0].title, 'Entregable bases')
  assert.equal(ana.nextMilestone?.id, 't3')
  assert.equal(ana.continueWith?.href, '/proyectos/p1')
  const luis = buyerToday(input(), 'luis')
  assert.match(luis.waiting[0].detail, /Esperas «Tarea t2» \(Ana\)/)
  assert.equal(buyerToday(input(), 'jefa').toApprove.length, 1)
})
