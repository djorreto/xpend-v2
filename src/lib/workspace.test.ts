import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EMPTY_WORKSPACE,
  approvals,
  areaSummary,
  buildProcesses,
  continueWhereLeft,
  contractsForMe,
  filterProcesses,
  myInitiatives,
  needsAttention,
  pendingActions,
  stageCounts,
  upcomingDates,
  type WorkspaceRaw,
} from './workspace.ts'

const ME = 'user-me'
const OTHER = 'user-other'
const TODAY = new Date('2026-11-16T12:00:00Z')
const FRESH = '2026-11-15T10:00:00Z'
const OLD = '2026-10-01T10:00:00Z'

function workspace(partial: Partial<WorkspaceRaw>): WorkspaceRaw {
  return { ...EMPTY_WORKSPACE, ...partial }
}

const sample = workspace({
  plans: [
    { id: 'p-mine', title: 'Mantención', status: 'planned', quarter: 'Q4', plan_year: 2026, responsible_user_id: ME, updated_at: FRESH },
    { id: 'p-created', title: 'Aseo', status: 'in_progress', plan_year: 2026, responsible_user_id: null, created_by: ME, updated_at: FRESH },
    { id: 'p-other', title: 'Transporte', status: 'planned', plan_year: 2026, responsible_user_id: OTHER, updated_at: FRESH },
    { id: 'p-done', title: 'Cerrada', status: 'completed', plan_year: 2026, responsible_user_id: ME },
    { id: 'p-spot', title: 'Spot', status: 'planned', plan_year: 2026, responsible_user_id: ME, is_spot: true },
  ],
  rfx: [
    { id: 'r-draft', title: 'Bases mantención', status: 'draft', sourcing_plan_id: 'p-created', responsible_user_id: ME, updated_at: FRESH },
    { id: 'r-ready', title: 'Bases transporte', status: 'ready', sourcing_plan_id: 'p-other', responsible_user_id: OTHER, updated_at: OLD },
  ],
  licitaciones: [
    { id: 'LIC-REVIEW', name: 'Licitación en revisión', status: 'bases_review', responsible_user_id: ME, updated_at: OLD, proposal_closing_date: '2026-11-20' },
    { id: 'LIC-PUB', name: 'Licitación publicada', status: 'published', responsible_user_id: OTHER, updated_at: FRESH, questions_date: '2026-11-10' },
    { id: 'LIC-AWD', name: 'Licitación adjudicada', status: 'awarded', responsible_user_id: ME, updated_at: FRESH, award_date: '2026-11-25' },
  ],
  salas: [
    { id: 's-pub', title: 'Sala publicada', status: 'open', licitacion_id: 'LIC-PUB', created_by: OTHER, closes_at: '2026-11-18T18:00:00Z', updated_at: FRESH },
    { id: 's-closed', title: 'Sala cerrada', status: 'closed', created_by: ME, updated_at: FRESH },
  ],
  decisions: [{ id: 'd-1', licitacion_id: 'LIC-PUB', outcome: 'pending', event_id: 's-pub' }],
  awards: [{ id: 'a-1', licitacion_id: 'LIC-AWD', contract_id: null }],
  contracts: [
    { id: 'c-draft', code: 'CTR-1', name: 'Contrato aseo', status: 'draft', owner_id: ME, updated_at: OLD },
    { id: 'c-review', code: 'CTR-2', name: 'Contrato transporte', status: 'in_review', owner_id: OTHER, updated_at: FRESH },
    { id: 'c-ending', code: 'CTR-3', name: 'Contrato vigente', status: 'active', owner_id: ME, ends_on: '2026-12-20' },
  ],
  versions: [
    { id: 'v-1', contract_id: 'c-review', status: 'in_review', created_by: OTHER, created_at: FRESH },
    { id: 'v-2', contract_id: 'c-draft', status: 'returned', created_by: ME, created_at: FRESH },
  ],
  planLinks: [{ plan_id: 'p-other', licitacion_id: 'LIC-PUB' }],
})

