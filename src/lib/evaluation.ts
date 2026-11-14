export type CriterionInput = {
  id: string
  name: string
  kind: 'technical' | 'mandatory'
  weight: number
  threshold?: number | null
}

export type ScoreInput = {
  criterionId: string
  supplierId: string
  evaluatorId: string
  score: number | null
  failedMandatory: boolean
}

export type BidInput = {
  supplierId: string
  amount: number
  currency: string
  lineCount: number
}

export type EvaluationInput = {
  technicalWeight: number
  economicWeight: number
  technicalThreshold: number | null
  scaleMax: number
  criteria: CriterionInput[]
  scores: ScoreInput[]
  bids: BidInput[]
}

export type SupplierResult = {
  supplierId: string
  technicalScore: number | null
  economicScore: number | null
  finalScore: number | null
  qualified: boolean
  exclusionReason: string | null
  totalAmount: number
  currency: string
  lowBidAlert: boolean
  scopeAlert: boolean
  rank: number | null
  breakdown: { criterionId: string; average: number | null; weight: number }[]
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function average(values: number[]) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function weightsAreValid(criteria: CriterionInput[]) {
  const technical = criteria.filter(item => item.kind === 'technical')
  const total = technical.reduce((sum, item) => sum + Number(item.weight), 0)
  return Math.abs(total - 100) < 0.001 && technical.every(item => item.weight > 0)
}

export function evaluateBids(input: EvaluationInput): SupplierResult[] {
  if (Math.abs(input.technicalWeight + input.economicWeight - 100) > 0.001) {
    throw new Error('Las ponderaciones técnica y económica deben sumar 100.')
  }
  if (!weightsAreValid(input.criteria)) {
    throw new Error('Los criterios técnicos deben sumar 100 y tener peso mayor a cero.')
  }
  const currencies = new Set(input.bids.map(bid => bid.currency))
  if (currencies.size > 1) {
    throw new Error('Hay ofertas en monedas distintas. No se convierten ni se mezclan.')
  }
  const maxLines = Math.max(0, ...input.bids.map(bid => bid.lineCount))
  const technicalCriteria = input.criteria.filter(item => item.kind === 'technical')
  const mandatory = input.criteria.filter(item => item.kind === 'mandatory')

  const preliminary = input.bids.map(bid => {
    const breakdown = technicalCriteria.map(criterion => {
      const values = input.scores
        .filter(score => score.criterionId === criterion.id && score.supplierId === bid.supplierId && score.score != null)
        .map(score => Number(score.score))
      return { criterionId: criterion.id, average: average(values), weight: criterion.weight }
    })
    const missing = breakdown.some(item => item.average == null)
    const technicalScore = missing
      ? null
      : round2(breakdown.reduce((sum, item) => sum + (item.average || 0) * item.weight, 0) / 100)
    const failed = mandatory.filter(criterion => input.scores.some(score =>
      score.criterionId === criterion.id && score.supplierId === bid.supplierId && score.failedMandatory
    ))
    const belowCriterion = technicalCriteria.find(criterion => {
      const row = breakdown.find(item => item.criterionId === criterion.id)
      return criterion.threshold != null && row?.average != null && row.average < Number(criterion.threshold)
    })
    let exclusion: string | null = null
    if (failed.length) exclusion = `Incumple requisito excluyente: ${failed.map(item => item.name).join(', ')}`
    else if (belowCriterion) exclusion = `No alcanza el umbral de ${belowCriterion.name}`
    else if (input.technicalThreshold != null && technicalScore != null && technicalScore < input.technicalThreshold) {
      exclusion = `Puntaje técnico ${technicalScore} bajo el umbral ${input.technicalThreshold}`
    }
    return {
      supplierId: bid.supplierId,
      technicalScore,
      economicScore: null as number | null,
      finalScore: null as number | null,
      qualified: exclusion == null && technicalScore != null,
      exclusionReason: exclusion,
      totalAmount: bid.amount,
      currency: bid.currency,
      lowBidAlert: false,
      scopeAlert: maxLines > 0 && bid.lineCount < maxLines,
      rank: null as number | null,
      breakdown,
    }
  })

  const qualifiedAmounts = preliminary.filter(item => item.qualified).map(item => item.totalAmount)
  const lowest = qualifiedAmounts.length ? Math.min(...qualifiedAmounts) : null
  const allAmounts = input.bids.map(bid => bid.amount).sort((a, b) => a - b)
  const median = allAmounts.length ? allAmounts[Math.floor((allAmounts.length - 1) / 2)] : null

  const withEconomics = preliminary.map(item => {
    const lowBidAlert = median != null && item.totalAmount > 0 && item.totalAmount < median * 0.7
    if (!item.qualified || lowest == null || item.totalAmount <= 0) return { ...item, lowBidAlert }
    const economicScore = round2((lowest / item.totalAmount) * 100)
    const finalScore = round2((item.technicalScore || 0) * input.technicalWeight / 100 + economicScore * input.economicWeight / 100)
    return {
      ...item,
      economicScore,
      finalScore,
      lowBidAlert,
    }
  })

  const ranked = withEconomics
    .filter(item => item.qualified && item.finalScore != null)
    .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0) || a.totalAmount - b.totalAmount)
  ranked.forEach((item, index) => {
    item.rank = index + 1
  })
  return withEconomics
}

