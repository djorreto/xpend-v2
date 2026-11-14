import assert from 'node:assert/strict'
import test from 'node:test'
import { licitacionDocumentPath, supplierNdaPath } from './storage-paths.ts'

const COMPANY = '11111111-1111-4111-8111-111111111111'

test('las bases quedan segregadas por empresa y licitación', () => {
  assert.equal(
    licitacionDocumentPath(COMPANY, 'LIC-2026-001', 'bases finales.PDF', 123),
    `${COMPANY}/licitaciones/LIC-2026-001/123-bases.pdf`
  )
})

test('el NDA queda segregado por empresa y proveedor', () => {
  assert.equal(
    supplierNdaPath(COMPANY, 'supplier-123', 'acuerdo.docx', 456),
    `${COMPANY}/supplier-123/456-nda.docx`
  )
})

test('rechaza segmentos que permitirían escapar de la carpeta del tenant', () => {
  assert.throws(
    () => licitacionDocumentPath(COMPANY, '../otro-tenant', 'bases.pdf'),
    /licitación/
  )
  assert.throws(
    () => supplierNdaPath('no-es-uuid', 'supplier-123', 'nda.pdf'),
    /empresa/
  )
})
