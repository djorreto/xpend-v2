import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EMPTY_WORKSPACE,
  activityByType,
  approvals,
  buildProcesses,
  continueWhereLeft,
  filterProcesses,
  myInitiatives,
  needsAttention,
  queueByBucket,
  upcomingDates,
  workQueue,
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
  assert.equal(workQueue(withContract, ME, 'manager', TODAY).some(action => action.id === 'award-a-1'), false)
})

test('filtros de procesos por tipo, etapa, responsable, estado y texto', () => {
  const items = buildProcesses(sample, ME, 'manager')
  assert.equal(filterProcesses(items, { kind: 'sala' }).length, 2)
  assert.equal(filterProcesses(items, { stage: 'evaluacion' }).map(item => item.id).join(), 's-closed')
  assert.ok(filterProcesses(items, { mine: true }).every(item => item.mine))
  assert.ok(filterProcesses(items, { active: true }).every(item => item.id !== 'LIC-AWD'))
  assert.deepEqual(filterProcesses(items, { query: 'lic-pub' }).map(item => item.id), ['LIC-PUB'])
  assert.deepEqual(filterProcesses(items, { statusLabel: 'Recepción cerrada' }).map(item => item.id), ['s-closed'])
})

test('las iniciativas asignadas usan el responsable y, si falta, quien la creó', () => {
  const mine = myInitiatives(sample, ME, 'analyst')
  assert.deepEqual(mine.map(item => item.id).sort(), ['p-created', 'p-mine'])
  const byId = new Map(mine.map(item => [item.id, item]))
  assert.equal(byId.get('p-created')?.hasProcess, true)
  assert.equal(byId.get('p-mine')?.next.href, '/rfx-maker/new?planId=p-mine')
  assert.equal(myInitiatives(sample, ME, 'viewer').find(item => item.id === 'p-mine')?.next.label, 'Ver iniciativa')
})

test('la cola personal es solo mía, sale del estado real y cada elemento dice por qué', () => {
  const queue = workQueue(sample, ME, 'analyst', TODAY)
  const bucketOf = new Map(queue.map(item => [item.id, item.bucket]))
  assert.equal(bucketOf.get('plan-p-mine'), 'work', 'iniciativa sin proceso')
  assert.equal(bucketOf.has('plan-p-created'), false, 'ya tiene RFx')
  assert.equal(bucketOf.has('plan-p-other'), false, 'no es mía')
  assert.equal(bucketOf.get('sala-s-closed'), 'attention', 'sala cerrada por evaluar')
  assert.equal(bucketOf.get('award-a-1'), 'work', 'adjudicada sin contrato')
  assert.equal(bucketOf.get('version-v-2'), 'attention', 'versión devuelta')
  assert.equal(bucketOf.get('licitacion-LIC-REVIEW'), 'attention', 'detenida hace más de 14 días')
  assert.match(queue.find(item => item.id === 'licitacion-LIC-REVIEW')?.reason || '', /Sin movimiento hace más de 14 días/)
  assert.equal(bucketOf.has('rfx-r-ready'), false, 'de otra persona')
  assert.equal(bucketOf.get('contract-c-ending'), 'work', 'contrato por vencer')
  assert.equal(bucketOf.has('contract-c-draft'), false, 'su versión devuelta ya está arriba, sin duplicar')
  assert.ok(queue.every(item => item.reason.length > 10 && item.href && item.cta), 'todo elemento explica por qué y a dónde ir')
  assert.deepEqual(workQueue(EMPTY_WORKSPACE, ME, 'analyst', TODAY), [])
})

test('un RFx en borrador es un borrador para continuar: aparece en la cola y en "Continuar"', () => {
  const only = workspace({ rfx: [{ id: 'r-1', title: 'Bases aseo', status: 'draft', responsible_user_id: ME, updated_at: FRESH }] })
  const queue = workQueue(only, ME, 'analyst', TODAY)
  assert.deepEqual(queue.map(item => [item.id, item.bucket]), [['rfx-r-1', 'draft']])
  assert.match(queue[0].reason, /Borrador/)
  const next = continueWhereLeft(only, ME, 'analyst', TODAY)
  assert.equal(next?.title, 'Bases aseo')
  assert.equal(next?.bucket, 'draft')
  assert.equal(next?.href, '/rfx-maker/r-1')
})

test('"Continuar" siempre es un elemento de la cola; nada aparece solo en una de las dos', () => {
  for (const role of ['analyst', 'manager', 'admin']) {
    const queue = workQueue(sample, ME, role, TODAY)
    const next = continueWhereLeft(sample, ME, role, TODAY)
    assert.ok(next && queue.some(item => item.title === next.title && item.href === next.href), role)
  }
  assert.equal(continueWhereLeft(EMPTY_WORKSPACE, ME, 'analyst', TODAY), null)
})

