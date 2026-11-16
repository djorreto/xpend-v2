import assert from 'node:assert/strict'
import test from 'node:test'
import { MILESTONES, initiativeHealth, viewMilestones, type MilestoneRow } from './milestones.ts'
import { currentStage, milestonesByStatus, personLoad, planCompliance, riskInitiatives, stageMatrix, upcomingMilestones, type ScheduleLike } from './management.ts'
import type { CategoryAssignment } from './portfolio.ts'

const TODAY = '2026-06-15'
const assignments: Record<string, CategoryAssignment> = {
  c1: { category_id: 'c1', manager_user_id: 'ana', backup_user_id: 'beto', team_id: null },
  c2: { category_id: 'c2', manager_user_id: null, backup_user_id: null, team_id: null },
}

// dates: fecha comprometida por hito (en orden), actual: cuántos hitos están completos desde el inicio
function schedule(id: string, options: { dates?: (string | null)[]; done?: number; blockAt?: number; extra?: Record<string, unknown> } = {}): ScheduleLike {
  const dates = options.dates || []
  const rows: MilestoneRow[] = MILESTONES.map((item, index) => ({
    id: `${id}-${item.kind}`,
    sourcing_plan_id: id,
    kind: item.kind,
    seq: item.seq,
    original_date: dates[index] ?? null,
    committed_date: dates[index] ?? null,
    actual_date: index < (options.done || 0) ? dates[index] || '2026-01-01' : null,
    blocked: options.blockAt === index,
    block_cause: options.blockAt === index ? 'aprobador' : null,
    block_note: null,
  }))
  const views = dates.length || options.done ? viewMilestones(rows, { today: TODAY }) : []
  return {
    initiative: { id, title: `Iniciativa ${id}`, status: 'in_progress', category_id: 'c1', ...(options.extra || {}) },
    milestones: views,
    health: initiativeHealth(views),
    hasMilestones: views.length > 0,
  }
}

const future = ['2026-07-01', '2026-07-10', '2026-07-20', '2026-08-01', '2026-08-15', '2026-09-01', '2026-09-30']
const past = ['2026-05-01', '2026-05-10', '2026-05-20', '2026-06-01', '2026-06-10', '2026-09-01', '2026-09-30']

test('la etapa actual es el primer hito sin fecha real y sin hitos no se inventa una etapa', () => {
  assert.equal(currentStage(schedule('a')), 'sin_hitos')
  assert.equal(currentStage(schedule('b', { dates: future, done: 2 })), 'invitacion')
  assert.equal(currentStage(schedule('c', { dates: future, done: 7 })), 'completada')
})

test('el cumplimiento solo mide iniciativas con fechas y las demás se informan aparte', () => {
  const items = [schedule('a', { dates: future }), schedule('b', { dates: past }), schedule('c'), schedule('d', { dates: future, blockAt: 0 })]
  const result = planCompliance(items)
  assert.equal(result.total, 4)
  assert.equal(result.noDates, 1)
  assert.equal(result.measured, 3)
  assert.equal(result.late, 1)
  assert.equal(result.blocked, 1)
  assert.equal(result.onTrack, 1)
  assert.equal(result.pct, 33)
  assert.equal(planCompliance([schedule('x')]).pct, null, 'sin fechas no hay porcentaje, no 0 ni 100')
})

test('las iniciativas cerradas o canceladas no cuentan en el cumplimiento', () => {
  const closed = schedule('z', { dates: past, extra: { status: 'completed' } })
  assert.equal(planCompliance([closed]).total, 0)
  assert.equal(riskInitiatives([closed]).length, 0)
})

test('en riesgo: primero las bloqueadas y luego las atrasadas por días de atraso', () => {
  const late1 = schedule('l1', { dates: past })
  const blocked = schedule('b1', { dates: future, blockAt: 0 })
  const ok = schedule('ok', { dates: future })
  const risky = riskInitiatives([late1, ok, blocked])
  assert.deepEqual(risky.map(item => item.initiative.id), ['b1', 'l1'])
})

test('la matriz por categoría cuenta cada iniciativa una sola vez y conserva las iniciativas de origen', () => {
  const items = [schedule('a', { dates: future }), schedule('b', { dates: future, done: 1 }), schedule('c', { extra: { category_id: null } })]
  const rows = stageMatrix(items, assignments)
  assert.equal(rows.reduce((total, row) => total + row.total, 0), 3)
  const c1 = rows.find(row => row.categoryId === 'c1')!
  assert.equal(c1.counts.inicio, 1)
  assert.equal(c1.counts.preparacion_rfx, 1)
  assert.equal(c1.items.length, 2)
  assert.ok(rows.find(row => row.key === 'sin_categoria'), 'lo sin categoría queda visible')
})

test('la carga por persona usa el responsable efectivo, cuenta suplentes y muestra lo que no tiene responsable', () => {
  const items = [
    schedule('a', { dates: past }),
    schedule('b', { dates: future, extra: { responsible_user_id: 'carla' } }),
    schedule('c', { dates: future, extra: { category_id: 'c2' } }),
  ]
  const load = personLoad(items, assignments)
  const ana = load.find(row => row.userId === 'ana')!
  assert.deepEqual([ana.owner, ana.late], [1, 1])
  assert.equal(load.find(row => row.userId === 'beto')?.backup, 2, 'beto es suplente en c1 de a y de b')
  assert.equal(load.find(row => row.userId === 'carla')?.owner, 1)
  assert.equal(load.find(row => row.userId === null)?.owner, 1)
})

test('próximos hitos: dentro de la ventana, sin completados ni atrasados, ordenados por fecha', () => {
  const items = [schedule('a', { dates: ['2026-06-20', '2026-06-25', '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05'] }), schedule('b', { dates: past })]
  const upcoming = upcomingMilestones(items, TODAY, 30)
  assert.deepEqual(upcoming.map(entry => `${entry.item.initiative.id}:${entry.view.kind}`), ['a:inicio', 'a:preparacion_rfx'])
  assert.equal(milestonesByStatus(items, 'late').every(entry => entry.item.initiative.id === 'b'), true)
})
