import assert from 'node:assert/strict'
import test from 'node:test'
import { availablePerspectives, defaultPerspective, resolvePerspective } from './perspective.ts'

test('Super Admin ve las tres perspectivas y Gerencia es la predeterminada', () => {
  assert.deepEqual(availablePerspectives('super_admin'), ['gerencia', 'trabajo', 'administracion'])
  assert.equal(defaultPerspective('super_admin'), 'gerencia')
})

test('cada rol solo recibe las perspectivas que sus permisos justifican', () => {
  assert.deepEqual(availablePerspectives('manager'), ['gerencia', 'trabajo'])
  assert.deepEqual(availablePerspectives('analyst'), ['trabajo'])
  assert.deepEqual(availablePerspectives('viewer'), [])
  assert.deepEqual(availablePerspectives('supplier'), [])
  assert.ok(availablePerspectives('admin').includes('administracion'))
})

test('una perspectiva pedida que el rol no tiene se ignora (no hay escalamiento por URL)', () => {
  assert.equal(resolvePerspective('administracion', 'manager'), 'gerencia')
  assert.equal(resolvePerspective('gerencia', 'analyst'), 'trabajo')
  assert.equal(resolvePerspective('trabajo', 'super_admin'), 'trabajo')
  assert.equal(resolvePerspective('inventada', 'super_admin'), 'gerencia')
  assert.equal(resolvePerspective(null, 'viewer'), 'trabajo')
})
