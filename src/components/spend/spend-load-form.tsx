'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CURRENCIES, referenceFor, type TaxReference } from '@/lib/spend-basis'
import { ArrowRight } from 'lucide-react'

type Stats = {
  currencies: { code: string; count: number }[]
  countries: { code: string; name: string; count: number }[]
  dated: number
  min: string | null
  max: string | null
  total: number
  blankCurrency?: number
  unknownCurrency?: number
}

const FIELDS = [
  { key: 'description', label: 'Descripción *' },
  { key: 'amount', label: 'Monto *' },
  { key: 'supplier_name', label: 'Proveedor' },
  { key: 'purchase_order', label: 'Orden de compra' },
  { key: 'currency', label: 'Moneda' },
  { key: 'country', label: 'País' },
  { key: 'purchase_date', label: 'Fecha' },
  { key: 'cost_center', label: 'Centro de costo' },
]

export function SpendLoadForm({
  columns,
  mapping,
  onMapping,
  stats,
  groups,
  references,
  saving,
  onReread,
  onCancel,
  onConfirm,
}: {
  columns: string[]
  mapping: Record<string, string>
  onMapping: (mapping: Record<string, string>) => void
  stats: Stats
  groups: { id: string; name: string }[]
  references: TaxReference[]
  saving: boolean
  onReread: () => void
  onCancel: () => void
  onConfirm: (decisions: Record<string, unknown>) => void
}) {
  const knownCountries = stats.countries.filter(item => item.code !== 'sin-pais')
  const mixed = knownCountries.length > 1
  const readCountry = knownCountries.length === 1 && !stats.countries.some(item => item.code === 'sin-pais')
    ? knownCountries[0].code
    : ''
  const [groupId, setGroupId] = useState('none')
  const [newGroup, setNewGroup] = useState('')
  const [country, setCountry] = useState(readCountry || 'none')
  const [taxBasis, setTaxBasis] = useState<'net' | 'gross'>('net')
  const [rate, setRate] = useState('')
  const [countryRates, setCountryRates] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const item of knownCountries) {
      const official = references.find(ref => ref.code === item.code)?.rate
      if (official != null) initial[item.code] = String(official)
    }
    return initial
  })
  const [fallback, setFallback] = useState(stats.currencies[0]?.code || '')
  const [noDate, setNoDate] = useState(false)
  const needsCurrency = !mapping.currency || stats.currencies.length === 0 || (stats.blankCurrency || 0) > 0 || (stats.unknownCurrency || 0) > 0
  const official = referenceFor(mixed ? null : (readCountry || country))
  const suggested = useMemo(() => {
    const ref = references.find(item => item.code === (readCountry || country))
    return ref?.rate ?? official?.rate ?? null
  }, [references, readCountry, country, official])

  const setColumn = (key: string, value: string) => {
    const next = { ...mapping }
    if (value === 'none') delete next[key]
    else next[key] = value
    onMapping(next)
  }

  const confirm = () => {
    const taxRates: Record<string, number> = {}
    if (taxBasis === 'gross' && mixed) {
      for (const item of knownCountries) {
        const value = Number(String(countryRates[item.code] || '').replace(',', '.'))
        if (Number.isFinite(value)) taxRates[item.code] = value
      }
    }
    onConfirm({
      group_id: groupId === 'none' ? null : groupId,
      new_group_name: newGroup.trim() || null,
      country_code: readCountry || (country === 'none' ? null : country),
      tax_basis: taxBasis,
      tax_rate: taxBasis === 'gross' && !mixed
        ? (rate.trim() ? Number(rate.replace(',', '.')) : suggested)
        : null,
      tax_rate_kind: taxBasis === 'net' ? 'none' : 'official',
      tax_rates: taxRates,
      fallback_currency: fallback,
      display_currency: fallback || stats.currencies[0]?.code || null,
      acknowledge_no_date: noDate,
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Nada se guarda hasta confirmar. El gasto que se analiza queda sin impuesto.
        {stats.dated > 0 ? ` Fechas leídas: ${stats.dated.toLocaleString()} (${stats.min} a ${stats.max}).` : ' No se leyó ninguna fecha.'}
      </div>

      <div className="space-y-3">
        {FIELDS.map(field => (
          <div key={field.key} className="flex items-center gap-4">
            <label className="w-40 text-sm font-medium">{field.label}</label>
            <Select value={mapping[field.key] || 'none'} onValueChange={value => setColumn(field.key, value)}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin mapear</SelectItem>
                {columns.map(column => <SelectItem key={column} value={column}>{column}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={onReread}>Volver a leer el archivo</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Grupo</p>
          <Select value={groupId} onValueChange={setGroupId}>
            <SelectTrigger><SelectValue placeholder="Sin grupo por ahora" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin grupo por ahora</SelectItem>
              {groups.map(group => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={newGroup} onChange={event => setNewGroup(event.target.value)} placeholder="O crea un grupo: holding, filial o un nombre" />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">País de la base</p>
          {readCountry ? (
            <p className="text-sm">Leído del archivo: {knownCountries[0].name}. El impuesto oficial se sugiere con este país.</p>
          ) : mixed ? (
            <p className="text-sm">El archivo trae varios países. Cada línea guarda el suyo.</p>
          ) : (
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue placeholder="Elige el país" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Elige el país</SelectItem>
                {references.map(item => <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Moneda</p>
          {stats.currencies.length > 0 && (
            <p className="text-sm text-muted-foreground">{stats.currencies.map(item => `${item.code} (${item.count})`).join(' · ')}</p>
          )}
          {needsCurrency && (
            <Select value={fallback || 'none'} onValueChange={value => setFallback(value === 'none' ? '' : value)}>
              <SelectTrigger><SelectValue placeholder="Moneda de los montos sin código" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Elegir moneda</SelectItem>
                {CURRENCIES.map(code => <SelectItem key={code} value={code}>{code}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Impuesto</p>
          <div className="flex gap-2">
            <Button type="button" variant={taxBasis === 'net' ? 'default' : 'outline'} onClick={() => setTaxBasis('net')}>Ya viene sin impuesto</Button>
            <Button type="button" variant={taxBasis === 'gross' ? 'default' : 'outline'} onClick={() => setTaxBasis('gross')}>Trae impuesto</Button>
          </div>
          {taxBasis === 'gross' && !mixed && (
            <div className="space-y-1">
              <Input
                value={rate}
                onChange={event => setRate(event.target.value)}
                placeholder={suggested != null ? `Tasa de referencia ${suggested}%` : 'Escribe el porcentaje'}
              />
              <p className="text-xs text-muted-foreground">
                {suggested != null
                  ? `Si lo dejas vacío se usa ${suggested}%${official?.taxName ? ` (${official.taxName})` : ''}. Si escribes otro, queda como tasa propia.`
                  : 'Este país no tiene una tasa única. Escribe el porcentaje.'}
              </p>
            </div>
          )}
          {taxBasis === 'gross' && mixed && knownCountries.map(item => (
            <label key={item.code} className="flex items-center gap-2 text-sm">
              <span className="w-28">{item.name}</span>
              <Input
                className="w-28"
                value={countryRates[item.code] || ''}
                onChange={event => setCountryRates(current => ({ ...current, [item.code]: event.target.value }))}
                placeholder="%"
              />
            </label>
          ))}
        </div>
      </div>

      {stats.dated === 0 && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={noDate} onChange={event => setNoDate(event.target.checked)} className="mt-1" />
          <span>Esta base no trae fecha. Queda sin año móvil y sin gráfico de gasto.</span>
        </label>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="button" onClick={confirm} disabled={saving || !mapping.description || !mapping.amount} className="flex-1 bg-gradient-to-r from-[#2AD4D2] to-[#3BE7AE]">
          {saving ? 'Guardando...' : 'Confirmar y guardar'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
