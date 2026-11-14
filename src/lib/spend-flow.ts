import type { SISpendLine, SIUploadStatus } from '@/types'

export type SpendStep = 'cargar' | 'mapear' | 'clasificar' | 'revisar' | 'ver' | 'descargar'

export type ClassificationSource = 'regla' | 'taxonomia' | 'llm' | 'humano' | 'modelo' | 'pendiente'

export const SPEND_STEPS: Array<{
  id: SpendStep
  label: string
  hint: string
}> = [
  { id: 'cargar', label: 'Cargar', hint: 'Sube el Excel o CSV de gasto' },
  { id: 'mapear', label: 'Mapear', hint: 'Confirma qué columna es cada cosa' },
  { id: 'clasificar', label: 'Clasificar', hint: 'Reglas, modelo o LLM proponen la categoría' },
  { id: 'revisar', label: 'Revisar', hint: 'Lo dudoso lo confirma una persona' },
  { id: 'ver', label: 'Ver', hint: 'Plan, Kraljic e informe de este archivo' },
  { id: 'descargar', label: 'Descargar', hint: 'Excel clasificado con las vistas' },
]

export const SOURCE_LABEL: Record<ClassificationSource, string> = {
  regla: 'Regla de la empresa',
  taxonomia: 'Taxonomía',
  modelo: 'Modelo propio',
  llm: 'LLM general',
  humano: 'Persona',
  pendiente: 'Sin clasificar',
}

export function stepForUpload(status?: SIUploadStatus | string, pending = 0): SpendStep {
  if (!status || status === 'uploaded') return 'mapear'
  if (status === 'processing' || status === 'error') return 'clasificar'
  if (status === 'classified' && pending > 0) return 'revisar'
  if (status === 'classified' || status === 'reviewed') return 'ver'
  if (status === 'completed') return 'ver'
  return 'clasificar'
}

export function hrefForStep(step: SpendStep, uploadId?: string) {
  if (!uploadId) {
    if (step === 'cargar') return '/sourcing-intelligence/upload'
    return '/sourcing-intelligence'
  }
  if (step === 'cargar') return `/sourcing-intelligence/${uploadId}`
  if (step === 'mapear') return `/sourcing-intelligence/${uploadId}/mapear`
  if (step === 'clasificar') return `/sourcing-intelligence/${uploadId}/classify?paso=clasificar`
  if (step === 'revisar') return `/sourcing-intelligence/${uploadId}/classify?paso=revisar`
  if (step === 'ver') return `/sourcing-intelligence/${uploadId}/kraljic`
  if (step === 'descargar') return `/api/si/export?upload_id=${uploadId}`
  return `/sourcing-intelligence/${uploadId}`
}

export function hrefForSource(source: ClassificationSource) {
  const tab =
    source === 'regla' || source === 'humano' ? 'reglas'
    : source === 'taxonomia' ? 'taxonomia'
    : source === 'modelo' ? 'modelo'
    : 'modelo'
  return `/sourcing-intelligence/cerebro?tab=${tab}`
}

export function inferClassificationSource(line: {
  category?: string | null
  needs_review?: boolean | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  ai_justification?: string | null
}): ClassificationSource {
  const category = String(line.category || '').trim().toLowerCase()
  if (!category || category === 'sin categoría' || category === 'sin categoria') return 'pendiente'
  if (line.reviewed_at || line.reviewed_by) return 'humano'
  const text = String(line.ai_justification || '').toLowerCase()
  if (!text) return 'regla'
  if (text.includes('modelo general')) return 'llm'
  if (text.includes('regla de la empresa') || text.includes('el proveedor coincide') || text.includes('palabra clave') || text.includes('familia habitual') || text.includes('ya fue corregida')) return 'regla'
  if (text.includes('taxonom') || text.includes('catálogo de xpend')) return 'taxonomia'
  if (text.includes('modelo propio') || text.includes('modelo entrenado')) return 'modelo'
  return 'llm'
}

export function sourceExplain(source: ClassificationSource) {
  switch (source) {
    case 'regla':
      return 'Esta empresa ya había etiquetado un proveedor o una palabra. El dato no salió de Xpend.'
    case 'taxonomia':
      return 'La descripción calzó con un nodo del catálogo de Xpend.'
    case 'modelo':
      return 'La propuso el modelo entrenado con la base de aprendizaje. Aún no hay uno publicado.'
    case 'llm':
      return 'La propuso un modelo general, solo con el texto limpio. Queda para revisión si la confianza es baja.'
    case 'humano':
      return 'Una persona de esta empresa confirmó o corrigió la categoría. Eso crea una regla local.'
    default:
      return 'Todavía no tiene categoría.'
  }
}
