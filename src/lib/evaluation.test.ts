import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateBids, recommendationReport, type EvaluationInput } from './evaluation.ts'

const model: EvaluationInput = {
  technicalWeight: 60,
  economicWeight: 40,
  technicalThreshold: 70,
  scaleMax: 100,
  criteria: [
    { id: 'exp', name: 'Experiencia', kind: 'technical', weight: 50 },
    { id: 'met', name: 'Metodología', kind: 'technical', weight: 50 },
    { id: 'hab', name: 'Habilitación', kind: 'mandatory', weight: 0 },
  ],
  scores: [
    { criterionId: 'exp', supplierId: 'alfa', evaluatorId: 'e1', score: 90, failedMandatory: false },
    { criterionId: 'met', supplierId: 'alfa', evaluatorId: 'e1', score: 80, failedMandatory: false },
    { criterionId: 'hab', supplierId: 'alfa', evaluatorId: 'e1', score: null, failedMandatory: false },
    { criterionId: 'exp', supplierId: 'beta', evaluatorId: 'e1', score: 70, failedMandatory: false },
    { criterionId: 'met', supplierId: 'beta', evaluatorId: 'e1', score: 74, failedMandatory: false },
    { criterionId: 'hab', supplierId: 'beta', evaluatorId: 'e1', score: null, failedMandatory: false },
    { criterionId: 'exp', supplierId: 'gamma', evaluatorId: 'e1', score: 40, failedMandatory: false },
    { criterionId: 'met', supplierId: 'gamma', evaluatorId: 'e1', score: 40, failedMandatory: false },
    { criterionId: 'hab', supplierId: 'gamma', evaluatorId: 'e1', score: null, failedMandatory: true },
  ],
  bids: [
    { supplierId: 'alfa', amount: 150000, currency: 'USD', lineCount: 2 },
    { supplierId: 'beta', amount: 130000, currency: 'USD', lineCount: 2 },
    { supplierId: 'gamma', amount: 90000, currency: 'USD', lineCount: 1 },
  ],
}

test('el más barato queda fuera y no gana el menor precio habilitado', () => {
  const results = evaluateBids(model)
  const gamma = results.find(item => item.supplierId === 'gamma')
  const alfa = results.find(item => item.supplierId === 'alfa')
  const beta = results.find(item => item.supplierId === 'beta')
  assert.equal(gamma?.qualified, false)
  assert.match(gamma?.exclusionReason || '', /excluyente/)
  assert.equal(gamma?.scopeAlert, true)
  assert.equal(gamma?.lowBidAlert, true)
  assert.equal(gamma?.economicScore, null)
  assert.equal(alfa?.technicalScore, 85)
  assert.equal(beta?.technicalScore, 72)
  assert.equal(beta?.economicScore, 100)
  assert.equal(alfa?.economicScore, 86.67)
  assert.equal(alfa?.finalScore, 85.67)
  assert.equal(beta?.finalScore, 83.2)
  assert.equal(alfa?.rank, 1)
  assert.equal(beta?.rank, 2)
  const again = evaluateBids(model)
  assert.deepEqual(again.map(item => item.finalScore), results.map(item => item.finalScore))
})

test('dos evaluadores se promedian y monedas distintas no se convierten', () => {
  const results = evaluateBids({
    ...model,
    technicalThreshold: null,
    criteria: model.criteria.filter(item => item.kind === 'technical'),
    scores: [
      { criterionId: 'exp', supplierId: 'alfa', evaluatorId: 'e1', score: 80, failedMandatory: false },
      { criterionId: 'exp', supplierId: 'alfa', evaluatorId: 'e2', score: 100, failedMandatory: false },
      { criterionId: 'met', supplierId: 'alfa', evaluatorId: 'e1', score: 80, failedMandatory: false },
      { criterionId: 'met', supplierId: 'beta', evaluatorId: 'e1', score: 80, failedMandatory: false },
      { criterionId: 'exp', supplierId: 'beta', evaluatorId: 'e1', score: 80, failedMandatory: false },
    ],
    bids: model.bids.filter(item => item.supplierId !== 'gamma'),
  })
  assert.equal(results.find(item => item.supplierId === 'alfa')?.technicalScore, 85)
  assert.throws(() => evaluateBids({
    ...model,
    bids: [
      { supplierId: 'alfa', amount: 10, currency: 'USD', lineCount: 1 },
      { supplierId: 'beta', amount: 10, currency: 'CLP', lineCount: 1 },
    ],
  }), /monedas distintas/)
})

test('el informe dice que recomendar no adjudica', () => {
  const text = recommendationReport({
    title: 'Mantenimiento',
    supplierName: 'Alfa',
    technicalNote: 'Mejor metodología',
    economicNote: 'No es la más barata',
    notLowest: true,
    results: evaluateBids(model),
    names: { alfa: 'Alfa', beta: 'Beta', gamma: 'Gamma' },
    technicalWeight: 60,
    economicWeight: 40,
  })
  assert.match(text, /no adjudica/)
  assert.match(text, /No es la oferta de menor precio/)
  assert.match(text, /1\. Alfa:/)
  assert.match(text, /Partidas incompletas/)
})
