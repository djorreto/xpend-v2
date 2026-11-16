'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabaseBrowser } from '@/lib/supabase'
import { canReadSpendRole } from '@/lib/spend-privacy'
import { CURRENCIES } from '@/lib/spend-basis'
import { SpendMonthChart } from '@/components/spend/spend-month-chart'
import { DossierThread } from '@/components/dossier-thread'
import { canOpenOpportunity, saveDossier } from '@/lib/dossier-store'
import { linkInitiativeToOpportunity } from '@/lib/portfolio-data'

type Group = {
  id: string
  name: string
  display_currency: string | null
  fx_mode: 'native' | 'observed' | 'fixed'
  fx_rates: Record<string, number> | null
  fx_as_of: string | null
  window_mode: 'all' | 'calendar' | 'rolling'
  window_year: number | null
  window_end: string | null
}

export default function SpendGroupPage() {
  const params = useParams()
  const groupId = params.id as string
  const router = useRouter()
  const supabase = supabaseBrowser()
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [uploads, setUploads] = useState<{ id: string; file_name: string; country_code: string | null; display_currency: string | null; decisions_confirmed: boolean }[]>([])
  const [plan, setPlan] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [currencies, setCurrencies] = useState<string[]>([])
  const [display, setDisplay] = useState('CLP')
  const [fxMode, setFxMode] = useState<'native' | 'observed' | 'fixed'>('native')
  const [fxRates, setFxRates] = useState<Record<string, string>>({})
  const [fxAsOf, setFxAsOf] = useState('')
  const [windowMode, setWindowMode] = useState<'all' | 'calendar' | 'rolling'>('all')
  const [windowYear, setWindowYear] = useState(String(new Date().getFullYear()))
  const [windowEnd, setWindowEnd] = useState('')
  const [series, setSeries] = useState<{ month: string; amount: number }[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = async (profile: { company_id: string }) => {
    const { data: groups } = await supabase.from('si_spend_groups').select('*').eq('id', groupId).eq('company_id', profile.company_id).limit(1)
    const current = groups?.[0] as Group | undefined
    if (!current) {
      setGroup(null)
      return
    }
    setGroup(current)
    setDisplay(current.display_currency || 'CLP')
    setFxMode(current.fx_mode || 'native')
    const rates: Record<string, string> = {}
    for (const [code, value] of Object.entries(current.fx_rates || {})) rates[code] = String(value)
    setFxRates(rates)
    setFxAsOf(current.fx_as_of || '')
    setWindowMode(current.window_mode || 'all')
    setWindowYear(current.window_year ? String(current.window_year) : String(new Date().getFullYear()))
    setWindowEnd(current.window_end || '')

    const { data: files } = await supabase
      .from('si_uploads')
      .select('id, file_name, country_code, display_currency, decisions_confirmed')
      .eq('group_id', groupId)
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })
    setUploads(files || [])

    const found = new Set<string>()
    for (const file of files || []) {
      const { data: lines } = await supabase.from('si_spend_lines').select('currency').eq('upload_id', file.id).limit(2000)
      for (const line of lines || []) if (line.currency) found.add(line.currency)
    }
    const currencyList = Array.from(found)
    setCurrencies(currencyList)
    if (!current.display_currency && currencyList[0]) setDisplay(currencyList[0])

    const { data: plans } = await supabase
      .from('si_procurement_plans')
      .select('*')
      .eq('group_id', groupId)
      .eq('company_id', profile.company_id)
      .is('upload_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
    const currentPlan = plans?.[0] || null
    setPlan(currentPlan)
    if (currentPlan) {
      const { data: planItems } = await supabase.from('si_plan_items').select('*').eq('plan_id', currentPlan.id).order('total_spend', { ascending: false })
      setItems(planItems || [])
    } else setItems([])

    const response = await fetch(`/api/si/series?group_id=${groupId}`)
    const body = await response.json()
    setSeries(response.ok ? body.months || [] : [])
    if (!response.ok) setMessage(body.error || '')
  }

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('*, companies(*)').eq('id', session.user.id).single()
      if (!profile || !canReadSpendRole(profile.role)) {
        setLoading(false)
        return
      }
      setUser(profile)
      setCompany(profile.companies)
      await load(profile)
      setLoading(false)
    })()
  }, [groupId])

  const saveView = async () => {
    if (!user?.company_id || !group) return
    setBusy(true)
    setMessage('')
    const rates: Record<string, number> = {}
    for (const [code, value] of Object.entries(fxRates)) {
      const parsed = Number(String(value).replace(',', '.'))
      if (parsed > 0) rates[code] = parsed
    }
    const { error } = await supabase.from('si_spend_groups').update({
      display_currency: display,
      fx_mode: fxMode,
      fx_rates: rates,
      fx_as_of: fxAsOf || null,
      window_mode: windowMode,
      window_year: windowMode === 'calendar' ? Number(windowYear) : null,
      window_end: windowMode === 'rolling' ? windowEnd || null : null,
      updated_at: new Date().toISOString(),
    }).eq('id', group.id).eq('company_id', user.company_id)
    if (error) {
      setMessage('No se guardó la vista del grupo.')
      setBusy(false)
      return
    }
    await supabase.from('si_procurement_plans').update({ stale: true }).eq('group_id', group.id).eq('company_id', user.company_id)
    await supabase.from('si_spend_decisions').insert({
      company_id: user.company_id,
      group_id: group.id,
      created_by: user.id,
      snapshot: { source: 'vista_grupo', display_currency: display, fx_mode: fxMode, fx_rates: rates, window_mode: windowMode },
    })
    await load(user)
    setMessage('La vista quedó guardada. El plan del grupo hay que generarlo de nuevo.')
    setBusy(false)
  }

  const observe = async () => {
    const codes = currencies.filter(code => code !== display)
    const response = await fetch(`/api/si/fx?display=${display}&codes=${codes.join(',')}`)
    const body = await response.json()
    if (!response.ok) {
      setMessage(body.error || 'No se pudo leer el tipo de cambio.')
      return
    }
    const next = { ...fxRates }
    for (const [code, value] of Object.entries(body.rates || {})) next[code] = String(value)
    setFxRates(next)
    setFxAsOf(body.as_of || '')
    setFxMode('observed')
    if (body.missing?.length) setMessage(`Sin tipo observado para ${body.missing.join(', ')}.`)
  }

  const generate = async () => {
    setBusy(true)
    setMessage('')
    const response = await fetch('/api/si/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, plan_name: `Plan ${group?.name || ''} ${windowYear}`.trim(), plan_year: Number(windowYear) || new Date().getFullYear() }),
    })
    const body = await response.json()
    if (!response.ok) setMessage(body.error || 'No se pudo generar el plan.')
    else {
      if (user) await load(user)
      const excluded = Object.keys(body.excluded || {})
      setMessage(excluded.length ? `Plan en ${body.currency}. Quedó fuera el gasto en ${excluded.join(', ')}.` : `Plan generado en ${body.currency}.`)
    }
    setBusy(false)
  }

  const addItem = async (item: any) => {
    if (!company || !user) return
    const { data: files } = await supabase
      .from('si_uploads')
      .select('id, country_code, decisions_confirmed, display_currency')
      .eq('group_id', groupId)
      .eq('company_id', company.id)
    if (!canOpenOpportunity(files || [])) {
      setMessage('Confirma país, impuesto y moneda de un análisis del grupo antes de crear la iniciativa.')
      return
    }
    const confirmed = (files || []).find(file => file.decisions_confirmed)
    const currency = plan?.display_currency || confirmed?.display_currency || display
    const { data, error } = await supabase.from('sourcing_plans').insert({
      company_id: company.id,
      group_id: groupId,
      plan_year: plan?.plan_year || new Date().getFullYear(),
      quarter: item.recommended_quarter || 'Q1',
      initiative_type: 'licitacion',
      title: item.category,
      description: `Iniciativa del grupo ${group?.name}. Gasto neto en ${currency}. País ${confirmed?.country_code || 'por confirmar'}.`,
      category: item.category,
      estimated_spend: item.total_spend || 0,
      currency,
      projected_savings_percentage: item.projected_savings_percentage || 0,
      projected_savings_amount: item.projected_savings_amount || 0,
      status: 'planned',
      is_spot: false,
      created_by: user.id,
    }).select('id').limit(1)
    if (error || !data?.[0]) {
      setMessage(error?.message || 'No se creó la iniciativa.')
      return
    }
    await linkInitiativeToOpportunity(supabase, { companyId: company.id, userId: user.id, planId: data[0].id, opportunityId: item.id, categoryName: item.category })
    await saveDossier(supabase, {
      companyId: company.id,
      userId: user.id,
      title: item.category,
      groupId,
      uploadId: confirmed?.id || null,
      sourcingPlanId: data[0].id,
      currency,
      netSpend: item.total_spend || 0,
      countryCode: confirmed?.country_code || null,
      stage: 'iniciativa',
    })
    setMessage('La iniciativa quedó en el sourcing plan de este grupo, con el gasto neto ya cargado.')
  }

  if (loading) {
    return <MainLayout user={user} companyName={company?.name}><div className="flex h-96 items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-b-2" /></div></MainLayout>
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{group?.name || 'Grupo'}</h1>
          <p className="mt-2 text-muted-foreground">El plan de este grupo suma solo los análisis asignados, en neto y en la moneda elegida.</p>
        </div>
        <DossierThread match={{ companyId: company?.id || '', groupId }} />
        <Card>
          <CardHeader><CardTitle>Análisis del grupo</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {uploads.length === 0 && <p>Todavía no hay análisis en este grupo.</p>}
            {uploads.map(file => (
              <button key={file.id} className="block text-left underline" onClick={() => router.push(`/sourcing-intelligence/${file.id}`)}>
                {file.file_name} · {file.country_code || 'país por confirmar'} · {file.decisions_confirmed ? 'decisiones confirmadas' : 'falta confirmar'}
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Cómo se ve el gasto</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-3">
              <select className="rounded-md border bg-background p-2" value={display} onChange={event => setDisplay(event.target.value)}>
                {Array.from(new Set([...currencies, ...CURRENCIES])).map(code => <option key={code} value={code}>{code}</option>)}
              </select>
              <select className="rounded-md border bg-background p-2" value={fxMode} onChange={event => setFxMode(event.target.value as 'native' | 'observed' | 'fixed')}>
                <option value="native">Solo esta moneda</option>
                <option value="observed">Tipo observado</option>
                <option value="fixed">Tipo fijado</option>
              </select>
              <select className="rounded-md border bg-background p-2" value={windowMode} onChange={event => setWindowMode(event.target.value as 'all' | 'calendar' | 'rolling')}>
                <option value="all">Todo</option>
                <option value="calendar">Año calendario</option>
                <option value="rolling">Año móvil</option>
              </select>
              {windowMode === 'calendar' && <Input className="w-28" value={windowYear} onChange={event => setWindowYear(event.target.value)} />}
              {windowMode === 'rolling' && <Input className="w-40" type="date" value={windowEnd} onChange={event => setWindowEnd(event.target.value)} />}
              {fxMode !== 'native' && <Button type="button" variant="outline" onClick={observe}>Traer observado</Button>}
            </div>
            {fxMode !== 'native' && currencies.filter(code => code !== display).map(code => (
              <label key={code} className="flex items-center gap-2">
                <span className="w-16">{code}</span>
                <Input className="w-32" value={fxRates[code] || ''} onChange={event => setFxRates(current => ({ ...current, [code]: event.target.value }))} />
              </label>
            ))}
            {fxAsOf && <p className="text-xs text-muted-foreground">Tipo de cambio del {fxAsOf}.</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={saveView} disabled={busy}>Guardar vista</Button>
              <Button type="button" onClick={generate} disabled={busy}>Generar plan del grupo</Button>
            </div>
            {message && <p>{message}</p>}
            {plan?.stale && <p className="text-amber-800">El plan está desactualizado. Generarlo de nuevo usa las decisiones actuales.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Gasto en el tiempo</CardTitle></CardHeader>
          <CardContent><SpendMonthChart months={series} currency={display} /></CardContent>
        </Card>
        {items.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Plan del grupo · {plan?.display_currency}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 border-b py-2">
                  <span>{item.category}</span>
                  <span>{Math.round(item.total_spend).toLocaleString('es-CL')} {plan?.display_currency}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => addItem(item)}>Al sourcing plan</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
