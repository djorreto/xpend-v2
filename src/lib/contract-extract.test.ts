import assert from 'node:assert/strict'
import test from 'node:test'
import { extractContractSignals, renderContract } from './contract-extract.ts'

const sample = `
Contrato de mantenimiento. Contraparte: Mantención Alfa.
Objeto: mantenimiento preventivo mensual de la planta.
Vigencia desde el 2026-01-01 hasta el 2026-12-31.
Monto USD 150000. Pago a 30 días de la factura.
Renovación automática salvo aviso. Preaviso de 60 días.
Reajuste anual según el índice que las partes indiquen en el anexo.
Terminación por incumplimiento grave.
Obligación del proveedor de mantener stock crítico.
Multa de 1% por día de atraso, con tope.
Garantía de fiel cumplimiento.
Confidencialidad de los planos.
No hay exclusividad territorial.
`

test('la extracción cita el texto y no completa lo que no está', () => {
  const { fields, findings } = extractContractSignals(sample)
  const amount = fields.find(field => field.fieldKey === 'amount')
  assert.equal(amount?.value, '150000')
  assert.match(amount?.quote || '', /USD 150000/)
  assert.match(amount?.location || '', /caracteres/)
  assert.equal(fields.find(field => field.fieldKey === 'renewal')?.value, 'automatic')
  assert.equal(fields.find(field => field.fieldKey === 'notice_days')?.value, '60')
  assert.equal(fields.some(field => field.fieldKey === 'sla'), false)
  assert.ok(findings.some(item => item.kind === 'exclusivity' && item.quote.toLowerCase().includes('exclusividad')))
  assert.ok(findings.some(item => item.kind === 'penalty' && item.quote.includes('Multa')))
})

test('un texto vacío no inventa campos', () => {
  const { fields, findings } = extractContractSignals('hola')
  assert.equal(fields.length, 0)
  assert.equal(findings.length, 0)
})

test('la plantilla conserva las variables vacías y agrega solo las cláusulas elegidas', () => {
  const text = renderContract('Monto {{moneda}} {{monto}}. Objeto: {{objeto}}.', { moneda: 'USD', monto: '150000', objeto: '' }, ['Confidencialidad acordada.'])
  assert.match(text, /USD 150000/)
  assert.match(text, /\{\{objeto\}\}/)
  assert.match(text, /Confidencialidad acordada/)
})
