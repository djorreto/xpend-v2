import assert from 'node:assert/strict'
import test from 'node:test'
import { recommendationReport, type SupplierResult } from './evaluation.ts'
import { parseRecommendationReport } from './evaluation-report.ts'

const results = [
  { supplierId: 'a', currency: 'USD', totalAmount: 150000, technicalScore: 85, economicScore: 86.67, finalScore: 85.67, qualified: true, rank: 1 },
  { supplierId: 'b', currency: 'USD', totalAmount: 130000, technicalScore: 70, economicScore: 100, finalScore: 82, qualified: true, rank: 2 },
  { supplierId: 'c', currency: 'USD', totalAmount: 90000, technicalScore: 60, economicScore: null, finalScore: null, qualified: false, rank: null, exclusionReason: 'Incumple requisito excluyente: Habilitación', lowBidAlert: true, scopeAlert: true },
] as unknown as SupplierResult[]

const text = recommendationReport({
  title: 'Mantenimiento industrial evaluación',
  supplierName: 'Mantención Alfa',
  technicalNote: 'Cumple todos los requisitos.\nIncluye plan de mantención.',
  economicNote: 'Precio dentro del rango.',
  notLowest: true,
  results,
  names: { a: 'Mantención Alfa', b: 'Mantención Beta', c: 'Mantención Gamma' },
  technicalWeight: 60,
  economicWeight: 40,
})

test('el informe persistido se ordena en secciones sin cambiar ninguna cifra', () => {
  const report = parseRecommendationReport(text)!
  assert.equal(report.title, 'Mantenimiento industrial evaluación')
  assert.deepEqual(report.method.length, 2)
  assert.deepEqual(report.disclaimer, ['Esta recomendación no adjudica.'])
  assert.deepEqual(report.ranking.map(row => [row.rank, row.supplier, row.final, row.amount]), [
    [1, 'Mantención Alfa', '85.67', '150000'],
    [2, 'Mantención Beta', '82', '130000'],
    [null, 'Mantención Gamma', 'sin puntaje final', '90000'],
  ])
  assert.deepEqual(report.ranking[2].notes, ['Incumple requisito excluyente: Habilitación', 'Alerta de precio bajo', 'Partidas incompletas'])
  assert.match(report.recommendation.join(' '), /Se recomienda a Mantención Alfa/)
  assert.match(report.recommendation.join(' '), /No es la oferta de menor precio/)
  assert.deepEqual(report.notes.map(note => note.label), ['Nota técnica', 'Nota económica'])
  assert.equal(report.notes[0].text, 'Cumple todos los requisitos.\nIncluye plan de mantención.')
  assert.deepEqual(report.other, [])
})

test('ninguna línea del informe original se pierde ni se inventa', () => {
  const report = parseRecommendationReport(text)!
  const rebuilt = [
    report.title, ...report.method, ...report.disclaimer, ...report.recommendation, ...report.other,
    ...report.notes.map(note => `${note.label}: ${note.text}`),
    ...report.ranking.map(row => `${row.supplier} ${row.technical} ${row.economic} ${row.final} ${row.currency} ${row.amount} ${row.notes.join(' ')}`),
  ].join(' ')
  for (const token of ['85.67', '82', '150000', '130000', '90000', '60%', '40%', 'Habilitación', 'Incluye plan de mantención']) {
    assert.ok(rebuilt.includes(token), token)
  }
})

test('un texto con otro formato no se interpreta: se muestra tal cual', () => {
  assert.equal(parseRecommendationReport('Texto libre del comité'), null)
  assert.equal(parseRecommendationReport(''), null)
  assert.equal(parseRecommendationReport(null), null)
})
