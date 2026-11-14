export type BidLineInput = {
  description: string
  quantity: number
  unit: string
  unitPrice: number
}

export function lineTotal(quantity: number, unitPrice: number) {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice) || quantity <= 0 || unitPrice < 0) return null
  return Math.round(quantity * unitPrice * 100) / 100
}

function lineIsBlank(line: BidLineInput) {
  return !line.description.trim() && (!Number.isFinite(line.unitPrice) || line.unitPrice === 0)
}

export function bidTotal(lines: BidLineInput[]) {
  const active = lines.filter(line => !lineIsBlank(line))
  if (!active.length) return null
  let total = 0
  for (const line of active) {
    const value = lineTotal(line.quantity, line.unitPrice)
    if (value == null || !line.description.trim() || !line.unit.trim()) return null
    total += value
  }
  return Math.round(total * 100) / 100
}

export function technicalIsComplete(summary: string) {
  return summary.trim().length >= 10
}

export function ndaBlocksDocuments(input: { required: boolean; acceptedVersion: string | null; currentVersion: string }) {
  if (!input.required) return false
  return input.acceptedVersion !== input.currentVersion
}

export function receptionClosed(input: { status: string; closesAt: string | null; now?: Date }) {
  if (input.status !== 'open') return true
  if (!input.closesAt) return false
  return new Date(input.closesAt).getTime() <= (input.now || new Date()).getTime()
}
