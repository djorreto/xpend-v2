export function cleanRut(rut: string): string {
  return rut.replace(/\./g, '').replace(/-/g, '').trim().toUpperCase()
}

export function isValidRut(rut: string): boolean {
  const r = cleanRut(rut)
  if (!/^[0-9]+[0-9K]$/.test(r)) return false
  const body = r.slice(0, -1)
  const dv = r.slice(-1)
  let sum = 0
  let mult = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mult
    mult = mult === 7 ? 2 : mult + 1
  }
  const mod = 11 - (sum % 11)
  const dvCalc = mod === 11 ? '0' : mod === 10 ? 'K' : String(mod)
  return dvCalc === dv
}

export function formatRut(rut: string): string {
  const r = cleanRut(rut)
  if (r.length < 2) return rut
  const body = r.slice(0, -1)
  const dv = r.slice(-1)
  const reversed = body.split('').reverse()
  const chunks = []
  for (let i = 0; i < reversed.length; i += 3) {
    chunks.push(reversed.slice(i, i + 3).join(''))
  }
  const formattedBody = chunks.map(c => c.split('').reverse().join('')).reverse().join('.')
  return `${formattedBody}-${dv}`
}

