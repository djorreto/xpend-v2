import type { ClassificationSource } from '@/lib/spend-flow'

export type ParetoChoice = 80 | 90 | 100

export type CoverageRow = {
  id: string
  amount: number
  currency: string
  source: ClassificationSource
}

export type CoverageSegment = 'modelo' | 'ia' | 'manual' | 'gris' | 'pendiente'

export function paretoIds(rows: CoverageRow[], percent: number) {
  const ids = new Set<string>()
  const currencies = Array.from(new Set(rows.map(row => row.currency)))
  for (const currency of currencies) {
    const group = rows.filter(row => row.currency === currency).sort((a, b) => b.amount - a.amount)
    const ranked = percent >= 100 ? group : group.filter(row => row.amount > 0)
    const total = ranked.reduce((sum, row) => sum + row.amount, 0)
    if (percent >= 100 || total <= 0) {
      ranked.forEach(row => ids.add(row.id))
      continue
    }
    const target = total * (percent / 100)
    let acc = 0
    for (const row of ranked) {
      ids.add(row.id)
      acc += row.amount
      if (acc >= target) break
    }
  }
  return ids
}

export function coverageShares(rows: CoverageRow[], inScope: Set<string>) {
  const currencies = Array.from(new Set(rows.map(row => row.currency))).sort()
  return currencies.map(currency => {
    const group = rows.filter(row => row.currency === currency)
    const total = group.reduce((sum, row) => sum + row.amount, 0) || 1
    const shares: Record<CoverageSegment, number> = { modelo: 0, ia: 0, manual: 0, gris: 0, pendiente: 0 }
    for (const row of group) {
      const part = (row.amount / total) * 100
      if (row.source === 'humano') shares.manual += part
      else if (row.source === 'llm') shares.ia += part
      else if (row.source === 'pendiente') shares[inScope.has(row.id) ? 'pendiente' : 'gris'] += part
      else shares.modelo += part
    }
    const inScopeRows = group.filter(row => inScope.has(row.id))
    const inScopeTotal = inScopeRows.reduce((sum, row) => sum + row.amount, 0)
    const inScopeDone = inScopeRows
      .filter(row => row.source !== 'pendiente')
      .reduce((sum, row) => sum + row.amount, 0)
    const corte = inScopeTotal <= 0 ? (inScopeRows.every(row => row.source !== 'pendiente') ? 100 : 0) : (inScopeDone / inScopeTotal) * 100
    return { currency, total: group.reduce((sum, row) => sum + row.amount, 0), shares, corte }
  })
}
