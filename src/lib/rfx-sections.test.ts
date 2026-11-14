import assert from 'node:assert/strict'
import test from 'node:test'
import { basesAreReady, basesMarkdown, basesTextIsReady } from './rfx-sections.ts'

test('un borrador con secciones vacías no queda válido', () => {
  const markdown = basesMarkdown('Mantenimiento', 'RFP', {})
  assert.equal(basesAreReady({}), false)
  assert.equal(basesTextIsReady(markdown), false)
  assert.match(markdown, /Por completar/)
})

test('las bases quedan listas solo con objeto, alcance, requisitos y criterios', () => {
  const values = {
    objeto: 'Mantenimiento industrial preventivo',
    alcance: 'Plantas y equipos críticos',
    requisitos: 'Técnicos certificados y repuestos',
    ponderacion: 'Técnico 60, económico 40',
  }
  assert.equal(basesAreReady(values), true)
  assert.equal(basesTextIsReady(basesMarkdown('Mantenimiento', 'RFP', values)), true)
  assert.equal(basesAreReady({ ...values, ponderacion: 'Por completar' }), false)
})
