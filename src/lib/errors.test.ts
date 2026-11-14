import assert from 'node:assert/strict'
import test from 'node:test'
import { errorMessage } from './errors.ts'

test('un error plano de PostgREST se muestra al usuario', () => {
  const message = errorMessage(
    { message: 'invalid input value for enum licitacion_category: "Mantenimiento industrial"' },
    'No se pudo crear la licitación.',
  )
  assert.match(message, /categoría escrita/)
  assert.equal(errorMessage({ message: '' }, 'No se pudo crear la iniciativa.'), 'No se pudo crear la iniciativa.')
})
