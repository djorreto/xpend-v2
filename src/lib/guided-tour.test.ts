import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canConfigureTours, canStartTour, parseSteps, readTourState, samePage } from './guided-tour.ts'

const id = '5b1c2a4e-1111-4222-8333-944455556666'

test('los pasos válidos apuntan a pantallas internas y registros reales', () => {
  const { steps, errors } = parseSteps([
    { key: 'gasto', title: 'Gasto', body: 'De dónde parte todo.', href: '/gastos' },
    { key: 'proyecto', title: 'Proyecto', body: 'Plan de trabajo.', href: `/proyectos/${id}?tab=gantt`, record: { table: 'sourcing_projects', id }, target: 'gantt-proyecto' },
  ])
  assert.deepEqual(errors, [])
  assert.equal(steps[1].record?.table, 'sourcing_projects')
  assert.equal(steps[1].target, 'gantt-proyecto')
})

test('rechaza rutas externas, tablas no permitidas y pasos repetidos', () => {
  const { errors } = parseSteps([
    { key: 'a1', title: 'Fuera', body: 'Sitio externo', href: 'https://evil.example' },
    { key: 'a1', title: 'Doble', body: 'Repetido', href: '//evil.example' },
    { key: 'a3', title: 'Tabla', body: 'No permitida', href: '/x', record: { table: 'profiles', id } },
    { key: 'a4', title: 'Api', body: 'No navegable', href: '/api/ana' },
  ])
  assert.equal(errors.length, 5)
  assert.deepEqual(parseSteps('nada').errors, ['El recorrido no tiene pasos.'])
})

test('solo las empresas demo ofrecen recorridos, y el proveedor solo el del portal', () => {
  assert.equal(canStartTour('analyst', 'internal', true), true)
  assert.equal(canStartTour('manager', 'internal', false), false)
  assert.equal(canStartTour('supplier', 'internal', true), false)
  assert.equal(canStartTour('supplier', 'supplier', true), true)
  assert.equal(canStartTour('admin', 'supplier', true), false)
  assert.equal(canConfigureTours('admin', true), true)
  assert.equal(canConfigureTours('manager', true), false)
  assert.equal(canConfigureTours('super_admin', false), false)
})

test('reconoce la pantalla del paso y recupera un estado guardado', () => {
  assert.equal(samePage('/proyectos/x?tab=gantt', '/proyectos/x', '?tab=gantt&tarea=1'), true)
  assert.equal(samePage('/proyectos/x?tab=gantt', '/proyectos/x', '?tab=resumen'), false)
  assert.deepEqual(readTourState({ getItem: () => JSON.stringify({ tourId: 't', index: 2 }) }), { tourId: 't', index: 2 })
  assert.equal(readTourState({ getItem: () => '{roto' }), null)
  assert.equal(readTourState({ getItem: () => JSON.stringify({ tourId: 't', index: -1 }) }), null)
})
