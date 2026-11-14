import assert from 'node:assert/strict'
import test from 'node:test'
import { awardContractDraft } from './award-contract.ts'

test('el borrador hereda el monto adjudicado y deja pendientes las fechas que no existen', () => {
  const draft = awardContractDraft({
    companyName: 'Fase0 Compradora',
    supplierName: 'Mantención Alfa',
    supplierRut: '76.000.000-0',
    licitacionId: 'LIC-F1B-MANT',
    licitacionName: 'Mantenimiento',
    scope: 'Mantenimiento preventivo de planta',
    technical: 'Cuadrilla residente.',
    answers: ['Disponibilidad 24/7.'],
    lines: [{ description: 'Mano de obra', quantity: 12, unit: 'mes', unitPrice: 8000, currency: 'USD' }],
    amount: 150000,
    currency: 'USD',
    conditions: 'Alcance completo.',
    observations: 'No es la más barata.',
    files: ['alfa-tecnico.txt'],
    ownerName: 'Fase 0 buyer',
    templateBody: 'Entre {{contratante}} y {{contraparte}}. Objeto: {{objeto}}. Monto {{moneda}} {{monto}}. Desde {{inicio}}.',
    variables: { periodicidad: 'mensual' },
    clauses: [],
  })
  assert.match(draft.body, /USD 150000/)
  assert.match(draft.body, /Mano de obra: 12 mes/)
  assert.match(draft.body, /No se convierten en cláusulas jurídicas/)
  assert.match(draft.body, /\{\{inicio\}\}/)
  assert.ok(draft.pending.some(field => field.key === 'inicio'))
  assert.ok(draft.confirmed.some(fact => fact.label === 'Monto adjudicado'))
  assert.equal(draft.body.includes('cláusula de multa'), false)
  assert.equal(draft.body.includes('Datos confirmados'), false)
  assert.ok(draft.pending.some(field => field.key === 'renovacion'))
})
