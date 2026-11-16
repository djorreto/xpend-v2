// Recorridos guiados de las empresas demo. Los pasos viven en public.demo_tours y apuntan a registros reales:
// el recorrido solo navega y lee; nunca crea, cambia ni borra datos de negocio.

export const TOUR_TABLES = [
  'spend_records', 'procurement_categories', 'sourcing_plans', 'initiatives', 'sourcing_projects', 'project_deliverables',
  'licitaciones', 'licitacion_salas', 'evaluations', 'award_decisions', 'contracts', 'economic_baselines', 'savings_validations',
] as const
export type TourTable = (typeof TOUR_TABLES)[number]

export type TourStep = {
  key: string
  title: string
  body: string
  href: string
  record?: { table: TourTable; id: string; label?: string }
  target?: string
}

export type TourAudience = 'internal' | 'supplier'
export type TourRow = { id: string; tour_key: string; name: string; description: string | null; audience: TourAudience; enabled: boolean; steps: unknown }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const INTERNAL_ROLES = ['super_admin', 'admin', 'manager', 'analyst', 'viewer']

export function parseSteps(raw: unknown): { steps: TourStep[]; errors: string[] } {
  const errors: string[] = []
  if (!Array.isArray(raw)) return { steps: [], errors: ['El recorrido no tiene pasos.'] }
  const steps: TourStep[] = []
  const keys = new Set<string>()
  raw.forEach((item, index) => {
    const label = `Paso ${index + 1}`
    if (!item || typeof item !== 'object') return errors.push(`${label}: formato inválido.`)
    const step = item as Record<string, unknown>
    const key = typeof step.key === 'string' ? step.key : ''
    if (!/^[a-z0-9_-]{2,40}$/.test(key) || keys.has(key)) errors.push(`${label}: identificador ausente o repetido.`)
    keys.add(key)
    if (typeof step.title !== 'string' || step.title.trim().length < 3) errors.push(`${label}: falta el título.`)
    if (typeof step.body !== 'string' || step.body.trim().length < 3) errors.push(`${label}: falta la explicación.`)
    const href = typeof step.href === 'string' ? step.href : ''
    if (!href.startsWith('/') || href.startsWith('//') || /^\/(api|login|auth)\b/.test(href)) errors.push(`${label}: la ruta debe ser una pantalla interna de XPEND.`)
    let record: TourStep['record']
    if (step.record !== undefined && step.record !== null) {
      const value = step.record as Record<string, unknown>
      if (!TOUR_TABLES.includes(value.table as TourTable) || typeof value.id !== 'string' || !UUID.test(value.id)) errors.push(`${label}: el registro de referencia no es válido.`)
      else record = { table: value.table as TourTable, id: value.id, label: typeof value.label === 'string' ? value.label : undefined }
    }
    const target = typeof step.target === 'string' && /^[a-z0-9-]{2,60}$/.test(step.target) ? step.target : undefined
    steps.push({ key, title: String(step.title || ''), body: String(step.body || ''), href, record, target })
  })
  if (!steps.length && !errors.length) errors.push('El recorrido no tiene pasos.')
  return { steps, errors }
}

export function canStartTour(role: string | undefined, audience: TourAudience, isDemoCompany: boolean) {
  if (!isDemoCompany || !role) return false
  return audience === 'supplier' ? role === 'supplier' : INTERNAL_ROLES.includes(role)
}

export const canConfigureTours = (role: string | undefined, isDemoCompany: boolean) => isDemoCompany && (role === 'super_admin' || role === 'admin')

export function samePage(href: string, pathname: string, search: string) {
  const [path, query = ''] = href.split('?')
  if (path !== pathname) return false
  const want = new URLSearchParams(query)
  const have = new URLSearchParams(search)
  return Array.from(want.entries()).every(([key, value]) => have.get(key) === value)
}

export type TourState = { tourId: string; index: number }
export const TOUR_STATE_KEY = 'xpend.recorrido'
export const TOUR_START_EVENT = 'xpend:recorrido'

export function readTourState(storage: Pick<Storage, 'getItem'> | undefined): TourState | null {
  try {
    const value = JSON.parse(storage?.getItem(TOUR_STATE_KEY) || 'null')
    return value && typeof value.tourId === 'string' && Number.isInteger(value.index) && value.index >= 0 ? value : null
  } catch {
    return null
  }
}