export function recommendationReport(input: {
  title: string
  supplierName: string
  technicalNote: string
  economicNote: string
  notLowest: boolean
  results: SupplierResult[]
  names?: Record<string, string>
  technicalWeight: number
  economicWeight: number
}) {
  const lines = input.results
    .slice()
    .sort((a, b) => (a.rank || 99) - (b.rank || 99))
    .map(item => {
      const place = item.rank ? `${item.rank}. ` : 'Excluido. '
      const score = item.finalScore == null ? 'sin puntaje final' : `final ${item.finalScore}`
      const name = input.names?.[item.supplierId] || item.supplierId
      return `${place}${name}: técnico ${item.technicalScore ?? '—'}, económico ${item.economicScore ?? '—'}, ${score}, ${item.currency} ${item.totalAmount}${item.exclusionReason ? `. ${item.exclusionReason}` : ''}${item.lowBidAlert ? '. Alerta de precio bajo' : ''}${item.scopeAlert ? '. Partidas incompletas' : ''}`
    })
  return [
    `Informe de evaluación. ${input.title}`,
    `Modelo: técnico ${input.technicalWeight}% y económico ${input.economicWeight}%.`,
    'El puntaje económico es el menor total habilitado dividido por el total de la oferta, por 100, en la misma moneda. No hay conversión.',
    'Esta recomendación no adjudica.',
    ...lines,
    `Se recomienda a ${input.supplierName}.`,
    input.notLowest ? 'No es la oferta de menor precio. La justificación es técnica y económica, no solo el monto.' : 'La oferta recomendada es la de menor precio entre las habilitadas.',
    `Nota técnica: ${input.technicalNote}`,
    `Nota económica: ${input.economicNote}`,
  ].join('\n')
}

export function evaluationCsv(results: SupplierResult[], names: Record<string, string>) {
  const header = ['Proveedor', 'Moneda', 'Total', 'Técnico', 'Económico', 'Final', 'Habilitado', 'Puesto', 'Exclusión', 'Alerta de precio', 'Alerta de alcance']
  const rows = results.map(item => [
    names[item.supplierId] || item.supplierId,
    item.currency,
    item.totalAmount,
    item.technicalScore ?? '',
    item.economicScore ?? '',
    item.finalScore ?? '',
    item.qualified ? 'sí' : 'no',
    item.rank ?? '',
    item.exclusionReason || '',
    item.lowBidAlert ? 'sí' : 'no',
    item.scopeAlert ? 'sí' : 'no',
  ])
  return [header, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
}
