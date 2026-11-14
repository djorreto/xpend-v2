/** PostgREST devuelve un objeto plano, no una instancia de Error. */
export function errorMessage(error: unknown, fallback: string) {
  const raw = readMessage(error)
  if (!raw) return fallback
  if (/notes/i.test(raw) && /column|schema cache/i.test(raw)) {
    return 'No se pudieron guardar las observaciones. Aplica la migración de notas en la base local.'
  }
  if (/invalid input value for enum baseline_source/i.test(raw)) {
    return 'La fuente del monto no es válida. Elige presupuesto, línea base histórica u otro.'
  }
  if (/invalid input value for enum licitacion_category/i.test(raw)) {
    return 'Ese texto no es un tipo de proceso. La categoría escrita se guarda aparte; elige servicio o proyecto.'
  }
  if (/row-level security|permission denied/i.test(raw)) {
    return 'No tienes permiso para guardar este registro.'
  }
  return raw
}

function readMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return ''
}
