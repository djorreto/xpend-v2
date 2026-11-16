import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EMPTY_FACTS,
  MILESTONES,
  addDays,
  autoBlocks,
  daysBetween,
  delayCause,
  delaysByCause,
  diffAgainstCommitted,
  initiativeHealth,
  lineCoverage,
  projectCascade,
  proposeAdjustments,
  systemActuals,
  totalsByCurrency,
  viewMilestone,
  viewMilestones,
  type MilestoneRow,
  type ProcessFacts,
} from './milestones.ts'

const TODAY = '2026-11-17'

function row(kind: MilestoneRow['kind'], seq: number, extra: Partial<MilestoneRow> = {}): MilestoneRow {
  return { id: `m-${kind}`, sourcing_plan_id: 'p1', kind, seq, original_date: null, committed_date: null, actual_date: null, blocked: false, block_cause: null, block_note: null, ...extra }
}

test('son siete hitos en el orden del flujo S2C', () => {
  assert.deepEqual(MILESTONES.map(item => item.kind), ['inicio', 'preparacion_rfx', 'invitacion', 'recepcion', 'evaluacion', 'comite_adjudicacion', 'formalizacion'])
})

test('aritmética de fechas por día calendario', () => {
  assert.equal(daysBetween('2026-11-17', '2026-11-20'), 3)
  assert.equal(daysBetween('2026-11-20', '2026-11-17'), -3)
  assert.equal(addDays('2026-12-30', 5), '2027-01-04')
  assert.equal(daysBetween('2026-03-01', '2026-02-28'), -1)
})

test('estados: al día, próximo a vencer, atrasado, bloqueado, completado y sin fecha', () => {
  const at = (extra: Partial<MilestoneRow>) => viewMilestone(row('recepcion', 4, extra), { today: TODAY })
  assert.equal(at({ committed_date: '2026-12-30' }).status, 'on_time')
  assert.equal(at({ committed_date: '2026-11-24' }).status, 'due_soon')
  assert.equal(at({ committed_date: '2026-11-25' }).status, 'on_time', 'a 8 días ya no es próximo')
  assert.equal(at({ committed_date: '2026-11-17' }).status, 'due_soon', 'vence hoy: aún no está atrasado')
  const late = at({ committed_date: '2026-11-10' })
  assert.equal(late.status, 'late')
  assert.equal(late.lateDays, 7)
  assert.equal(late.deviationDays, 7)
  assert.equal(at({ committed_date: '2026-11-10', actual_date: '2026-11-12' }).status, 'completed')
  assert.equal(at({}).status, 'no_date')
  const blocked = at({ committed_date: '2026-11-10', blocked: true, block_cause: 'proveedor', block_note: 'No responde' })
  assert.equal(blocked.status, 'blocked')
  assert.equal(blocked.blockedBy?.automatic, false)
})

test('la desviación de un hito completado es real menos comprometida, y también se mide contra la original', () => {
  const view = viewMilestone(row('evaluacion', 5, { original_date: '2026-10-01', committed_date: '2026-10-10', actual_date: '2026-10-14' }), { today: TODAY })
  assert.equal(view.deviationDays, 4)
  assert.equal(view.vsOriginalDays, 13)
  const early = viewMilestone(row('evaluacion', 5, { committed_date: '2026-10-10', actual_date: '2026-10-08' }), { today: TODAY })
  assert.equal(early.deviationDays, -2)
  assert.equal(early.lateDays, 0)
})

test('un hito con fecha comprometida y sin real no calcula desviación mientras está en plazo', () => {
  const view = viewMilestone(row('invitacion', 3, { committed_date: '2026-12-01' }), { today: TODAY })
  assert.equal(view.deviationDays, null)
  assert.equal(view.lateDays, 0)
})