test('los procesos reúnen RFx, licitaciones y salas con su etapa y siguiente paso', () => {
  const items = buildProcesses(sample, ME, 'manager')
  assert.equal(items.length, 7)
  const byId = new Map(items.map(item => [item.id, item]))
  assert.equal(byId.get('LIC-REVIEW')?.stage, 'licitacion')
  assert.equal(byId.get('LIC-REVIEW')?.next.label, 'Revisar y aprobar las bases')
  assert.equal(byId.get('LIC-PUB')?.next.href, '/sala/s-pub')
  assert.equal(byId.get('s-closed')?.stage, 'evaluacion')
  assert.equal(byId.get('s-closed')?.next.href, '/sala/s-closed/evaluacion')
  assert.equal(byId.get('LIC-AWD')?.next.href, '/contratos/desde-adjudicacion?award=a-1')
  assert.equal(byId.get('r-ready')?.next.href, '/licitaciones/new?rfxId=r-ready&planId=p-other')
})

test('el siguiente paso respeta lo que cada rol puede hacer', () => {
  const analyst = new Map(buildProcesses(sample, ME, 'analyst').map(item => [item.id, item]))
  assert.equal(analyst.get('r-ready')?.next.label, 'Ver bases')
  assert.match(String(analyst.get('r-ready')?.next.note), /gerente o administrador/)
  assert.equal(analyst.get('LIC-REVIEW')?.next.label, 'Ver licitación')
  assert.equal(analyst.get('LIC-AWD')?.next.label, 'Preparar contrato desde la adjudicación')

  const viewer = new Map(buildProcesses(sample, ME, 'viewer').map(item => [item.id, item]))
  assert.equal(viewer.get('LIC-AWD')?.next.href, undefined)
  assert.equal(viewer.get('LIC-REVIEW')?.next.label, 'Ver licitación')
})

test('una licitación con contrato lleva al contrato, nunca vuelve a prepararlo', () => {
  const withContract = workspace({ ...sample, contracts: [{ id: 'c-awd', code: 'CTR-AWD', name: 'x', status: 'active', licitacion_id: 'LIC-AWD' }] })
  const item = buildProcesses(withContract, ME, 'manager').find(process => process.id === 'LIC-AWD')
  assert.equal(item?.next.href, '/contratos/c-awd')
  assert.equal(pendingActions(withContract, ME, 'manager', TODAY).some(action => action.id === 'award-a-1'), false)
})

test('filtros de procesos por tipo, etapa, responsable, estado y texto', () => {
  const items = buildProcesses(sample, ME, 'manager')
  assert.equal(filterProcesses(items, { kind: 'sala' }).length, 2)
  assert.equal(filterProcesses(items, { stage: 'evaluacion' }).map(item => item.id).join(), 's-closed')
  assert.ok(filterProcesses(items, { mine: true }).every(item => item.mine))
  assert.ok(filterProcesses(items, { active: true }).every(item => item.id !== 'LIC-AWD'))
  assert.deepEqual(filterProcesses(items, { query: 'lic-pub' }).map(item => item.id), ['LIC-PUB'])
})

test('las iniciativas asignadas usan el responsable y, si falta, quien la creó', () => {
  const mine = myInitiatives(sample, ME, 'analyst')
  assert.deepEqual(mine.map(item => item.id).sort(), ['p-created', 'p-mine'])
  const byId = new Map(mine.map(item => [item.id, item]))
  assert.equal(byId.get('p-created')?.hasProcess, true)
  assert.equal(byId.get('p-mine')?.next.href, '/rfx-maker/new?planId=p-mine')
  assert.equal(myInitiatives(sample, ME, 'viewer').find(item => item.id === 'p-mine')?.next.label, 'Ver iniciativa')
})

test('los pendientes del comprador son solo suyos y salen del estado real', () => {
  const actions = pendingActions(sample, ME, 'analyst', TODAY)
  const ids = actions.map(action => action.id)
  assert.ok(ids.includes('plan-p-mine'), 'iniciativa sin proceso')
  assert.ok(!ids.includes('plan-p-created'), 'ya tiene RFx')
  assert.ok(!ids.includes('plan-p-other'), 'no es mía')
  assert.ok(ids.includes('sala-s-closed'), 'sala cerrada por evaluar')
  assert.ok(ids.includes('award-a-1'), 'adjudicada sin contrato')
  assert.ok(ids.includes('version-v-2'), 'versión devuelta')
  assert.ok(ids.includes('stalled-licitacion-LIC-REVIEW'), 'detenida hace más de 14 días')
  assert.ok(!ids.includes('stalled-rfx-r-ready'), 'detenida pero de otra persona')
  assert.deepEqual(pendingActions(EMPTY_WORKSPACE, ME, 'analyst', TODAY), [])
})

