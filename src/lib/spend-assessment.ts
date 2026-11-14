import { BASE_TAXONOMY, findPreciseHit, findTaxonomyHit, knownFamily, taxonomyFromRules, taxonomyPrompt, type StoredRule, type TaxonomyNode } from './spend-taxonomy'
import { modelNeedsReview, predictSpendModel } from './spend-model'

export type Assessment = {
  category: string
  subcategory: string | null
  confidence: number
  justification: string
  suggested_strategy: string
  source: 'regla' | 'taxonomia' | 'modelo'
}

function norm(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const SUPPLIER_NOISE = new Set([
  'sa', 'spa', 'ltda', 'eirl', 'limitada', 'sociedad', 'anonima', 'comercial',
  'empresa', 'servicios', 'servicio', 'compania', 'cia', 'asociados', 'group',
])

/** Palabras que identifican al proveedor. S.A., Ltda. y “comercial” no alcanzan. */
export function supplierTokens(value?: string | null) {
  return norm(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 4 && !SUPPLIER_NOISE.has(token))
}

/** Razón social, nombre de fantasía, nombre cortado o con falta de ortografía leve. */
export function sameSupplier(left?: string | null, right?: string | null) {
  const a = supplierTokens(left)
  const b = supplierTokens(right)
  if (!a.length || !b.length) return false
  const overlap = a.filter(token => b.includes(token))
  if (!overlap.length) return false
  const shorter = Math.min(a.length, b.length)
  if (shorter === 1) return overlap.length === 1 && overlap[0].length >= 6
  return overlap.length >= 2
}

/** Si una regla de la empresa ya reconoce la línea, no hace falta el modelo. */
export function matchSpendLine(
  description: string,
  supplier: string | null | undefined,
  rules: StoredRule[],
  nodes: TaxonomyNode[] = taxonomyFromRules(rules)
): Assessment | null {
  const text = norm(description)
  const supplierNorm = norm(supplier)

  const supplierHits = rules
    .filter(rule => rule.rule_type === 'supplier' && supplierNorm && sameSupplier(supplier, rule.pattern))
    .map(rule => ({
      rule,
      overlap: supplierTokens(rule.pattern).filter(token => supplierTokens(supplier).includes(token)).length,
    }))
    .sort((a, b) => b.overlap - a.overlap)
  const supplierRule = supplierHits[0]?.rule
  const supplierIsMulti = supplierRule?.source === 'supplier_multi'
  if (supplierRule && !supplierIsMulti) {
    return {
      category: supplierRule.category,
      subcategory: supplierRule.subcategory || null,
      confidence: 0.94,
      justification: `El proveedor coincide con una regla de la empresa (${supplierRule.pattern}). La glosa no la pisa.`,
      suggested_strategy: 'negociar_marco',
      source: 'regla',
    }
  }

  const correction = rules.find(rule => {
    if (rule.rule_type !== 'correction') return false
    const pattern = norm(rule.pattern)
    return pattern.length >= 8 && (text === pattern || text.startsWith(pattern))
  })
  if (correction) {
    return {
      category: correction.category,
      subcategory: correction.subcategory || null,
      confidence: 0.9,
      justification: 'Esta compra ya fue corregida. No se creó una regla para otros proveedores.',
      suggested_strategy: 'licitar',
      source: 'regla',
    }
  }

  const keywordHits = rules
    .filter(rule => (rule.rule_type === 'keyword' || rule.rule_type === 'synonym') && norm(rule.pattern).length >= 3)
    .map(rule => ({
      synonym: rule.pattern,
      node: {
        family: rule.category,
        name: rule.subcategory || rule.category,
        synonyms: [],
        strategy: 'licitar',
      } as TaxonomyNode,
    }))
    .sort((a, b) => norm(b.synonym).length - norm(a.synonym).length)

  const hit = findTaxonomyHit(description, nodes.length ? nodes : BASE_TAXONOMY)
    || keywordHits.find(item => text.includes(norm(item.synonym)))

  if (hit) {
    return {
      category: hit.node.family,
      subcategory: hit.node.name,
      confidence: 0.86,
      justification: `La descripción trae “${hit.synonym}”, que está en la taxonomía.`,
      suggested_strategy: hit.node.strategy,
      source: keywordHits.some(item => item === hit) ? 'regla' : 'taxonomia',
    }
  }

  if (supplierRule && supplierIsMulti) {
    return {
      category: supplierRule.category,
      subcategory: supplierRule.subcategory || null,
      confidence: 0.7,
      justification: `Proveedor de varios rubros (${supplierRule.pattern}). La glosa no alcanzó, se usó su familia habitual.`,
      suggested_strategy: 'negociar_marco',
      source: 'regla',
    }
  }
  return null
}

/** Orden: regla de la empresa, señal corta de la taxonomía, modelo, y la taxonomía solo si el modelo no alcanza. */
export async function classifySpendLine(
  description: string,
  supplier: string | null | undefined,
  rules: StoredRule[],
  nodes: TaxonomyNode[] = taxonomyFromRules(rules)
): Promise<Assessment | null> {
  const remembered = matchSpendLine(description, supplier, rules, nodes)
  if (remembered && remembered.source === 'regla') return remembered
  const precise = findPreciseHit(description, nodes.length ? nodes : BASE_TAXONOMY)
  if (precise) {
    return {
      category: precise.node.family,
      subcategory: precise.node.name,
      confidence: 0.9,
      justification: `La descripción trae “${precise.synonym}”, que está en la taxonomía.`,
      suggested_strategy: precise.node.strategy,
      source: 'taxonomia',
    }
  }
  const model = await predictSpendModel(description)
  if (model) return model
  return remembered
}

export { modelNeedsReview }

/** Prompt de una sola línea. Usa solo la taxonomía de Xpend y la descripción ya recortada. */
export function assessmentPrompt(description: string) {
  const safeDescription = description.replace(/"/g, "'")
  return `Eres el clasificador de categorías de Xpend. Recibes una sola descripción de un bien o servicio. No tienes proveedor, monto, orden de compra ni datos de la empresa.

DESCRIPCIÓN:
"${safeDescription}"

TAXONOMÍA. Elige solo una familia y una subcategoría de esta lista:
${taxonomyPrompt(BASE_TAXONOMY)}

Si ninguna subcategoría calza, elige la familia más cercana, baja la confianza bajo 0.6 y dilo en la justificación. No inventes una familia nueva. La justificación no debe repetir nombres propios, montos ni identificadores.

Responde solo JSON:
{"category":"familia","subcategory":"subcategoría","confidence":0.84,"justification":"una frase","suggested_strategy":"licitar | consolidar | negociar_marco | monitorear | optimizar"}`
}

export function parseAssessment(text: string, nodes: TaxonomyNode[]): Assessment {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('La IA no devolvió una clasificación')
  const raw = JSON.parse(match[0]) as {
    category?: string
    subcategory?: string
    confidence?: number
    justification?: string
    suggested_strategy?: string
  }
  let confidence = Number(raw.confidence)
  if (!Number.isFinite(confidence)) confidence = 0.5
  confidence = Math.max(0, Math.min(1, confidence))
  const category = String(raw.category || '').trim()
  if (!knownFamily(nodes.length ? nodes : BASE_TAXONOMY, category)) confidence = Math.min(confidence, 0.55)
  return {
    category: category || 'Sin categoría',
    subcategory: raw.subcategory ? String(raw.subcategory).trim() : null,
    confidence,
    justification: String(raw.justification || 'Clasificación del modelo.'),
    suggested_strategy: String(raw.suggested_strategy || 'licitar'),
    source: 'modelo',
  }
}

