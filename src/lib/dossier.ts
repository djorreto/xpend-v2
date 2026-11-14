export type PlanSeed = {
  title?: string | null
  description?: string | null
  category?: string | null
  estimated_spend?: number | null
  currency?: string | null
  initiative_type?: string | null
}

export type LicitacionSeed = {
  name?: string | null
  baseline_amount?: number | null
  baseline_currency?: string | null
}

function moneyCode(value?: string | null, fallback = 'CLP') {
  const code = String(value || '').trim().toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : fallback
}

export const PROCESS_CATEGORIES = ['recurring_service', 'non_recurring_service', 'improvement_project', 'construction_project'] as const
export const BASELINE_SOURCES = ['historical', 'budget', 'other'] as const

export function isProcessCategory(value: string) {
  return (PROCESS_CATEGORIES as readonly string[]).includes(value)
}

export function isBaselineSource(value: string) {
  return (BASELINE_SOURCES as readonly string[]).includes(value)
}

/**
 * La licitación nace de la iniciativa. La categoría escrita no entra al enum
 * del tipo de proceso. El monto estimado es presupuesto; el origen es el vínculo.
 */
export function licitacionSeedFromPlan(plan: PlanSeed) {
  const spend = Number(plan.estimated_spend)
  return {
    name: String(plan.title || '').trim(),
    description: String(plan.description || '').trim(),
    categoryLabel: String(plan.category || '').trim(),
    category: '',
    baselineAmount: Number.isFinite(spend) && spend > 0 ? String(spend) : '',
    currency: moneyCode(plan.currency),
    type: plan.initiative_type === 'project' ? 'RFP' : 'RFQ',
    baselineSource: Number.isFinite(spend) && spend > 0 ? 'budget' : '',
  }
}

/** La sala usa el nombre y la moneda del proceso. Si no hay proceso, usa la iniciativa. */
export function salaSeedFromDossier(input: { plan?: PlanSeed | null; licitacion?: LicitacionSeed | null }) {
  const lic = input.licitacion
  const plan = input.plan
  return {
    title: String(lic?.name || plan?.title || '').trim(),
    currency: moneyCode(lic?.baseline_currency || plan?.currency),
    baselineAmount: lic?.baseline_amount ?? plan?.estimated_spend ?? null,
  }
}

/** El comprador ve ofertas ajenas solo cuando la modalidad ya las abrió. */
export function buyerCanReadForeignBid(input: {
  modality: string
  eventStatus: string
  roundStatus?: string | null
}) {
  if (input.eventStatus === 'closed' || input.eventStatus === 'awarded') return true
  if (input.modality === 'reverse_auction' || input.modality === 'adhesion') return true
  if (input.modality === 'rounds' && input.roundStatus === 'closed') return true
  return false
}
