import assert from 'node:assert/strict'
import test from 'node:test'
import { decisionAfterVotes, estimateAwardSavings, executiveReport, voteBlockReason, type PacketSnapshot } from './award.ts'

test('adjudicar al presupuesto deja el ahorro estimado en cero y conserva el objetivo', () => {
  const verdict = estimateAwardSavings({
    budget: 150000,
    baseline: 150000,
    baselineCurrency: 'USD',
    baselineSource: 'budget',
    targetSavings: 12000,
    awardedAmount: 150000,
    awardedCurrency: 'USD',
    scopeComparable: true,
  })
  assert.equal(verdict.estimatedSavings, 0)
  assert.equal(verdict.estimatedPercentage, 0)
  assert.equal(verdict.targetSavings, 12000)
  assert.equal(verdict.realizedSavings, null)
  assert.match(verdict.note, /presupuesto/)
  assert.match(verdict.note, /no se copia como resultado/)
})

test('sin alcance comparable o con otra moneda no se inventa ahorro', () => {
  const scope = estimateAwardSavings({
    budget: 150000,
    baseline: 150000,
    baselineCurrency: 'USD',
    baselineSource: 'budget',
    targetSavings: 12000,
    awardedAmount: 90000,
    awardedCurrency: 'USD',
    scopeComparable: false,
  })
  assert.equal(scope.estimatedSavings, null)
  assert.match(scope.note, /alcance/)
  const currency = estimateAwardSavings({
    budget: 150000,
    baseline: 150000,
    baselineCurrency: 'USD',
    baselineSource: 'historical',
    targetSavings: null,
    awardedAmount: 1000000,
    awardedCurrency: 'CLP',
    scopeComparable: true,
  })
  assert.equal(currency.estimatedSavings, null)
  assert.match(currency.note, /monedas distintas/)
})

test('un ahorro negativo se conserva y el quórum no se autoaprueba', () => {
  const verdict = estimateAwardSavings({
    budget: 100,
    baseline: 100,
    baselineCurrency: 'USD',
    baselineSource: 'historical',
    targetSavings: 10,
    awardedAmount: 130,
    awardedCurrency: 'usd',
    scopeComparable: true,
  })
  assert.equal(verdict.estimatedSavings, -30)
  assert.equal(decisionAfterVotes({ required: 2, votes: [{ vote: 'approved' }] }), 'pending')
  assert.equal(decisionAfterVotes({ required: 2, votes: [{ vote: 'approved' }, { vote: 'approved' }] }), 'approved')
  assert.equal(decisionAfterVotes({ required: 1, votes: [{ vote: 'returned' }] }), 'returned')
  assert.equal(voteBlockReason({
    voterId: 'buyer',
    preparerId: 'buyer',
    allowSelf: false,
    role: 'admin',
    approverRoles: ['admin', 'manager'],
  }), 'Quien recomienda no puede aprobar su propia solicitud.')
  assert.equal(voteBlockReason({
    voterId: 'manager',
    preparerId: 'buyer',
    allowSelf: false,
    role: 'manager',
    approverRoles: ['admin', 'manager'],
  }), null)
})

test('el informe separa objetivo, estimado y realizado', () => {
  const snapshot: PacketSnapshot = {
    title: 'Mantenimiento',
    licitacionId: 'LIC-F1B-MANT',
    initiativeTitle: 'Mantenimiento industrial',
    objective: 'Mantener la planta',
    scope: 'Preventivo y repuestos',
    budget: 150000,
    currency: 'USD',
    baselineSource: 'budget',
    invited: [{ name: 'Alfa', status: 'accepted' }],
    offers: [],
    model: { technicalWeight: 60, economicWeight: 40, threshold: 70, formula: 'menor precio habilitado', criteria: [] },
    recommendation: 'Se recomienda Alfa.',
    recommendedSupplier: 'Alfa',
    savings: estimateAwardSavings({
      budget: 150000,
      baseline: 150000,
      baselineCurrency: 'USD',
      baselineSource: 'budget',
      targetSavings: 12000,
      awardedAmount: 150000,
      awardedCurrency: 'USD',
      scopeComparable: true,
    }),
    risks: 'Sin stock crítico el plazo se alarga.',
    exceptions: '',
    observations: '',
  }
  const text = executiveReport(snapshot)
  assert.match(text, /Ahorro objetivo de la iniciativa: USD 12000/)
  assert.match(text, /Ahorro estimado de la recomendación: USD 0/)
  assert.match(text, /Ahorro realizado: sin evidencia posterior/)
  assert.match(text, /no publica la adjudicación/)
})
