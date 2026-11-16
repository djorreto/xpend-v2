import assert from 'node:assert/strict'
import test from 'node:test'
import { COMPLETE, LIGHT, REQUIRED_EVENTS, scheduleTasks, validateDefinition } from './methodology.ts'

test('plantillas del sistema: válidas, Completa con 8 etapas, 29 actividades y 11 entregables', () => {
  assert.deepEqual(validateDefinition(LIGHT), [])
  assert.deepEqual(validateDefinition(COMPLETE), [])
  assert.equal(LIGHT.stages.length, 5)
  assert.equal(COMPLETE.stages.length, 8)
  assert.equal(COMPLETE.tasks.length, 29)
  assert.equal(COMPLETE.deliverables.length, 11)
  assert.deepEqual(COMPLETE.tasks.map(task => Number(task.code)).sort((a, b) => a - b), Array.from({ length: 29 }, (_, index) => index + 1))
  for (const definition of [LIGHT, COMPLETE]) {
    for (const event of REQUIRED_EVENTS) assert.ok(definition.tasks.some(task => task.event === event && !task.optional), `evento ${event}`)
  }
})

test('validación: rechaza dependencias hacia adelante, eventos obligatorios opcionales y etapas inexistentes', () => {
  const forward = { ...LIGHT, tasks: [{ ...LIGHT.tasks[0], depends: ['l9'] }, ...LIGHT.tasks.slice(1)] }
  assert.ok(validateDefinition(forward).some(error => error.includes('depende')))
  const optionalEvent = { ...LIGHT, tasks: LIGHT.tasks.map(task => task.event === 'award_decided' ? { ...task, optional: true } : task) }
  assert.ok(validateDefinition(optionalEvent).some(error => error.includes('obligatorio')))
  const missing = { ...LIGHT, tasks: LIGHT.tasks.filter(task => task.event !== 'offers_opened').map(task => ({ ...task, depends: task.depends.filter(dep => dep !== 'l5') })) }
  assert.ok(validateDefinition(missing).some(error => error.includes('Falta')))
  const badStage = { ...LIGHT, tasks: LIGHT.tasks.map((task, index) => index === 0 ? { ...task, stage: 'ZZ' } : task) }
  assert.ok(validateDefinition(badStage).some(error => error.includes('etapa')))
})

test('calendario: cada tarea empieza al día siguiente de su última dependencia', () => {
  const plan = scheduleTasks(COMPLETE, '2027-01-04')
  const byKey = Object.fromEntries(plan.map(item => [item.key, item]))
  assert.deepEqual(byKey.a1, { key: 'a1', start: '2027-01-04', end: '2027-01-05' })
  assert.equal(byKey.a2.start, '2027-01-06')
  // a9 depende de a5, a8 y a11: parte después de la más tardía.
  const latest = ['a5', 'a8', 'a11'].map(key => byKey[key].end).sort().pop()!
  const next = new Date(`${latest}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  assert.equal(byKey.a9.start, next.toISOString().slice(0, 10))
})