test('las aprobaciones solo existen para quien puede aprobar y nunca las propias', () => {
  assert.deepEqual(approvals(sample, ME, 'analyst'), [])
  assert.deepEqual(approvals(sample, ME, 'viewer'), [])
  const ids = approvals(sample, ME, 'manager').map(item => item.id)
  assert.deepEqual(ids, ['bases-LIC-REVIEW', 'decision-d-1', 'review-v-1'])
  assert.deepEqual(approvals(sample, OTHER, 'manager').map(item => item.id), ['bases-LIC-REVIEW', 'decision-d-1'])
  assert.equal(approvals(sample, ME, 'manager')[1].href, '/sala/s-pub/decision')
})

test('lo que requiere atención del gerente: detenidos, sin responsable y sin proceso', () => {
  const ids = needsAttention(sample, ME, 'manager', TODAY).map(item => item.id)
  assert.ok(ids.includes('stalled-licitacion-LIC-REVIEW'))
  assert.ok(ids.includes('stalled-rfx-r-ready'))
  assert.ok(ids.includes('owner-p-created'))
  assert.ok(ids.includes('noproc-p-mine'))
  assert.ok(!ids.some(id => id.includes('p-spot') || id.includes('p-done')))
})

test('las próximas fechas usan solo fechas cargadas, futuras y ordenadas', () => {
  const dates = upcomingDates(sample, { today: TODAY })
  assert.deepEqual(dates.map(item => item.id), ['s-pub-close', 'LIC-REVIEW-proposal_closing_date', 'c-ending-end'])
  assert.ok(!dates.some(item => item.id.startsWith('LIC-AWD')), 'adjudicada no tiene fechas pendientes')
  assert.ok(!dates.some(item => item.id.includes('questions_date')), 'fecha pasada')
  const mine = upcomingDates(sample, { today: TODAY, me: ME, onlyMine: true })
  assert.deepEqual(mine.map(item => item.id), ['LIC-REVIEW-proposal_closing_date', 'c-ending-end'])
  assert.deepEqual(upcomingDates(EMPTY_WORKSPACE, { today: TODAY }), [])
})

test('contratos que requieren mi atención y continuar donde quedé', () => {
  assert.deepEqual(contractsForMe(sample, ME, TODAY).map(item => item.id), ['c-draft', 'c-ending'])
  const next = continueWhereLeft(sample, ME, 'analyst')
  assert.equal(next?.title, 'Bases mantención')
  assert.equal(continueWhereLeft(EMPTY_WORKSPACE, ME, 'analyst'), null)
})

test('el flujo cuenta cada registro en una sola etapa', () => {
  const counts = Object.fromEntries(stageCounts(sample, ME, 'manager').map(stage => [stage.id, stage.count]))
  assert.deepEqual(counts, { iniciativa: 1, rfx: 2, licitacion: 1, ofertas: 1, evaluacion: 1, adjudicacion: 2, contrato: 2 })
  const viewer = Object.fromEntries(stageCounts(sample, ME, 'viewer').map(stage => [stage.id, stage.count]))
  assert.equal(viewer.contrato, null)
  assert.equal(viewer.adjudicacion, null)
  const summary = areaSummary(sample, 2026)
  assert.equal(summary.openInitiatives, 3)
  assert.equal(summary.completedInitiatives, 1)
  assert.equal(summary.activeProcesses, 6)
})

test('el centro de trabajo no calcula ni inventa ahorros, metas ni hitos', () => {
  const outputs = JSON.stringify([
    buildProcesses(sample, ME, 'manager'),
    pendingActions(sample, ME, 'manager', TODAY),
    approvals(sample, ME, 'manager'),
    needsAttention(sample, ME, 'manager', TODAY),
    upcomingDates(sample, { today: TODAY }),
    stageCounts(sample, ME, 'manager'),
    areaSummary(sample, 2026),
  ])
  assert.doesNotMatch(outputs, /savings|ahorro|meta|hito|atrasad/i)
})
