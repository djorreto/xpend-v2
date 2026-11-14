'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CURRENCIES, type TaxReference } from '@/lib/spend-basis'
import { SpendMonthChart } from '@/components/spend/spend-month-chart'

type CurrencyCount = { code: string; count: number }
type CountryCount = { code: string; name: string; count: number }

export function SpendBasisPanel({ uploadId }: { uploadId: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [references, setReferences] = useState<TaxReference[]>([])
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [currencies, setCurrencies] = useState<CurrencyCount[]>([])
  const [countries, setCountries] = useState<CountryCount[]>([])
  const [history, setHistory] = useState<{ id: string; created_at: string; snapshot: { note?: string; source?: string; tax_basis?: string; tax_rate?: number | null } }[]>([])
  const [confirmed, setConfirmed] = useState(true)
  const [groupId, setGroupId] = useState('none')
  const [country, setCountry] = useState('CL')
  const [mixed, setMixed] = useState(false)
  const [taxBasis, setTaxBasis] = useState<'net' | 'gross'>('net')
  const [rate, setRate] = useState('')
  const [countryRates, setCountryRates] = useState<Record<string, string>>({})
  const [display, setDisplay] = useState('CLP')
  const [fxMode, setFxMode] = useState<'native' | 'observed' | 'fixed'>('native')
  const [fxRates, setFxRates] = useState<Record<string, string>>({})
  const [fxAsOf, setFxAsOf] = useState('')
  const [windowMode, setWindowMode] = useState<'all' | 'calendar' | 'rolling'>('all')
  const [windowYear, setWindowYear] = useState(String(new Date().getFullYear()))
  const [windowEnd, setWindowEnd] = useState('')
  const [series, setSeries] = useState<{ month: string; amount: number }[]>([])
  const [seriesNote, setSeriesNote] = useState('')

  const loadSeries = async () => {
    const response = await fetch(`/api/si/series?upload_id=${uploadId}`)
    const body = await response.json()
    if (!response.ok) {
      setSeries([])
      setSeriesNote(body.error || 'El gráfico espera una moneda y una ventana válidas.')
      return
    }
    setSeries(body.months || [])
    const excluded = Object.keys(body.excluded || {})
    setSeriesNote([
      body.currency ? `Montos en ${body.currency}, neto.` : '',
      excluded.length ? `Fuera de esta vista: ${excluded.join(', ')}.` : '',
      body.undatedCount ? `${body.undatedCount} líneas sin fecha.` : '',
    ].filter(Boolean).join(' '))
  }

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/si/decisions?upload_id=${uploadId}`)
      const body = await response.json()
      if (!response.ok) {
        setError(body.error || 'No se pudo leer la base.')
        setLoading(false)
        return
      }
      const upload = body.upload
      setReferences(body.references || [])
      setGroups(body.groups || [])
      setCurrencies(body.currencies || [])
      setCountries(body.countries || [])
      setHistory(body.decisions || [])
      setConfirmed(Boolean(upload.decisions_confirmed))
      setGroupId(upload.group_id || 'none')
      setCountry(upload.country_code || '')
      setMixed(Boolean(upload.country_mixed))
      setTaxBasis(upload.tax_basis === 'gross' ? 'gross' : 'net')
      setRate(upload.tax_rate == null ? '' : String(upload.tax_rate))
      const savedRates: Record<string, string> = {}
      for (const [code, value] of Object.entries(upload.tax_rates || {})) savedRates[code] = String(value)
      setCountryRates(savedRates)
      setDisplay(upload.display_currency || body.currencies?.[0]?.code || 'CLP')
      setFxMode(upload.fx_mode || 'native')
      const savedFx: Record<string, string> = {}
      for (const [code, value] of Object.entries(upload.fx_rates || {})) savedFx[code] = String(value)
      setFxRates(savedFx)
      setFxAsOf(upload.fx_as_of || '')
      setWindowMode(upload.window_mode || 'all')
      setWindowYear(upload.window_year ? String(upload.window_year) : String(new Date().getFullYear()))
      setWindowEnd(upload.window_end || '')
      setLoading(false)
      await loadSeries()
    })()
  }, [uploadId])

  const observe = async () => {
    setError(null)
    const codes = currencies.map(item => item.code).filter(code => code !== display)
    const response = await fetch(`/api/si/fx?display=${display}&codes=${codes.join(',')}`)
    const body = await response.json()
    if (!response.ok) {
      setError(body.error || 'No se pudo leer el tipo de cambio.')
      return
    }
    const next = { ...fxRates }
    for (const [code, value] of Object.entries(body.rates || {})) next[code] = String(value)
    setFxRates(next)
    setFxAsOf(body.as_of || '')
    setFxMode('observed')
    if (body.missing?.length) setError(`No hubo tipo observado para ${body.missing.join(', ')}. Escríbelo a mano.`)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setNotice(null)
    const taxRates: Record<string, number> = {}
    for (const [code, value] of Object.entries(countryRates)) {
      const parsed = Number(String(value).replace(',', '.'))
      if (Number.isFinite(parsed)) taxRates[code] = parsed
    }
    const rates: Record<string, number> = {}
    for (const [code, value] of Object.entries(fxRates)) {
      const parsed = Number(String(value).replace(',', '.'))
      if (Number.isFinite(parsed) && parsed > 0) rates[code] = parsed
    }
    const response = await fetch('/api/si/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_id: uploadId,
        group_id: groupId === 'none' ? null : groupId,
        country_code: country,
        country_mixed: mixed,
        country_codes: countries.map(item => item.code).filter(code => code !== 'sin-pais'),
        tax_basis: taxBasis,
        tax_rate: rate.trim() ? Number(rate.replace(',', '.')) : null,
        tax_rates: taxRates,
        display_currency: display,
        fx_mode: fxMode,
        fx_rates: rates,
        fx_as_of: fxAsOf || null,
        window_mode: windowMode,
        window_year: Number(windowYear),
        window_end: windowEnd || null,
        currencies: currencies.map(item => item.code),
      }),
    })
    const body = await response.json()
    setSaving(false)
    if (!response.ok) {
      setError(body.error || 'No se guardó.')
      return
    }
    setConfirmed(true)
    setNotice(body.message)
    await loadSeries()
  }

  if (loading) return <p className="text-sm text-muted-foreground">Leyendo país, impuesto y moneda...</p>

  const otherCurrencies = currencies.map(item => item.code).filter(code => code !== display)
  const reference = references.find(item => item.code === country)

  return (
    <div className="space-y-4">
      {!confirmed && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          Esta carga es anterior. El monto sigue igual, tratado como neto, hasta que confirmes país e impuesto.
        </div>
      )}
      <Card>
        <CardHeader><CardTitle>País, impuesto y moneda</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="font-medium">Grupo</span>
              <select className="w-full rounded-md border bg-background p-2" value={groupId} onChange={event => setGroupId(event.target.value)}>
                <option value="none">Sin grupo</option>
                {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-medium">País</span>
              {mixed ? (
                <p>Varios países en el archivo: {countries.filter(item => item.code !== 'sin-pais').map(item => item.name).join(', ')}.</p>
              ) : (
                <select className="w-full rounded-md border bg-background p-2" value={country} onChange={event => setCountry(event.target.value)}>
                  <option value="">Elige el país</option>
                  {references.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                </select>
              )}
            </label>
            <div className="space-y-2">
              <span className="font-medium">Impuesto</span>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={taxBasis === 'net' ? 'default' : 'outline'} onClick={() => setTaxBasis('net')}>Sin impuesto</Button>
                <Button type="button" size="sm" variant={taxBasis === 'gross' ? 'default' : 'outline'} onClick={() => setTaxBasis('gross')}>Trae impuesto</Button>
              </div>
              {taxBasis === 'gross' && !mixed && (
                <Input value={rate} onChange={event => setRate(event.target.value)} placeholder={reference?.rate != null ? `Referencia ${reference.rate}%` : 'Porcentaje'} />
              )}
              {taxBasis === 'gross' && mixed && countries.filter(item => item.code !== 'sin-pais').map(item => (
                <label key={item.code} className="flex items-center gap-2">
                  <span className="w-28">{item.name}</span>
                  <Input className="w-24" value={countryRates[item.code] || ''} onChange={event => setCountryRates(current => ({ ...current, [item.code]: event.target.value }))} />
                </label>
              ))}
            </div>
            <label className="space-y-1">
              <span className="font-medium">Ver en</span>
              <select className="w-full rounded-md border bg-background p-2" value={display} onChange={event => setDisplay(event.target.value)}>
                {Array.from(new Set([...currencies.map(item => item.code), ...CURRENCIES])).map(code => <option key={code} value={code}>{code}</option>)}
              </select>
              <span className="block text-xs text-muted-foreground">Monedas de la base: {currencies.map(item => `${item.code} (${item.count})`).join(' · ') || '—'}</span>
            </label>
          </div>

          <div className="space-y-2">
            <span className="font-medium">Tipo de cambio</span>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={fxMode === 'native' ? 'default' : 'outline'} onClick={() => setFxMode('native')}>Solo la moneda elegida</Button>
              <Button type="button" size="sm" variant={fxMode === 'observed' ? 'default' : 'outline'} onClick={() => setFxMode('observed')}>Observado del día</Button>
              <Button type="button" size="sm" variant={fxMode === 'fixed' ? 'default' : 'outline'} onClick={() => setFxMode('fixed')}>Fijado a mano</Button>
              {fxMode !== 'native' && <Button type="button" size="sm" variant="outline" onClick={observe}>Traer observado</Button>}
            </div>
            {fxMode !== 'native' && otherCurrencies.map(code => (
              <label key={code} className="flex items-center gap-2">
                <span className="w-16">{code}</span>
                <Input className="w-32" value={fxRates[code] || ''} onChange={event => setFxRates(current => ({ ...current, [code]: event.target.value }))} placeholder={`1 ${code} en ${display}`} />
              </label>
            ))}
            {fxAsOf && <p className="text-xs text-muted-foreground">Tipo guardado con fecha {fxAsOf}. El plan usa este valor hasta que lo cambies.</p>}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="font-medium">Ventana</span>
              <select className="block rounded-md border bg-background p-2" value={windowMode} onChange={event => setWindowMode(event.target.value as 'all' | 'calendar' | 'rolling')}>
                <option value="all">Todo el archivo</option>
                <option value="calendar">Año calendario</option>
                <option value="rolling">Año móvil</option>
              </select>
            </label>
            {windowMode === 'calendar' && <Input className="w-28" value={windowYear} onChange={event => setWindowYear(event.target.value)} />}
            {windowMode === 'rolling' && <Input className="w-40" type="date" value={windowEnd} onChange={event => setWindowEnd(event.target.value)} />}
          </div>

          {error && <p className="text-red-700">{error}</p>}
          {notice && <p className="text-green-700">{notice}</p>}
          <Button type="button" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar decisión'}</Button>
          {history.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {history.slice(0, 4).map(item => (
                <p key={item.id}>{new Date(item.created_at).toLocaleString('es-CL')} · {item.snapshot?.note || item.snapshot?.source || 'ajuste'} {item.snapshot?.tax_basis === 'gross' ? `· impuesto ${item.snapshot.tax_rate ?? ''}%` : ''}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Gasto en el tiempo</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {seriesNote && <p className="text-xs text-muted-foreground">{seriesNote}</p>}
          <SpendMonthChart months={series} currency={display} />
        </CardContent>
      </Card>
    </div>
  )
}
