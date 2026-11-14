/**
 * Estado visible del cerebro de Xpend.
 * El modelo propio vive en data/xpend-taxonomia-v1.json y corre en el servidor.
 */

export type BrainModelStatus = 'no_entrenado' | 'publicado'

export const BRAIN = {
  model: {
    status: 'publicado' as BrainModelStatus,
    name: 'xpend-taxonomia-v1',
    trained_at: '2026-11-06',
    held_out_accuracy: 0.814,
    note: '62.037 textos, 69 categorías de la taxonomía Xpend. Retail no entra. Orden: regla de la empresa, luego este modelo, luego LLM si un admin lo autorizó.',
  },
  base: {
    updated_at: '2026-11-06',
    trainable_rows: 63235,
    review_rows: 6276,
    empty_cells: 0,
    unmapped: 670,
    industries: [
      { name: 'Salud', rows: 15400, trains: true },
      { name: 'Alimentos y bebidas', rows: 14426, trains: true },
      { name: 'Construcción', rows: 9316, trains: true },
      { name: 'Servicios financieros', rows: 5993, trains: true },
      { name: 'Servicios profesionales', rows: 917, trains: true },
      { name: 'sin industria', rows: 16692, trains: true },
      { name: 'Retail', rows: 491, trains: false, reason: 'Pocos textos y demasiadas familias. Entra cuando haya volumen.' },
    ],
  },
  trainings: [
    {
      id: 'prep-2026-11-05',
      at: '2026-11-05',
      kind: 'preparacion',
      title: 'Base óptima armada',
      detail: '62.320 textos con etiqueta estable. Brasil, cuentas en inglés y códigos de centro se corrigieron. No se entrenó un modelo.',
      rows: 62320,
    },
    {
      id: 'salud-2026-11-06',
      at: '2026-11-06',
      kind: 'preparacion',
      title: 'Salud por clasificar completada',
      detail: '957 textos de las dos clínicas etiquetados en local (reglas + Ollama). Origen = Sugerencia local, no consultor. 735 se descartaron (en blanco, meses, texto vacío). Salud entrenable: 15.400.',
      rows: 957,
    },
    {
      id: 'modelo-2026-11-06',
      at: '2026-11-06',
      kind: 'modelo',
      title: 'xpend-taxonomia-v1 publicado',
      detail: 'Clasificador local TF-IDF + regresión logística. 81,4% de acierto en textos no vistos. Salud 79%, construcción 89%. Retail afuera.',
      rows: 62037,
    },
  ],
}

export function modelInUseLabel() {
  if (BRAIN.model.status === 'publicado' && BRAIN.model.name) return BRAIN.model.name
  return 'Reglas de la empresa + LLM general. Modelo propio: aún no entrenado.'
}
