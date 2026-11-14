export type TaxBasis = 'net' | 'gross'
export type TaxKind = 'official' | 'custom' | 'none'
export type FxMode = 'native' | 'observed' | 'fixed'
export type WindowMode = 'all' | 'calendar' | 'rolling'

export type TaxReference = {
  code: string
  name: string
  taxName: string | null
  rate: number | null
  note: string
}

export const TAX_REFERENCES: TaxReference[] = [
  { code: 'CL', name: 'Chile', taxName: 'IVA', rate: 19, note: 'Tasa de referencia. Confirmar al cargar.' },
  { code: 'PE', name: 'Perú', taxName: 'IGV', rate: 18, note: 'Tasa de referencia. Confirmar al cargar.' },
  { code: 'AR', name: 'Argentina', taxName: 'IVA', rate: 21, note: 'Tasa de referencia. Confirmar al cargar.' },
  { code: 'CO', name: 'Colombia', taxName: 'IVA', rate: 19, note: 'Tasa de referencia. Confirmar al cargar.' },
  { code: 'MX', name: 'México', taxName: 'IVA', rate: 16, note: 'Tasa de referencia. Confirmar al cargar.' },
  { code: 'UY', name: 'Uruguay', taxName: 'IVA', rate: 22, note: 'Tasa de referencia. Confirmar al cargar.' },
  { code: 'PY', name: 'Paraguay', taxName: 'IVA', rate: 10, note: 'Tasa de referencia. Confirmar al cargar.' },
  { code: 'BO', name: 'Bolivia', taxName: 'IVA', rate: 13, note: 'Tasa de referencia. Confirmar al cargar.' },
  { code: 'EC', name: 'Ecuador', taxName: 'IVA', rate: 15, note: 'Tasa de referencia. Confirmar al cargar.' },
  { code: 'PA', name: 'Panamá', taxName: 'ITBMS', rate: 7, note: 'Tasa de referencia. Confirmar al cargar.' },
  { code: 'CR', name: 'Costa Rica', taxName: 'IVA', rate: 13, note: 'Tasa de referencia. Confirmar al cargar.' },
  { code: 'DO', name: 'República Dominicana', taxName: 'ITBIS', rate: 18, note: 'Tasa de referencia. Confirmar al cargar.' },
  { code: 'GT', name: 'Guatemala', taxName: 'IVA', rate: 12, note: 'Tasa de referencia. Confirmar al cargar.' },
  { code: 'HN', name: 'Honduras', taxName: 'ISV', rate: 15, note: 'Tasa de referencia. Confirmar al cargar.' },
  { code: 'NI', name: 'Nicaragua', taxName: 'IVA', rate: 15, note: 'Tasa de referencia. Confirmar al cargar.' },
  { code: 'SV', name: 'El Salvador', taxName: 'IVA', rate: 13, note: 'Tasa de referencia. Confirmar al cargar.' },
  { code: 'ES', name: 'España', taxName: 'IVA', rate: 21, note: 'Tasa de referencia. Confirmar al cargar.' },
  { code: 'BR', name: 'Brasil', taxName: null, rate: null, note: 'No hay una tasa única. Si el archivo trae impuesto, escríbela.' },
  { code: 'US', name: 'Estados Unidos', taxName: null, rate: null, note: 'No hay un IVA federal. Si el archivo trae impuesto, escríbela.' },
  { code: 'VE', name: 'Venezuela', taxName: null, rate: null, note: 'La tasa cambia seguido. Escríbela al cargar.' },
]

export const CURRENCIES = ['CLP', 'USD', 'EUR', 'UF', 'PEN', 'ARS', 'COP', 'MXN', 'BRL', 'UYU', 'GBP']

const COUNTRY_ALIASES: Record<string, string> = {
  cl: 'CL', chile: 'CL', chl: 'CL',
  pe: 'PE', peru: 'PE', perú: 'PE',
  ar: 'AR', argentina: 'AR',
  co: 'CO', colombia: 'CO',
  mx: 'MX', mexico: 'MX', méxico: 'MX',
  uy: 'UY', uruguay: 'UY',
  py: 'PY', paraguay: 'PY',
  bo: 'BO', bolivia: 'BO',
  ec: 'EC', ecuador: 'EC',
  br: 'BR', brasil: 'BR', brazil: 'BR',
  us: 'US', usa: 'US', eeuu: 'US', 'estados unidos': 'US',
  es: 'ES', españa: 'ES', espana: 'ES', spain: 'ES',
  pa: 'PA', panama: 'PA', panamá: 'PA',
  cr: 'CR', 'costa rica': 'CR',
  do: 'DO', 'republica dominicana': 'DO', 'república dominicana': 'DO',
  gt: 'GT', guatemala: 'GT',
  hn: 'HN', honduras: 'HN',
  ni: 'NI', nicaragua: 'NI',
  sv: 'SV', 'el salvador': 'SV',
  ve: 'VE', venezuela: 'VE',
}

const CURRENCY_ALIASES: Record<string, string> = {
  clp: 'CLP', peso: 'CLP', pesos: 'CLP', 'peso chileno': 'CLP', cl$: 'CLP',
  usd: 'USD', dolar: 'USD', dólar: 'USD', dolares: 'USD', dólares: 'USD', us$: 'USD',
  eur: 'EUR', euro: 'EUR', euros: 'EUR',
  uf: 'UF',
  pen: 'PEN', sol: 'PEN', soles: 'PEN',
  ars: 'ARS',
  cop: 'COP',
  mxn: 'MXN',
  brl: 'BRL', real: 'BRL', reales: 'BRL',
  uyu: 'UYU',
  gbp: 'GBP', libra: 'GBP',
}

export function countryName(code?: string | null) {
  return TAX_REFERENCES.find(item => item.code === code)?.name || code || ''
}

export function referenceFor(code?: string | null) {
  return TAX_REFERENCES.find(item => item.code === code) || null
}

export function matchCountry(raw: unknown): string | null {
  const text = String(raw ?? '').trim().toLowerCase()
  if (!text) return null
  if (COUNTRY_ALIASES[text]) return COUNTRY_ALIASES[text]
  const upper = text.toUpperCase()
  if (TAX_REFERENCES.some(item => item.code === upper)) return upper
  return null
}

export function normalizeMoneyCode(raw: unknown): string | null {
  const text = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!text || text === '$') return null
  if (CURRENCY_ALIASES[text]) return CURRENCY_ALIASES[text]
  const compact = text.replace(/[^a-z]/g, '')
  if (CURRENCY_ALIASES[compact]) return CURRENCY_ALIASES[compact]
  if (/^[a-z]{3}$/.test(compact)) return compact.toUpperCase()
  return null
}

export function parseRate(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const value = Number(String(raw).trim().replace('%', '').replace(',', '.'))
  if (!Number.isFinite(value) || value < 0 || value >= 100) return null
  return Math.round(value * 1000) / 1000
}

export function netFromGross(amount: number, ratePercent: number) {
  const rate = parseRate(ratePercent)
  if (rate == null) return null
  return Math.round((amount / (1 + rate / 100)) * 100) / 100
}

export function parseRateMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const code = matchCountry(key)
    const rate = parseRate(value)
    if (code && rate != null) out[code] = rate
  }
  return out
}
