import assert from 'node:assert/strict'
import test from 'node:test'
import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'
import { buildContractDocx, buildContractPdf, structureContractText } from './contract-document.ts'

const model = {
  code: 'CTR-LIC-F1B-MANT',
  title: 'Contrato Mantención Alfa',
  version: 2,
  buyer: 'Fase0 Compradora',
  supplier: 'Mantención Alfa',
  supplierRut: '76.000.000-0',
  currency: 'USD',
  amount: '150000',
  clauses: [{ title: 'Objeto', text: 'Mantenimiento preventivo de la planta.' }],
  lines: [{ description: 'Mano de obra preventiva', quantity: '12', unit: 'mes', unitPrice: '8000', currency: 'USD' }],
  annexes: ['Anexo comercial. Partidas de la oferta adjudicada.'],
}

test('el docx y el pdf de la versión aprobada traen partes, cláusula, partida y monto', async () => {
  const docx = await buildContractDocx(model)
  const word = await mammoth.extractRawText({ buffer: docx })
  assert.match(word.value, /Versión aprobada 2/)
  assert.match(word.value, /Fase0 Compradora/)
  assert.match(word.value, /Mantención Alfa/)
  assert.match(word.value, /USD 150000/)
  assert.match(word.value, /1\. Objeto/)
  assert.match(word.value, /Mano de obra preventiva/)
  assert.match(word.value, /Anexo comercial/)

  const pdf = buildContractPdf(model)
  const parser = new PDFParse({ data: pdf })
  const parsed = await parser.getText()
  assert.match(parsed.text, /150000/)
  assert.match(parsed.text, /Mantención Alfa/)
  assert.match(parsed.text, /Mano de obra preventiva/)
  assert.match(parsed.text, /1\. Objeto/)
  assert.match(parsed.text, /Mantenimiento preventivo/)
  assert.match(parsed.text, /Anexo comercial/)
})

test('la exportación separa anexos y deja fuera las notas internas de evaluación', async () => {
  const structured = structureContractText([
    'Objeto: mantenimiento de planta.',
    '',
    'Anexo comercial. Partidas de la oferta.',
    '- Mano de obra preventiva: 12 mes × 8000 USD',
    '',
    'Datos confirmados:',
    '- Observaciones de la evaluación: Alfa obtuvo 85 técnico (recomendación)',
  ].join('\n'))
  assert.equal(structured.clauses.length, 1)
  assert.match(structured.annexes[0], /Anexo comercial/)
  assert.match(structured.references[0], /Datos confirmados/)
  const pdf = buildContractPdf({ ...model, clauses: structured.clauses, annexes: structured.annexes })
  const parser = new PDFParse({ data: pdf })
  const parsed = await parser.getText()
  assert.match(parsed.text, /Anexo comercial/)
  assert.match(parsed.text, /Mano de obra preventiva/)
  assert.equal(parsed.text.includes('Observaciones de la evaluación'), false)
})
