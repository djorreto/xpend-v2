import { NextRequest, NextResponse } from 'next/server'
import { requireSpendAccess } from '@/lib/spend-access'
import { normalizeMoneyCode } from '@/lib/spend-basis'

export const runtime = 'nodejs'

const CLP_SERIES: Record<string, string> = { USD: 'dolar', EUR: 'euro', UF: 'uf' }

async function clpPerUnit(code: string) {
  const series = CLP_SERIES[code]
  if (!series) return null
  const response = await fetch(`https://mindicador.cl/api/${series}`, { cache: 'no-store' })
  if (!response.ok) return null
  const body = await response.json()
  const point = body?.serie?.[0]
  const value = Number(point?.valor)
  if (!Number.isFinite(value) || value <= 0) return null
  return { value, asOf: String(point?.fecha || '').slice(0, 10) }
}

async function frankfurter(from: string, to: string) {
  const response = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, { cache: 'no-store' })
  if (!response.ok) return null
  const body = await response.json()
  const value = Number(body?.rates?.[to])
  if (!Number.isFinite(value) || value <= 0) return null
  return { value, asOf: String(body?.date || '') }
}

export async function GET(request: NextRequest) {
  const access = await requireSpendAccess('analyst')
  if (!access.ok) return access.response

  const display = normalizeMoneyCode(request.nextUrl.searchParams.get('display'))
  const codes = (request.nextUrl.searchParams.get('codes') || '')
    .split(',')
    .map(code => normalizeMoneyCode(code))
    .filter((code): code is string => Boolean(code && code !== display))
  if (!display) return NextResponse.json({ error: 'Elige la moneda en la que quieres ver el gasto.' }, { status: 400 })

  const rates: Record<string, number> = {}
  const missing: string[] = []
  let asOf = new Date().toISOString().slice(0, 10)

  for (const code of Array.from(new Set(codes))) {
    try {
      let quote: { value: number; asOf: string } | null = null
      if (display === 'CLP' && CLP_SERIES[code]) quote = await clpPerUnit(code)
      else if (code === 'CLP' && CLP_SERIES[display]) {
        const base = await clpPerUnit(display)
        if (base) quote = { value: 1 / base.value, asOf: base.asOf }
      } else quote = await frankfurter(code, display)
      if (!quote) missing.push(code)
      else {
        rates[code] = Math.round(quote.value * 10000) / 10000
        if (quote.asOf) asOf = quote.asOf
      }
    } catch {
      missing.push(code)
    }
  }

  return NextResponse.json({
    display,
    rates,
    missing,
    as_of: asOf,
    source: display === 'CLP' || codes.includes('CLP') ? 'observado' : 'observado',
  })
}
