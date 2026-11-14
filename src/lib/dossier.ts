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

/** La licitación nace de la iniciativa. La persona confirma; no reescribe el gasto. */
export function licitacionSeedFromPlan(plan: PlanSeed) {
  return {
    name: String(plan.title || '').trim(),
    description: String(plan.description || '').trim(),
    category: String(plan.category || '').trim(),
    baselineAmount: plan.estimated_spend ? String(plan.estimated_spend) : '',
    currency: moneyCode(plan.currency),
    type: plan.initiative_type === 'project' ? 'RFP' : 'RFQ',
    source: 'Iniciativa del plan',
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
