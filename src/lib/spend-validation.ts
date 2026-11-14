import { normalizeCurrency } from './spend-sources'
import type { TaxonomyNode } from './spend-taxonomy'

export type ValidationLine = {
  id: string
  amount: number
  currency: string
  supplier: string
  description: string
  category?: string | null
  subcategory?: string | null
  needsReview: boolean
  confidence?: number | null
}

export type Coverage = {
  currency: string
  total: number
  firm: number
  open: number
  rate: number
  paretoRate: number
  openSuppliers: number
}

export type ValidationGroup = {
  id: string
  currency: string
  supplier: string
  amount: number
  lineCount: number
  share: number
  reason: 'pareto' | 'nuevo' | 'subcategoria' | 'muestra'
  lineIds: string[]
  samples: string[]
  family?: string | null
  subcategory?: string | null
}

const HINTS: Array<{ pattern: RegExp; family: string; subcategory: string }> = [
  { pattern: /litograf|imprent|etiqueta|grafica/, family: 'Marketing y comercial', subcategory: 'Agencias y producción' },
  { pattern: /sodimac|easy|imperial|chilemat|ferreter|materiales/, family: 'Suministros operacionales', subcategory: 'Ferretería y materiales' },
  { pattern: /aduana|courier|transport|flete|logist/, family: 'Logística y transporte', subcategory: 'Fletes y distribución' },
  { pattern: /energia|enel|cge|gas |combust/, family: 'Energía y servicios básicos', subcategory: 'Electricidad' },
  { pattern: /telefon|entel|movistar|internet|telecom/, family: 'Tecnología', subcategory: 'Telecomunicaciones' },
  { pattern: /software|microsoft|google|licencia|saas/, family: 'Tecnología', subcategory: 'Software y licencias' },
  { pattern: /aseo|limpieza|seguridad|guardia/, family: 'Servicios generales', subcategory: 'Aseo y limpieza' },
  { pattern: /maquin|rheem|equipo/, family: 'Equipos y maquinaria', subcategory: 'Compra de equipos' },
]

export function suggestFamily(supplier: string, nodes: TaxonomyNode[]) {
  const text = supplier.toLowerCase()
  const hint = HINTS.find(item => item.pattern.test(text))
  if (!hint) return null
  const node = nodes.find(item => item.family === hint.family && item.name === hint.subcategory)
  return { family: hint.family, subcategory: node ? node.name : hint.subcategory }
}

function isOpen(line: ValidationLine) {
  return !line.category || line.category === 'Sin categoría' || line.needsReview
}

function isUsefulText(value: string) {
  const text = value.trim()
  if (text.length < 4) return false
  const digits = text.replace(/\D/g, '').length
  return digits / text.length < 0.6
}

export function buildSpendValidation(
  lines: ValidationLine[],
  nodes: TaxonomyNode[],
  knownSuppliers: string[]
): { coverage: Coverage[]; groups: ValidationGroup[]; ready: boolean } {
  const byCurrency = new Map<string, ValidationLine[]>()
  for (const line of lines) {
    const currency = normalizeCurrency(line.currency)
    const list = byCurrency.get(currency) || []
    list.push(line)
    byCurrency.set(currency, list)
  }

  const known = new Set(knownSuppliers.map(name => name.toLowerCase()))
  const coverage: Coverage[] = []
  const groups: ValidationGroup[] = []
  let ready = byCurrency.size > 0

  for (const currency of Array.from(byCurrency.keys()).sort()) {
    const rows = byCurrency.get(currency) || []
    let total = 0
    let firmAmount = 0
    const openBySupplier = new Map<string, ValidationLine[]>()
    for (const row of rows) {
      const amount = Number(row.amount) || 0
      total += amount
      if (!isOpen(row)) firmAmount += amount
      if (!isOpen(row)) continue
      const supplier = row.supplier.trim() || 'Sin proveedor'
      const bucket = openBySupplier.get(supplier) || []
      bucket.push(row)
      openBySupplier.set(supplier, bucket)
    }

    const ranked = Array.from(openBySupplier.entries())
      .map(([supplier, bucket]) => ({ supplier, bucket, amount: sum(bucket) }))
      .sort((a, b) => b.amount - a.amount)
    const openTotal = ranked.reduce((acc, item) => acc + item.amount, 0)
    let cursor = 0
    let shown = 0
    for (const item of ranked) {
      const before = cursor
      cursor += item.amount
      if (before >= openTotal * 0.8 && shown > 0) break
      if (shown < 8) {
        const suggestion = suggestFamily(item.supplier, nodes)
        groups.push({
          ...groupOf(currency, item.supplier, item.bucket, item.amount, total, 'pareto'),
          family: suggestion?.family || null,
          subcategory: suggestion?.subcategory || null,
          reason: suggestion ? 'nuevo' : 'pareto',
        })
        shown += 1
      }
    }

    const paretoRate = total > 0 ? firmAmount / total : 1
    coverage.push({
      currency,
      total,
      firm: firmAmount,
      open: openTotal,
      rate: paretoRate,
      paretoRate: openTotal > 0 ? Math.min(1, (openTotal * 0.8) / Math.max(openTotal, 1)) : 1,
      openSuppliers: ranked.length,
    })
    if (openTotal > total * 0.2) ready = false
  }

  return { coverage, groups, ready }
}

function sum(rows: ValidationLine[]) {
  let total = 0
  for (const row of rows) total += Number(row.amount) || 0
  return total
}

function groupOf(
  currency: string,
  supplier: string,
  bucket: ValidationLine[],
  amount: number,
  currencyTotal: number,
  reason: ValidationGroup['reason']
): ValidationGroup {
  const samples: string[] = []
  for (const row of bucket) {
    if (samples.length >= 3) break
    if (isUsefulText(row.description)) samples.push(row.description)
  }
  return {
    id: `${currency}:${supplier}:${reason}`,
    currency,
    supplier,
    amount,
    lineCount: bucket.length,
    share: currencyTotal > 0 ? amount / currencyTotal : 0,
    reason,
    lineIds: bucket.map(row => row.id),
    samples,
  }
}

export { isUsefulText }
