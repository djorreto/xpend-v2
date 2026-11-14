import assert from 'node:assert/strict'
import test from 'node:test'
import { coverageShares, paretoIds, type CoverageRow } from './spend-coverage.ts'

test('pareto toma el gasto alto hasta el corte y deja la cola afuera', () => {
  const rows: CoverageRow[] = [
    { id: 'a', amount: 70, currency: 'CLP', source: 'pendiente' },
    { id: 'b', amount: 20, currency: 'CLP', source: 'pendiente' },
    { id: 'c', amount: 10, currency: 'CLP', source: 'pendiente' },
    { id: 'd', amount: 50, currency: 'USD', source: 'pendiente' },
    { id: 'e', amount: 50, currency: 'USD', source: 'pendiente' },
  ]
  const scope = paretoIds(rows, 80)
  assert.equal(scope.has('a'), true)
  assert.equal(scope.has('b'), true)
  assert.equal(scope.has('c'), false)
  assert.equal(scope.has('d'), true)
  assert.equal(scope.has('e'), true)
  const full = paretoIds(rows, 100)
  assert.equal(full.has('c'), true)
  const withZero = paretoIds(
    [...rows, { id: 'z', amount: 0, currency: 'CLP', source: 'pendiente' }],
    80,
  )
  assert.equal(withZero.has('z'), false)
  assert.equal(paretoIds([{ id: 'z', amount: 0, currency: 'CLP', source: 'pendiente' }], 100).has('z'), true)
})

test('una línea ya categorizada conserva su color aunque quede bajo el corte', () => {
  const rows: CoverageRow[] = [
    { id: 'a', amount: 80, currency: 'CLP', source: 'modelo' },
    { id: 'b', amount: 20, currency: 'CLP', source: 'modelo' },
  ]
  const scope = paretoIds(rows, 80)
  const shares = coverageShares(rows, scope)
  assert.equal(scope.has('b'), false)
  assert.equal(Math.round(shares[0].shares.modelo), 100)
  assert.equal(Math.round(shares[0].shares.gris), 0)
  assert.equal(Math.round(shares[0].corte), 100)
})
test('la barra separa modelo, IA, manual, gris y lo que falta', () => {
  const rows: CoverageRow[] = [
    { id: 'a', amount: 50, currency: 'CLP', source: 'modelo' },
    { id: 'b', amount: 30, currency: 'CLP', source: 'llm' },
    { id: 'c', amount: 20, currency: 'CLP', source: 'pendiente' },
  ]
  const shares = coverageShares(rows, new Set(['a', 'b']))
  assert.equal(Math.round(shares[0].shares.modelo), 50)
  assert.equal(Math.round(shares[0].shares.ia), 30)
  assert.equal(Math.round(shares[0].shares.gris), 20)
  assert.equal(Math.round(shares[0].shares.pendiente), 0)
})
