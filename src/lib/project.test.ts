import assert from 'node:assert/strict'
import test from 'node:test'
import { LIGHT } from './methodology.ts'
import { baselineSavings, nextAction, projectGanttRows, rollupState, summarize, viewTask, viewTasks, type DeliverableRow, type TaskRow } from './project.ts'

const base: TaskRow = {
  id: 't1', project_id: 'p', parent_id: null, template_task_key: 'l1', stage_key: 'L1', seq: 10, code: '1', title: 'Levantar necesidad', description: null,
  kind: 'task', event_key: null, deliverable_key: null, role: 'buyer', optional: false, is_custom: false, not_applicable: false, na_reason: null,
  status: 'pending', assignee_id: 'u1', collaborator_ids: [], priority: 2, depends_on: [], original_start: '2027-01-04', original_end: '2027-01-08',
  committed_start: '2027-01-04', committed_end: '2027-01-08', actual_start: null, actual_end: null, block_cause: null, block_note: null,
}

test('estado efectivo: atrasada, en riesgo, bloqueada, no aplica y hitos por evento', () => {
  const facts = new Map()
  assert.equal(viewTask(base, facts, '2027-01-10').state, 'late')
  assert.equal(viewTask(base, facts, '2027-01-10').lateDays, 2)
  assert.equal(viewTask(base, facts, '2027-01-06').state, 'at_risk')
  assert.equal(viewTask(base, facts, '2027-01-01').state, 'pending')
  assert.equal(viewTask({ ...base, status: 'blocked' }, facts, '2027-01-10').state, 'blocked')
  assert.equal(viewTask({ ...base, not_applicable: true }, facts, '2027-01-10').state, 'na')
  assert.equal(viewTask({ ...base, status: 'done', actual_end: '2027-01-09' }, facts, '2027-01-20').slipDays, 1)

  const milestone = { ...base, kind: 'milestone' as const, event_key: 'rfx_published' as const, status: 'pending' as const }
  // Un hito con evento no se cumple porque su fila diga «done»: lo cumple el hecho.
  assert.equal(viewTask({ ...milestone, status: 'done' }, facts, '2027-01-01').done, false)
  const partial = new Map([['rfx_published', { event_key: 'rfx_published', occurred_at: '2027-01-05T10:00:00Z', done_count: 1, total_count: 2 }]])
  const view = viewTask(milestone, partial, '2027-01-06')
  assert.equal(view.done, false)
  assert.equal(view.eventProgress, '1 de 2')
  const complete = new Map([['rfx_published', { event_key: 'rfx_published', occurred_at: '2027-01-07T10:00:00Z', done_count: 2, total_count: 2 }]])
  const done = viewTask(milestone, complete, '2027-01-20')
  assert.deepEqual([done.state, done.actualEnd], ['done', '2027-01-07'])
})

test('resumen y siguiente acción: lo bloqueado primero, luego lo atrasado, luego aprobaciones', () => {
  const tasks = [base, { ...base, id: 't2', seq: 20, title: 'Definir referencia', stage_key: 'L1', status: 'blocked' as const, block_note: 'Falta el gasto', committed_end: '2027-02-01' }]
  const views = viewTasks(tasks, [], '2027-01-10')
  const summary = summarize(views, LIGHT)
  assert.deepEqual([summary.total, summary.late, summary.blocked, summary.progress], [2, 1, 1, 0])
  assert.match(nextAction(views, [], 'u1')!.title, /Destrabar/)
  const unblocked = viewTasks([base], [], '2027-01-10')
  assert.match(nextAction(unblocked, [], 'u1')!.title, /reprogramar/)
  const onTime = viewTasks([{ ...base, committed_end: '2027-03-01' }], [], '2027-01-10')
  const review = { id: 'd1', status: 'in_review', title: 'Referencia económica' } as DeliverableRow
  assert.equal(nextAction(onTime, [review], 'u1')!.tab, 'entregables')
  assert.equal(nextAction(viewTasks([{ ...base, status: 'done' }], [], '2027-01-10'), [], 'u1'), null)
})

test('Gantt: etapas como resumen con el rango de sus tareas y subtareas anidadas', () => {
  const tasks = [base, { ...base, id: 't2', seq: 20, committed_start: '2027-01-11', committed_end: '2027-01-20' }, { ...base, id: 's1', parent_id: 't2', seq: 21, title: 'Sub' }]
  const rows = projectGanttRows(viewTasks(tasks, [], '2027-01-01'), LIGHT, () => 'Ana')
  assert.equal(rows[0].id, 'stage-L1')
  assert.deepEqual([rows[0].start, rows[0].end], ['2027-01-04', '2027-01-20'])
  assert.deepEqual(rows.map(row => row.level), [0, 1, 1, 2])
  assert.equal(rows[3].parentId, 't2')
  assert.equal(rollupState(['done', 'na', 'done']), 'done')
  assert.equal(rollupState(['done', 'late', 'pending']), 'late')
})

test('línea base: ahorro anualizado solo con precio adjudicado', () => {
  const result = baselineSavings([
    { reference_price: 10000, adjustment_pct: 5, projected_qty: 1000, awarded_price: 9500 },
    { reference_price: 200000, adjustment_pct: 0, projected_qty: 12, awarded_price: null },
  ])
  assert.equal(result.savings, 1000 * 1000)
  assert.equal(result.priced, 1)
  assert.equal(baselineSavings([{ reference_price: 1, adjustment_pct: 0, projected_qty: 1, awarded_price: null }]).savings, null)
})
