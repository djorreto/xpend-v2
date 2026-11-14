import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { externalAiAllowed, readExternalAi, retainUntilFromSettings } from './spend-privacy.ts'
import { redactSpendDescription, redactOutboundText, stripContactData } from './spend-redaction.ts'

test('la descripción de un bien se puede enviar', () => {
  const result = redactSpendDescription('Toner para impresora laser de oficina')
  assert.equal(result.blocked, false)
  assert.match(result.text, /Toner para impresora/)
})

test('quita proveedor, RUT y monto antes de decidir', () => {
  const result = redactSpendDescription(
    'Sodimac clavos y tornillos RUT 12.345.678-9 por $1.500.000',
    'Sodimac'
  )
  assert.equal(result.text.includes('Sodimac'), false)
  assert.equal(result.text.includes('12.345'), false)
  assert.equal(result.text.includes('1.500'), false)
  assert.equal(result.blocked, false)
  assert.match(result.text, /clavos y tornillos/)
})

test('no envía un nombre propio ni una frase genérica', () => {
  assert.equal(redactSpendDescription('Juan Pérez').reason, 'insuficiente')
  assert.equal(redactSpendDescription('Servicios varios').reason, 'generico')
  assert.equal(redactSpendDescription('Asesoría directorio Juan Pérez').reason, 'generico')
})

test('el prompt de una línea no acepta proveedor ni monto', () => {
  const source = fs.readFileSync(new URL('./spend-assessment.ts', import.meta.url), 'utf8')
  assert.match(source, /export function assessmentPrompt\(description: string\)/)
  assert.equal(source.includes('input.supplier'), false)
  assert.equal(source.includes('input.amount'), false)
  assert.equal(source.includes('REGLAS QUE LA EMPRESA'), false)
  assert.equal(source.includes('batchAssessmentPrompt'), false)
})

test('un listado de gasto no sale por el chat y una factura conserva el monto', () => {
  const dump = ['Clavos 1.500', 'Tornillos $2.000', 'Cemento 3.000', 'Pintura 4.000', 'Flete 5.000'].join('\n')
  assert.equal(redactOutboundText(dump).blocked, true)
  assert.equal(redactOutboundText('Necesito armar un RFP de aseo').blocked, false)
  assert.equal(stripContactData('Factura de aseo RUT 12.345.678-9 por $10.000').includes('12.345'), false)
  assert.match(stripContactData('Factura de aseo RUT 12.345.678-9 por $10.000'), /10\.000/)
})
test('la IA externa nace activa y se apaga con el interruptor', () => {
  assert.equal(externalAiAllowed({}), true)
  assert.equal(externalAiAllowed({ external_ai: { enabled: true } }), true)
  assert.equal(externalAiAllowed({ external_ai: { enabled: false } }), false)
  assert.equal(externalAiAllowed({ external_ai: { enabled: true, accepted_at: '2026-11-05T00:00:00Z' } }), true)
  assert.equal(readExternalAi({ external_ai: { retention_days: 12 } }).retention_days, 365)
  const until = new Date(retainUntilFromSettings({ external_ai: { retention_days: 90 } }, new Date('2026-01-01T00:00:00Z')))
  assert.equal(until.toISOString().slice(0, 10), '2026-04-01')
})
