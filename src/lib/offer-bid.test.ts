import assert from 'node:assert/strict'
import test from 'node:test'
import { bidTotal, lineTotal, ndaBlocksDocuments, receptionClosed, technicalIsComplete } from './offer-bid.ts'

test('el total de la oferta suma partidas y rechaza una línea vacía', () => {
  assert.equal(lineTotal(2, 1500.5), 3001)
  assert.equal(bidTotal([
    { description: 'Preventivo', quantity: 12, unit: 'mes', unitPrice: 8000 },
    { description: 'Repuestos', quantity: 1, unit: 'gl', unitPrice: 54000 },
  ]), 150000)
  assert.equal(bidTotal([{ description: '', quantity: 1, unit: 'gl', unitPrice: 10 }]), null)
  assert.equal(bidTotal([
    { description: 'Mano de obra parcial', quantity: 12, unit: 'mes', unitPrice: 7500 },
    { description: '', quantity: 1, unit: 'gl', unitPrice: 0 },
  ]), 90000)
})

test('el NDA vigente bloquea documentos y un plazo vencido cierra la recepción', () => {
  assert.equal(ndaBlocksDocuments({ required: true, acceptedVersion: null, currentVersion: '1' }), true)
  assert.equal(ndaBlocksDocuments({ required: true, acceptedVersion: '1', currentVersion: '1' }), false)
  assert.equal(ndaBlocksDocuments({ required: false, acceptedVersion: null, currentVersion: '1' }), false)
  assert.equal(technicalIsComplete('Muy corto'), false)
  assert.equal(technicalIsComplete('Mantenimiento mensual de planta'), true)
  assert.equal(receptionClosed({ status: 'closed', closesAt: null }), true)
  assert.equal(receptionClosed({
    status: 'open',
    closesAt: '2026-11-14T12:00:00.000Z',
    now: new Date('2026-11-14T12:00:01.000Z'),
  }), true)
})
