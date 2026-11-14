import { NextRequest, NextResponse } from 'next/server'
import { requireSpendAccess } from '@/lib/spend-access'
import { countryName, matchCountry, parseRate, parseRateMap, referenceFor, TAX_REFERENCES } from '@/lib/spend-basis'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const access = await requireSpendAccess('analyst')
  if (!access.ok) return access.response
  const { supabase, profile } = access
  const uploadId = request.nextUrl.searchParams.get('upload_id')
  if (!uploadId) return NextResponse.json({ error: 'Falta el análisis.' }, { status: 400 })

  const { data: uploads } = await supabase
    .from('si_uploads')
    .select('*')
    .eq('id', uploadId)
    .eq('company_id', profile.company_id)
    .limit(1)
  const upload = uploads?.[0]
  if (!upload) return NextResponse.json({ error: 'No se encontró el análisis.' }, { status: 404 })

  const currencies = new Map<string, number>()
  const countries = new Map<string, number>()
  for (let from = 0; ; from += 4000) {
    const { data, error } = await supabase
      .from('si_spend_lines')
      .select('currency, country_code')
      .eq('upload_id', uploadId)
      .eq('company_id', profile.company_id)
      .order('line_number', { ascending: true })
      .range(from, from + 3999)
    if (error) return NextResponse.json({ error: 'No se pudieron leer las líneas.' }, { status: 500 })
    if (!data?.length) break
    for (const line of data) {
      const currency = String(line.currency || 'USD')
      currencies.set(currency, (currencies.get(currency) || 0) + 1)
      const country = String(line.country_code || 'sin-pais')
      countries.set(country, (countries.get(country) || 0) + 1)
    }
    if (data.length < 4000) break
  }

  const { data: decisions } = await supabase
    .from('si_spend_decisions')
    .select('id, snapshot, created_at, created_by')
    .eq('upload_id', uploadId)
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })
    .limit(8)

  const { data: groups } = await supabase
    .from('si_spend_groups')
    .select('id, name')
    .eq('company_id', profile.company_id)
    .order('name')

  return NextResponse.json({
    upload,
    groups: groups || [],
    currencies: Array.from(currencies.entries()).map(([code, count]) => ({ code, count })),
    countries: Array.from(countries.entries()).map(([code, count]) => ({
      code,
      count,
      name: code === 'sin-pais' ? 'Sin país' : countryName(code),
    })),
    decisions: decisions || [],
    references: TAX_REFERENCES,
  })
}