test('las fechas reales salen de eventos del sistema y solo existen si el evento ocurrió', () => {
  const facts: ProcessFacts = {
    ...EMPTY_FACTS,
    rfx: [{ status: 'ready', created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-10T10:00:00Z' }],
    licitaciones: [{ status: 'awarded', created_at: '2026-09-05T10:00:00Z', publish_approved_at: '2026-09-15T12:00:00Z', proposal_closing_date: '2026-10-01', committee_date: '2026-10-08', award_date: '2026-10-10', award_approved_at: '2026-10-11T15:00:00Z' }],
    awards: [{ awarded_at: '2026-10-11T15:00:00Z' }],
    contracts: [{ status: 'active', starts_on: '2026-11-01' }],
  }
  const actuals = systemActuals(facts, TODAY)
  assert.equal(actuals.inicio?.date, '2026-09-01')
  assert.equal(actuals.preparacion_rfx?.date, '2026-09-10')
  assert.equal(actuals.invitacion?.date, '2026-09-15')
  assert.equal(actuals.recepcion?.date, '2026-10-01')
  assert.equal(actuals.evaluacion?.date, '2026-10-08')
  assert.equal(actuals.comite_adjudicacion?.date, '2026-10-11')
  assert.equal(actuals.formalizacion?.date, '2026-11-01')
  assert.deepEqual(systemActuals(EMPTY_FACTS, TODAY), {})
  const draft = systemActuals({ ...EMPTY_FACTS, rfx: [{ status: 'draft', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-02T00:00:00Z' }] }, TODAY)
  assert.equal(draft.preparacion_rfx, undefined, 'bases en borrador no completan el hito')
  const future = systemActuals({ ...EMPTY_FACTS, licitaciones: [{ status: 'awarded', proposal_closing_date: '2027-01-01' }] }, TODAY)
  assert.equal(future.recepcion, undefined, 'una fecha futura no es un evento ocurrido')
})

test('el real del sistema completa el hito sin tocar el registro, y el manual prevalece', () => {
  const system = { recepcion: { date: '2026-10-01', source: 'licitacion' as const, label: 'x' } }
  const fromSystem = viewMilestone(row('recepcion', 4, { committed_date: '2026-10-05' }), { today: TODAY, system })
  assert.equal(fromSystem.status, 'completed')
  assert.equal(fromSystem.actualSource, 'licitacion')
  assert.equal(fromSystem.deviationDays, -4)
  const manual = viewMilestone(row('recepcion', 4, { committed_date: '2026-10-05', actual_date: '2026-10-06' }), { today: TODAY, system })
  assert.equal(manual.actual, '2026-10-06')
  assert.equal(manual.actualSource, 'manual')
})

test('los bloqueos automáticos por aprobación no se atribuyen al comprador', () => {
  const blocks = autoBlocks({
    ...EMPTY_FACTS,
    licitaciones: [{ status: 'bases_review' }],
    pendingDecisions: 1,
    salas: [{ status: 'closed', modality: 'sealed', offers_opened_at: null }],
    contracts: [{ status: 'in_review' }],
  })
  assert.deepEqual(blocks.map(block => block.kind).sort(), ['comite_adjudicacion', 'evaluacion', 'formalizacion', 'invitacion'])
  assert.ok(blocks.every(block => block.cause === 'aprobador'))
  const view = viewMilestone(row('comite_adjudicacion', 6, { committed_date: '2026-11-01' }), { today: TODAY, autoBlocks: blocks })
  assert.equal(view.status, 'blocked')
  assert.equal(view.blockedBy?.automatic, true)
  assert.equal(delayCause(view).cause, 'aprobador')
  // Un contrato devuelto es trabajo del comprador, y se dice así.
  assert.equal(autoBlocks({ ...EMPTY_FACTS, returnedContracts: 1 })[0].cause, 'comprador')
})

test('un atraso sin causa registrada no se atribuye a nadie', () => {
  const view = viewMilestone(row('recepcion', 4, { committed_date: '2026-11-01' }), { today: TODAY })
  assert.equal(delayCause(view).cause, 'sin_causa')
  assert.equal(delayCause(view, 'area_solicitante').cause, 'area_solicitante')
  const counts = delaysByCause([
    { view, lastCause: null },
    { view, lastCause: 'proveedor' },
    { view: viewMilestone(row('inicio', 1, { committed_date: '2026-12-30' }), { today: TODAY }) },
  ])
  assert.deepEqual(counts, { sin_causa: 1, proveedor: 1 })
})

test('la proyección en cascada marca los hitos siguientes y no modifica ninguna fecha', () => {
  const rows = [
    row('inicio', 1, { committed_date: '2026-10-01', actual_date: '2026-10-01' }),
    row('preparacion_rfx', 2, { committed_date: '2026-11-10' }),
    row('invitacion', 3, { committed_date: '2026-11-20' }),
    row('recepcion', 4, { committed_date: '2026-12-10' }),
    row('evaluacion', 5, { committed_date: '2026-12-20' }),
    row('comite_adjudicacion', 6),
    row('formalizacion', 7, { committed_date: '2027-01-15' }),
  ]
  const snapshot = JSON.stringify(rows)
  const views = viewMilestones(rows, { today: TODAY })
  const projection = projectCascade(views, TODAY)
  assert.equal(projection.originMilestone, 'preparacion_rfx')
  const byKind = Object.fromEntries(projection.items.map(item => [item.kind, item]))
  assert.equal(byKind.preparacion_rfx.projected, TODAY, 'el hito atrasado se proyecta a hoy')
  assert.equal(byKind.invitacion.projected, '2026-11-27', 'conserva 10 días de separación')
  assert.equal(byKind.invitacion.affected, true)
  assert.equal(byKind.recepcion.projected, '2026-12-17')
  assert.equal(byKind.comite_adjudicacion.projected, null, 'sin fecha comprometida no se proyecta')
  assert.equal(projection.committedEnd, '2027-01-15')
  assert.ok(projection.endShiftDays > 0)
  const proposal = proposeAdjustments(projection)
  assert.ok(proposal.length >= 3)
  assert.ok(proposal.every(item => item.to > item.from))
  assert.equal(JSON.stringify(rows), snapshot, 'la proyección no modifica las filas')
})

test('sin atraso no hay impacto en cascada', () => {
  const views = viewMilestones([row('inicio', 1, { committed_date: '2026-12-01' }), row('invitacion', 3, { committed_date: '2026-12-15' })], { today: TODAY })
  const projection = projectCascade(views, TODAY)
  assert.equal(projection.endShiftDays, 0)
  assert.equal(projectCascade(views, TODAY).originMilestone, null)
  assert.deepEqual(proposeAdjustments(projection), [])
})

test('un hito completado con retraso también arrastra a los siguientes', () => {
  const views = viewMilestones([
    row('inicio', 1, { committed_date: '2026-10-01', actual_date: '2026-10-06' }),
    row('preparacion_rfx', 2, { committed_date: '2026-10-11' }),
  ], { today: TODAY })
  const projection = projectCascade(views, TODAY)
  assert.equal(projection.originMilestone, 'inicio')
})

test('la salud de la iniciativa prioriza atraso sobre bloqueo y no marca atrasada una iniciativa sin fechas', () => {
  const make = (extras: Partial<MilestoneRow>[]) => viewMilestones(extras.map((extra, index) => row(MILESTONES[index].kind, index + 1, extra)), { today: TODAY })
  assert.equal(initiativeHealth([]), 'no_dates')
  assert.equal(initiativeHealth(make([{}, {}])), 'no_dates')
  assert.equal(initiativeHealth(make([{ committed_date: '2026-10-01', actual_date: '2026-10-01' }])), 'completed')
  assert.equal(initiativeHealth(make([{ committed_date: '2026-11-01' }, { committed_date: '2026-11-01', blocked: true, block_cause: 'externo', block_note: 'Huelga' }])), 'late')
  assert.equal(initiativeHealth(make([{ committed_date: '2026-12-31' }, { committed_date: '2026-11-01', blocked: true, block_cause: 'externo', block_note: 'Huelga' }])), 'blocked')
  assert.equal(initiativeHealth(make([{ committed_date: '2026-11-20' }])), 'due_soon')
  assert.equal(initiativeHealth(make([{ committed_date: '2026-12-31' }])), 'on_time')
})

test('cobertura de la meta: las iniciativas la respaldan, no se suman a ella y nunca mezclan monedas', () => {
  const line = { category_id: 'c1', currency: 'CLP', historical_spend: 1000, target_amount: 100, owner_user_id: null, priority: 1 }
  const result = lineCoverage(line, [
    { id: 'a', category_id: 'c1', currency: 'CLP', projected_savings_amount: 40 },
    { id: 'b', category_id: 'c1', currency: 'clp', projected_savings_amount: 20 },
    { id: 'c', category_id: 'c1', currency: 'USD', projected_savings_amount: 999 },
    { id: 'd', category_id: 'c2', currency: 'CLP', projected_savings_amount: 999 },
    { id: 'e', category_id: 'c1', currency: 'CLP', projected_savings_amount: 500, status: 'cancelled' },
  ])
  assert.equal(result.initiativeTarget, 60)
  assert.equal(result.coverage, 0.6)
  assert.equal(result.gap, 40)
  const none = lineCoverage(line, [{ id: 'a', category_id: 'c1', currency: 'CLP', projected_savings_amount: null }])
  assert.equal(none.initiativeTarget, null, 'sin objetivo conocido no es cero')
  assert.equal(none.coverage, null)
})

test('la comparación con el plan comprometido muestra lo revisado y lo agregado', () => {
  const snapshot = [
    { line_id: 'l1', category_id: 'c1', currency: 'CLP', historical_spend: 1000, target_amount: 100, owner_user_id: 'u1', priority: 1 },
    { line_id: 'l2', category_id: 'c2', currency: 'CLP', historical_spend: 500, target_amount: 50, owner_user_id: null, priority: 2 },
  ]
  const diffs = diffAgainstCommitted(snapshot, [
    { category_id: 'c1', currency: 'CLP', historical_spend: 1000, target_amount: 120, owner_user_id: 'u1', priority: 1 },
    { category_id: 'c2', currency: 'CLP', historical_spend: 500, target_amount: 50, owner_user_id: null, priority: 2 },
    { category_id: 'c3', currency: 'CLP', historical_spend: null, target_amount: 30, owner_user_id: null, priority: 3 },
  ])
  assert.deepEqual(diffs.map(item => item.kind), ['revised', 'unchanged', 'added'])
  assert.equal(diffs[0].targetDelta, 20)
  assert.equal(diffs[2].targetOriginal, null)
})

test('los totales del plan se separan por moneda y respetan lo no informado', () => {
  const totals = totalsByCurrency([
    { currency: 'CLP', target_amount: 100, historical_spend: 1000 },
    { currency: 'CLP', target_amount: 50, historical_spend: null },
    { currency: 'USD', target_amount: null, historical_spend: null },
  ])
  assert.deepEqual(totals, [{ currency: 'CLP', target: 150, spend: 1000 }, { currency: 'USD', target: null, spend: null }])
})
