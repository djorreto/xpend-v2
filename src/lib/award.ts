export type AwardMoney = {
  budget: number | null
  baseline: number | null
  baselineCurrency: string | null
  baselineSource: string | null
  targetSavings: number | null
  awardedAmount: number | null
  awardedCurrency: string | null
  scopeComparable: boolean
}

export type SavingsVerdict = {
  budget: number | null
  baseline: number | null
  baselineCurrency: string | null
  baselineSource: string | null
  targetSavings: number | null
  awardedAmount: number | null
  awardedCurrency: string | null
  estimatedSavings: number | null
  estimatedPercentage: number | null
  realizedSavings: null
  comparable: boolean
  note: string
}

function money(value: number | null) {
  return value == null ? null : Math.round(Number(value) * 100) / 100
}

/** El objetivo de la iniciativa no se copia como resultado. El realizado no se inventa. */
export function estimateAwardSavings(input: AwardMoney): SavingsVerdict {
  const awardedCurrency = String(input.awardedCurrency || '').trim().toUpperCase()
  const baselineCurrency = String(input.baselineCurrency || '').trim().toUpperCase()
  const verdict: SavingsVerdict = {
    budget: money(input.budget),
    baseline: money(input.baseline),
    baselineCurrency: baselineCurrency || null,
    baselineSource: input.baselineSource,
    targetSavings: money(input.targetSavings),
    awardedAmount: money(input.awardedAmount),
    awardedCurrency: awardedCurrency || null,
    estimatedSavings: null,
    estimatedPercentage: null,
    realizedSavings: null,
    comparable: false,
    note: '',
  }
  if (!awardedCurrency || !baselineCurrency || awardedCurrency !== baselineCurrency) {
    return { ...verdict, note: 'La oferta y la línea base están en monedas distintas. No se convierten ni se mezclan.' }
  }
  if (input.baseline == null || !Number.isFinite(Number(input.baseline)) || Number(input.baseline) <= 0) {
    return { ...verdict, note: 'No hay una línea base documentada. El ahorro estimado no se calcula.' }
  }
  if (input.awardedAmount == null || !Number.isFinite(Number(input.awardedAmount))) {
    return { ...verdict, note: 'Falta el monto adjudicado.' }
  }
  if (!input.scopeComparable) {
    return { ...verdict, note: 'El alcance de la oferta no es comparable con la línea base. El ahorro estimado no se calcula.' }
  }
  const estimated = money(Number(input.baseline) - Number(input.awardedAmount)) || 0
  const percentage = Math.round((estimated / Number(input.baseline)) * 10000) / 100
  const source = input.baselineSource === 'budget'
    ? 'La línea base documentada es el presupuesto del proceso.'
    : 'La línea base documentada se usa como referencia del mismo alcance.'
  return {
    ...verdict,
    estimatedSavings: estimated,
    estimatedPercentage: percentage,
    comparable: true,
    note: `${source} El ahorro estimado es la línea base menos el monto adjudicado. El objetivo de la iniciativa no se copia como resultado. El ahorro realizado queda vacío hasta que exista evidencia posterior.`,
  }
}

export function decisionAfterVotes(input: {
  required: number
  votes: { vote: 'approved' | 'rejected' | 'returned' }[]
}) {
  if (input.votes.some(vote => vote.vote === 'rejected')) return 'rejected'
  if (input.votes.some(vote => vote.vote === 'returned')) return 'returned'
  const approvals = input.votes.filter(vote => vote.vote === 'approved').length
  if (approvals >= input.required) return 'approved'
  return 'pending'
}

export function voteBlockReason(input: {
  voterId: string
  preparerId: string
  allowSelf: boolean
  role: string
  approverRoles: string[]
}) {
  if (!input.approverRoles.includes(input.role)) return 'Tu rol no está habilitado para aprobar.'
  if (input.voterId === input.preparerId && !input.allowSelf) {
    return 'Quien recomienda no puede aprobar su propia solicitud.'
  }
  return null
}

export type PacketSnapshot = {
  title: string
  licitacionId: string
  initiativeTitle: string
  objective: string
  scope: string
  budget: number | null
  currency: string
  baselineSource: string | null
  invited: { name: string; status: string }[]
  offers: {
    name: string
    amount: number
    currency: string
    technical: string
    lines: { description: string; quantity: number; unit: string; unitPrice: number }[]
    files: string[]
    technicalScore: number | null
    economicScore: number | null
    finalScore: number | null
    qualified: boolean
    exclusion: string | null
    rank: number | null
    scopeAlert: boolean
  }[]
  model: {
    technicalWeight: number
    economicWeight: number
    threshold: number | null
    formula: string
    criteria: { name: string; kind: string; weight: number }[]
  }
  recommendation: string
  recommendedSupplier: string
  savings: SavingsVerdict
  risks: string
  exceptions: string
  observations: string
}

export function executiveReport(snapshot: PacketSnapshot) {
  const savings = snapshot.savings
  const offers = snapshot.offers.map(offer => {
    const place = offer.rank ? `${offer.rank}. ` : 'Excluido. '
    const score = offer.finalScore == null ? 'sin puntaje final' : `final ${offer.finalScore}`
    return `${place}${offer.name}: ${offer.currency} ${offer.amount}, técnico ${offer.technicalScore ?? '—'}, económico ${offer.economicScore ?? '—'}, ${score}${offer.exclusion ? `. ${offer.exclusion}` : ''}`
  })
  return [
    `Expediente de decisión. ${snapshot.title}`,
    `Licitación ${snapshot.licitacionId}. Iniciativa: ${snapshot.initiativeTitle}.`,
    `Objetivo: ${snapshot.objective}`,
    `Alcance: ${snapshot.scope}`,
    `Presupuesto: ${snapshot.currency} ${savings.budget ?? '—'}. Línea base: ${snapshot.currency} ${savings.baseline ?? '—'} (${snapshot.baselineSource || 'sin fuente'}).`,
    `Ahorro objetivo de la iniciativa: ${snapshot.currency} ${savings.targetSavings ?? '—'}.`,
    `Ahorro estimado de la recomendación: ${savings.estimatedSavings == null ? 'no calculado' : `${snapshot.currency} ${savings.estimatedSavings}`}.`,
    'Ahorro realizado: sin evidencia posterior.',
    savings.note,
    `Invitados: ${snapshot.invited.map(item => `${item.name} (${item.status})`).join(', ') || 'ninguno'}.`,
    `Metodología: técnico ${snapshot.model.technicalWeight}% y económico ${snapshot.model.economicWeight}%. ${snapshot.model.formula}.`,
    `Criterios: ${snapshot.model.criteria.map(item => `${item.name} ${item.kind === 'mandatory' ? 'excluyente' : item.weight + '%'}`).join(', ')}.`,
    ...offers,
    `Recomendación: ${snapshot.recommendedSupplier}.`,
    snapshot.recommendation,
    `Riesgos: ${snapshot.risks || 'Sin riesgos registrados.'}`,
    `Excepciones: ${snapshot.exceptions || 'Sin excepciones.'}`,
    `Observaciones: ${snapshot.observations || 'Sin observaciones.'}`,
    'Esta versión adjudica un solo proveedor por el alcance completo de su oferta.',
    'Aprobar la recomendación no publica la adjudicación.',
  ].join('\n')
}