export async function POST(request: NextRequest) {
  const access = await requireSpendAccess('manager')
  if (!access.ok) return access.response
  const { supabase, profile } = access
  const body = await request.json().catch(() => ({}))
  const uploadId = body?.upload_id
  if (!uploadId || typeof uploadId !== 'string') {
    return NextResponse.json({ error: 'Falta el análisis.' }, { status: 400 })
  }

  const { data: uploads } = await supabase
    .from('si_uploads')
    .select('*')
    .eq('id', uploadId)
    .eq('company_id', profile.company_id)
    .limit(1)
  const current = uploads?.[0]
  if (!current) return NextResponse.json({ error: 'No se encontró el análisis.' }, { status: 404 })

  const taxBasis = body.tax_basis === 'gross' ? 'gross' : body.tax_basis === 'net' ? 'net' : current.tax_basis
  const countryMixed = body.country_mixed === true || (body.country_mixed == null && current.country_mixed)
  const countryCode = countryMixed ? null : matchCountry(body.country_code ?? current.country_code)
  if (!countryMixed && !countryCode) {
    return NextResponse.json({ error: 'Indica de qué país es esta base.' }, { status: 400 })
  }

  const taxRates = parseRateMap(body.tax_rates ?? current.tax_rates)
  let taxRate = taxBasis === 'net' ? null : parseRate(body.tax_rate ?? current.tax_rate)
  let taxKind: 'official' | 'custom' | 'none' = taxBasis === 'net' ? 'none' : 'custom'
  if (taxBasis === 'gross' && !countryMixed) {
    if (taxRate == null) return NextResponse.json({ error: 'Escribe el porcentaje de impuesto.' }, { status: 400 })
    const official = referenceFor(countryCode)?.rate
    taxKind = body.tax_rate_kind === 'official' && official === taxRate ? 'official' : official === taxRate ? 'official' : 'custom'
  }
  if (taxBasis === 'gross' && countryMixed) {
    const needed = Array.isArray(body.country_codes) ? body.country_codes : Object.keys(taxRates)
    if (!needed.length || needed.some((code: string) => taxRates[code] == null)) {
      return NextResponse.json({ error: 'Falta la tasa de algún país de la base.' }, { status: 400 })
    }
    taxKind = 'official'
    taxRate = null
  }

  const display = body.display_currency ? String(body.display_currency).toUpperCase() : current.display_currency
  const fxMode = body.fx_mode === 'observed' || body.fx_mode === 'fixed' || body.fx_mode === 'native'
    ? body.fx_mode
    : current.fx_mode || 'native'
  const fxRates = body.fx_rates && typeof body.fx_rates === 'object' ? body.fx_rates : current.fx_rates || {}
  const windowMode = body.window_mode === 'calendar' || body.window_mode === 'rolling' || body.window_mode === 'all'
    ? body.window_mode
    : current.window_mode || 'all'
  if (windowMode === 'calendar' && !Number(body.window_year || current.window_year)) {
    return NextResponse.json({ error: 'Elige el año calendario.' }, { status: 400 })
  }
  if (windowMode === 'rolling' && !(body.window_end || current.window_end)) {
    return NextResponse.json({ error: 'Elige la fecha final del año móvil.' }, { status: 400 })
  }
  if ((fxMode === 'observed' || fxMode === 'fixed') && display) {
    const rates = fxRates as Record<string, number>
    const currencies = Array.isArray(body.currencies) ? body.currencies as string[] : []
    const missing = currencies.filter(code => code !== display && !(Number(rates[code]) > 0))
    if (missing.length) {
      return NextResponse.json({ error: `Falta el tipo de cambio de ${missing.join(', ')}.` }, { status: 400 })
    }
  }

  const patch = {
    group_id: body.group_id === undefined ? current.group_id : body.group_id || null,
    country_code: countryCode,
    country_mixed: countryMixed,
    tax_basis: taxBasis,
    tax_rate: taxRate,
    tax_rate_kind: taxKind,
    tax_rates: countryMixed ? taxRates : {},
    decisions_confirmed: true,
    display_currency: display,
    fx_mode: fxMode,
    fx_rates: fxRates,
    fx_as_of: body.fx_as_of || current.fx_as_of || null,
    window_mode: windowMode,
    window_year: windowMode === 'calendar' ? Number(body.window_year || current.window_year) : null,
    window_end: windowMode === 'rolling' ? String(body.window_end || current.window_end).slice(0, 10) : null,
    updated_at: new Date().toISOString(),
  }

  const { error: updateError } = await supabase
    .from('si_uploads')
    .update(patch)
    .eq('id', uploadId)
    .eq('company_id', profile.company_id)
  if (updateError) return NextResponse.json({ error: 'No se guardó la decisión.' }, { status: 400 })

  const { error: recomputeError } = await supabase.rpc('recompute_spend_net', { p_upload_id: uploadId })
  if (recomputeError) {
    return NextResponse.json({ error: 'La decisión quedó guardada, pero no se pudo recalcular el neto. Revisa la tasa.' }, { status: 400 })
  }

  const staleTargets = [patch.group_id, current.group_id].filter(Boolean)
  await supabase.from('si_procurement_plans').update({ stale: true }).eq('upload_id', uploadId).eq('company_id', profile.company_id)
  for (const groupId of Array.from(new Set(staleTargets))) {
    await supabase.from('si_procurement_plans').update({ stale: true }).eq('group_id', groupId).eq('company_id', profile.company_id)
  }

  await supabase.from('si_spend_decisions').insert({
    company_id: profile.company_id,
    upload_id: uploadId,
    group_id: patch.group_id,
    created_by: profile.id,
    snapshot: { source: 'ajuste', ...patch },
  })

  return NextResponse.json({ success: true, message: 'El neto se recalculó desde el monto original. El plan queda por regenerar.' })
}