test('la cola reparte cada elemento en un solo grupo y respeta lo que puede hacer el rol', () => {
  const analyst = queueByBucket(workQueue(sample, ME, 'analyst', TODAY))
  assert.deepEqual(analyst.draft.map(item => item.id), ['rfx-r-draft'])
  const total = (grouped: ReturnType<typeof queueByBucket>) => grouped.attention.length + grouped.work.length + grouped.draft.length + grouped.active.length
  assert.equal(total(analyst), workQueue(sample, ME, 'analyst', TODAY).length)
  // un gerente aprueba sus bases en revisión, un comprador solo las sigue
  const review = (role: string) => workQueue(sample, ME, role, new Date('2026-10-02T12:00:00Z')).find(item => item.id === 'licitacion-LIC-REVIEW')
  assert.equal(review('manager')?.bucket, 'attention')
  assert.match(review('manager')?.reason || '', /esperan tu aprobación/)
  assert.equal(review('analyst')?.bucket, 'active')
  assert.match(review('analyst')?.reason || '', /esperan la aprobación de un gerente/)
  // las bases listas: el gerente tiene trabajo; el comprador solo espera
  const ready = workspace({ rfx: [{ id: 'r-9', title: 'Listas', status: 'ready', responsible_user_id: ME, updated_at: FRESH }] })
  assert.equal(workQueue(ready, ME, 'manager', TODAY)[0].bucket, 'work')
  assert.equal(workQueue(ready, ME, 'analyst', TODAY)[0].bucket, 'active')
})

test('una licitación con sala propia no se duplica con su sala en la cola', () => {
  const both = workspace({
    licitaciones: [{ id: 'L-1', name: 'Mi licitación', status: 'published', responsible_user_id: ME, updated_at: FRESH }],
    salas: [{ id: 's-1', title: 'Mi sala', status: 'closed', licitacion_id: 'L-1', created_by: ME, updated_at: FRESH }],
  })
  assert.deepEqual(workQueue(both, ME, 'manager', TODAY).map(item => item.id), ['sala-s-1'])
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

function breakdownTotal(text: string) {
  return text.split(' · ').reduce((sum, part) => sum + Number(part.match(/^\d+/)?.[0] || 0), 0)
}

test('la actividad por tipo define cada número y su desglose suma exactamente ese número', () => {
  const metrics = activityByType(sample, 'manager', 2026)
  const byId = new Map(metrics.map(metric => [metric.id, metric]))
  assert.deepEqual(metrics.map(metric => [metric.id, metric.value]), [
    ['iniciativas', 3], ['rfx', 2], ['licitaciones', 2], ['salas', 2], ['adjudicaciones', 1], ['contratos', 2],
  ])
  for (const id of ['iniciativas', 'rfx', 'licitaciones', 'salas', 'contratos'] as const) {
    const metric = byId.get(id)!
    assert.equal(breakdownTotal(metric.breakdown), metric.value, `${id}: ${metric.breakdown}`)
  }
  assert.equal(byId.get('iniciativas')?.breakdown, '1 sin proceso aún · 2 con proceso')
  assert.equal(byId.get('adjudicaciones')?.breakdown, '1 sin contrato · 1 decisión pendiente')
  assert.ok(metrics.every(metric => metric.definition.length > 20 && metric.href.startsWith('/')))
  assert.match(byId.get('salas')!.definition, /pertenecer a una licitación ya contada/)
})

test('las cifras de tipos distintos pueden superponerse sin forzarlas a coincidir', () => {
  // 3 iniciativas abiertas conviven con 0 iniciativas sin proceso: son preguntas distintas y ambas se muestran con su nombre
  const linked = workspace({
    plans: [{ id: 'p-1', title: 'Con RFx', status: 'planned', plan_year: 2026, responsible_user_id: ME }],
    rfx: [{ id: 'r-1', title: 'Bases', status: 'draft', sourcing_plan_id: 'p-1', responsible_user_id: ME }],
  })
  const initiatives = activityByType(linked, 'manager', 2026).find(metric => metric.id === 'iniciativas')!
  assert.equal(initiatives.value, 1)
  assert.equal(initiatives.breakdown, '1 con proceso')
  assert.doesNotMatch(initiatives.breakdown, /sin proceso/)
})

test('el perfil de consulta ve las adjudicaciones que RLS le permite, pero no los contratos', () => {
  const viewer = activityByType(sample, 'viewer', 2026)
  assert.equal(viewer.find(metric => metric.id === 'adjudicaciones')?.value, 1)
  assert.equal(viewer.find(metric => metric.id === 'adjudicaciones')?.breakdown, '1 decisión pendiente')
  assert.equal(viewer.some(metric => metric.id === 'contratos'), false)
  assert.equal(activityByType(sample, 'analyst', 2026).some(metric => metric.id === 'contratos'), true)
})

test('el centro de trabajo no calcula ni inventa ahorros, metas ni hitos', () => {
  const outputs = JSON.stringify([
    buildProcesses(sample, ME, 'manager'),
    workQueue(sample, ME, 'manager', TODAY),
    approvals(sample, ME, 'manager'),
    needsAttention(sample, ME, 'manager', TODAY),
    upcomingDates(sample, { today: TODAY }),
    activityByType(sample, 'manager', 2026),
  ])
  assert.doesNotMatch(outputs, /savings|ahorro|meta|hito|atrasad/i)
})
