import { normalizeMoneyCode, type FxMode, type WindowMode } from '@/lib/spend-basis'

export type SpendFact = {
  category: string | null
  amountNet: number
  currency: string
  supplier: string | null
  purchaseDate: string | null
  unresolvedTax: boolean
}

export type ViewSettings = {
  displayCurrency: string | null
  fxMode: FxMode
  fxRates: Record<string, number>
  windowMode: WindowMode
  windowYear: number | null
  windowEnd: string | null
}

export type KeptLine = SpendFact & { amount: number }

export function rollingStart(endIso: string) {
  const [year, month, day] = endIso.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCFullYear(date.getUTCFullYear() - 1)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

export function inSpendWindow(date: string | null, view: ViewSettings) {
  if (view.windowMode === 'all') return true
  if (!date) return false
  const day = date.slice(0, 10)
  if (view.windowMode === 'calendar') {
    return Boolean(view.windowYear) && day.slice(0, 4) === String(view.windowYear)
  }
  if (!view.windowEnd) return false
  const start = rollingStart(view.windowEnd)
  if (!start) return false
  return day >= start && day <= view.windowEnd.slice(0, 10)
}

export function convertToDisplay(amount: number, from: string, display: string, rates: Record<string, number>) {
  if (from === display) return amount
  const rate = Number(rates[from])
  if (!Number.isFinite(rate) || rate <= 0) return null
  return Math.round(amount * rate * 100) / 100
}

export function assessLines(lines: SpendFact[], view: ViewSettings) {
  if (lines.some(line => line.unresolvedTax)) {
    return { error: 'Hay líneas con impuesto y sin tasa. Confirma el impuesto antes de armar el plan.' as string }
  }

  const inWindow = lines.filter(line => inSpendWindow(line.purchaseDate, view))
  const undated = view.windowMode === 'all'
    ? 0
    : lines.filter(line => !line.purchaseDate).length

  const currencies = Array.from(new Set(inWindow.map(line => normalizeMoneyCode(line.currency) || line.currency || 'USD')))
  let display: string | null = view.displayCurrency
    ? normalizeMoneyCode(view.displayCurrency) || view.displayCurrency
    : null
  if (!display) {
    if (currencies.length === 1) display = currencies[0]
    else return { error: 'Elige la moneda en la que quieres ver el gasto.' }
  }

  const kept: KeptLine[] = []
  const excluded: Record<string, number> = {}
  for (const line of inWindow) {
    const code: string = normalizeMoneyCode(line.currency) || line.currency || display
    if (view.fxMode === 'native') {
      if (code !== display) {
        excluded[code] = (excluded[code] || 0) + line.amountNet
        continue
      }
      kept.push({ ...line, currency: code, amount: line.amountNet })
      continue
    }
    const converted = convertToDisplay(line.amountNet, code, display, view.fxRates || {})
    if (converted == null) {
      return { error: `Falta el tipo de cambio de ${code} a ${display}.` }
    }
    kept.push({ ...line, currency: display, amount: converted })
  }

  if (!kept.length) {
    return {
      error: undated === lines.length
        ? 'Esta base no tiene fechas. Elige ver todo el gasto, no un año.'
        : 'No hay gasto en la moneda y la ventana elegidas.',
    }
  }

  return { display, kept, excluded, undated }
}

export function monthlyTotals(lines: KeptLine[]) {
  const map = new Map<string, number>()
  let undatedAmount = 0
  let undatedCount = 0
  for (const line of lines) {
    if (!line.purchaseDate) {
      undatedAmount += line.amount
      undatedCount += 1
      continue
    }
    const month = line.purchaseDate.slice(0, 7)
    map.set(month, (map.get(month) || 0) + line.amount)
  }
  return {
    months: Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 })),
    undatedAmount: Math.round(undatedAmount * 100) / 100,
    undatedCount,
  }
}
