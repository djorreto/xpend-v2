export type RedactionReason = 'ok' | 'insuficiente' | 'generico' | 'sensible' | 'nombre'

export type RedactionResult =
  | { text: string; blocked: false; reason: 'ok' }
  | { text: string; blocked: true; reason: Exclude<RedactionReason, 'ok'> }

const GENERIC_EXACT = new Set([
  'servicio',
  'servicios',
  'servicios varios',
  'servicios generales',
  'servicios profesionales',
  'varios',
  'otros',
  'gasto',
  'gastos',
  'compra',
  'compras',
  'factura',
  'pago',
  'pagos',
  'honorarios',
  'honorario',
  'asesoria',
  'consultoria',
  'general',
  'generales',
  'miscelaneo',
  'miscelaneos',
  'varios gastos',
])

export const REDACTION_MESSAGES: Record<Exclude<RedactionReason, 'ok'>, string> = {
  insuficiente: 'La descripción no alcanza para categorizar sin usar otros datos de la línea.',
  generico: 'La descripción es demasiado genérica para enviarla a un modelo.',
  sensible: 'La descripción todavía contiene datos identificables. Queda para revisión humana.',
  nombre: 'La descripción parece un nombre propio. Queda para revisión humana.',
}

function fold(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Deja solo el texto necesario para elegir una categoría. No devuelve proveedor, montos ni identificadores. */
export function redactSpendDescription(description: string, supplierName?: string | null): RedactionResult {
  let text = String(description || '')
  const supplier = String(supplierName || '').trim()
  if (supplier.length >= 3) {
    const escaped = supplier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    text = text.replace(new RegExp(escaped, 'gi'), ' ')
  }

  text = text
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, ' ')
    .replace(/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/g, ' ')
    .replace(/(?:\+?56[\s-]?)?(?:9[\s-]?)?\d{4}[\s-]?\d{4}\b/g, ' ')
    .replace(/\$\s?\d[\d.]*(?:,\d+)?/g, ' ')
    .replace(/\b(?:usd|clp|eur|uf)\s*\d[\d.]*(?:,\d+)?\b/gi, ' ')
    .replace(/\b\d{1,3}(?:\.\d{3})+(?:,\d+)?\b/g, ' ')
    .replace(/\b(?:oc|o\.c\.|folio|factura|contrato|guia|guía|nro|n°|nº)\s*[:#.\-]?\s*[a-z0-9-]{3,}\b/gi, ' ')
    .replace(/\b[a-z]{4}\d{2}\b/gi, ' ')
    .replace(/\b[a-z]{2}\d{4}\b/gi, ' ')
    .replace(/\b\d{5,}\b/g, ' ')
    .replace(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}){1,2}\b/g, ' ')
    .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (/@|\d{4,}/.test(text) || /\d{1,2}\.\d{3}/.test(text)) {
    return { text, blocked: true, reason: 'sensible' }
  }

  const normalized = fold(text)
  const words = text.split(' ').filter(Boolean)
  if (!text || words.length < 2 || text.length < 12) {
    return { text, blocked: true, reason: 'insuficiente' }
  }

  const genericPrefix = /^(servicio|servicios|honorarios|asesoria|consultoria)\b/.test(normalized) && words.length <= 3
  if (GENERIC_EXACT.has(normalized) || genericPrefix) {
    return { text, blocked: true, reason: 'generico' }
  }

  const nameLike = words.length <= 3 && words.every(word => /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(word))
  if (nameLike) return { text, blocked: true, reason: 'nombre' }

  return { text, blocked: false, reason: 'ok' }
}

/** Quita correo, RUT y teléfono. Conserva montos cuando el documento es una factura. */
export function stripContactData(value: string) {
  return String(value || '')
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, ' ')
    .replace(/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/g, ' ')
    .replace(/(?:\+?56[\s-]?)?(?:9[\s-]?)?\d{4}[\s-]?\d{4}\b/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}
export function redactOutboundText(value: string): { text: string; blocked: boolean; reason: string | null } {
  const original = String(value || '')
  const lines = original.split('\n').map(line => line.trim()).filter(Boolean)
  const moneyLines = lines.filter(line => /\$\s?\d|\b\d{1,3}(?:\.\d{3})+/.test(line)).length
  if (lines.length >= 5 && moneyLines >= 3) {
    return { text: '', blocked: true, reason: 'listado' }
  }

  let text = original
  const patterns = [
    /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g,
    /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/g,
    /(?:\+?56[\s-]?)?(?:9[\s-]?)?\d{4}[\s-]?\d{4}\b/g,
    /\$\s?\d[\d.]*(?:,\d+)?/g,
    /\b(?:usd|clp|eur|uf)\s*\d[\d.]*(?:,\d+)?\b/gi,
    /\b\d{1,3}(?:\.\d{3})+(?:,\d+)?\b/g,
    /\b\d{6,}\b/g,
  ]
  for (const pattern of patterns) text = text.replace(pattern, ' ')
  text = text.replace(/[ \t]{2,}/g, ' ').trim()
  return { text, blocked: false, reason: null }
}
