'use client'

import { useEffect, useState } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'
import { loadMorningQueue, savingsByCurrency, type CurrencySavings, type MorningQueue } from '@/lib/procurement-flow'
import {
  describeSpendSource,
  fetchUnifiedSpendForCompany,
  latestSpendClosure,
  totalsByCurrency,
  type MoneyTotal,
  type SpendClosure,
  type SpendSourceInfo,
} from '@/lib/spend-sources'

export default function ComitePage() {
  const { addToast } = useToast()
  const [user, setUser] = useState<{ name: string; email: string; role: string; id: string } | null>(null)
  const [companyName, setCompanyName] = useState<string>()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [source, setSource] = useState<SpendSourceInfo | null>(null)
  const [closure, setClosure] = useState<SpendClosure | null>(null)
  const [closedSnapshot, setClosedSnapshot] = useState(false)
  const [queue, setQueue] = useState<MorningQueue | null>(null)
  const [monthSpend, setMonthSpend] = useState<MoneyTotal[]>([])
  const [monthLines, setMonthLines] = useState(0)
  const [savings, setSavings] = useState<CurrencySavings[]>([])
  const [awards, setAwards] = useState<Array<{ id: string; title: string; currency: string | null; award: { supplier_id?: string; amount?: number; savings_amount?: number | null; estimated_savings?: number | null; target_savings?: number | null } | null }>>([])
  const [pending, setPending] = useState<Array<{ id: string; licitacion_id: string; event_id?: string }>>([])
  const period = new Date().toISOString().slice(0, 7)

  const load = async () => {
    const supabase = supabaseBrowser()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      setLoading(false)
      return
    }
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (!profile?.company_id) {
      setLoading(false)
      return
    }
    setUser({
      id: profile.id,
      name: profile.full_name || session.user.email || '',
      email: session.user.email || '',
      role: profile.role,
    })
    setCompanyId(profile.company_id)
    const { data: company } = await supabase.from('companies').select('name').eq('id', profile.company_id).single()
    setCompanyName(company?.name)

    const [spendSource, rows, morning, plans, closed] = await Promise.all([
      describeSpendSource(supabase, profile.company_id),
      fetchUnifiedSpendForCompany(supabase, profile.company_id),
      loadMorningQueue(supabase, profile.company_id),
      supabase.from('sourcing_plans').select('id, currency, projected_savings_amount, actual_savings_amount, status').eq('company_id', profile.company_id).eq('plan_year', new Date().getFullYear()),
      latestSpendClosure(supabase, profile.company_id),
    ])
    const monthRows = rows.filter(row => row.date.startsWith(period))
    const logged = await fetch('/api/process?action=spend_closed').then(response => response.json()).catch(() => ({ events: [] }))
    const snapshots = (logged.events || []).filter((event: { metadata?: { period?: string; line_count?: number } }) => event.metadata?.period === period)
    setSource(spendSource)
    if (snapshots.length) {
      setClosedSnapshot(true)
      setMonthSpend(snapshots.map((event: { metadata?: { currency?: string; total?: number } }) => ({
        currency: String(event.metadata?.currency || 'CLP'),
        amount: Number(event.metadata?.total) || 0,
      })))
      setMonthLines(Number(snapshots[0]?.metadata?.line_count) || monthRows.length)
    } else {
      setClosedSnapshot(false)
      setMonthSpend(totalsByCurrency(monthRows))
      setMonthLines(monthRows.length)
    }
    setQueue(morning)
    setClosure(closed)

    const planRows = plans.data || []
    const planIds = planRows.map(plan => plan.id)
    const linkRows: { plan_id: string; savings_amount: number | null; currency: string | null; awarded?: boolean }[] = []
    if (planIds.length) {
      const { data: links } = await supabase
        .from('sourcing_plan_licitaciones')
        .select('plan_id, licitacion:licitaciones(savings_amount, baseline_currency, status)')
        .in('plan_id', planIds)
      for (const link of links || []) {
        const licitacion = Array.isArray(link.licitacion) ? link.licitacion[0] : link.licitacion
        linkRows.push({
          plan_id: link.plan_id,
          savings_amount: licitacion?.savings_amount ?? null,
          currency: licitacion?.baseline_currency ?? null,
          awarded: licitacion?.status === 'awarded',
        })
      }
    }
    setSavings(savingsByCurrency(planRows, linkRows))
    const { data: dossierRows } = await supabase
      .from('procurement_dossiers')
      .select('id, title, currency, award, stage')
      .eq('company_id', profile.company_id)
      .eq('stage', 'adjudicada')
    setAwards(dossierRows || [])
    const { data: pendingRows } = await supabase
      .from('award_decisions')
      .select('id, licitacion_id, packet:decision_packets(event_id)')
      .eq('company_id', profile.company_id)
      .eq('outcome', 'pending')
    setPending((pendingRows || []).map(row => {
      const packet = Array.isArray(row.packet) ? row.packet[0] : row.packet
      return { id: row.id, licitacion_id: row.licitacion_id, event_id: packet?.event_id }
    }))
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const closeMonth = async () => {
    if (!companyId || !user || closedSnapshot) return
    setClosing(true)
    const response = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'spend_closed',
        payload: { period, totals: monthSpend, line_count: monthLines },
      }),
    })
    const body = await response.json()
    setClosing(false)
    if (!response.ok) {
      addToast({ type: 'error', title: 'No se cerró el período', message: body.error || 'Error' })
      return
    }
    addToast({
      type: 'success',
      title: 'Período cerrado',
      message: `${period} quedó guardado por moneda. Una carga nueva no lo rearma.`,
    })
    load()
  }

  if (loading) {
    return (
      <MainLayout>
        <LoadingSpinner />
      </MainLayout>
    )
  }

  const delayed = new Set(
    (queue?.stalled || []).map(item => item.id)
      .concat((queue?.withoutProcess || []).map(item => item.id))
      .concat((queue?.withoutOwner || []).map(item => item.id))
  ).size

  return (
    <MainLayout user={user || undefined} companyName={companyName}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1>Comité</h1>
            <p className="mt-1 text-[13px] text-petrol-blue/55">
              {period}. {source?.label}
            </p>
          </div>
          <Button onClick={closeMonth} disabled={closing || !companyId || closedSnapshot || monthSpend.length === 0}>
            {closedSnapshot ? `${period} cerrado` : closing ? 'Cerrando…' : `Cerrar ${period}`}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Gasto del período</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1 text-2xl font-medium text-petrol-blue">
                {(monthSpend.length ? monthSpend : [{ currency: 'CLP', amount: 0 }]).map(item => (
                  <p key={item.currency}>{formatCurrency(item.amount, item.currency)}</p>
                ))}
              </div>
              <p className="mt-1 text-xs text-petrol-blue/50">
                {closedSnapshot ? 'Mes cerrado. El número no se rearma.' : `${monthLines} líneas del mes en curso`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Atrasos</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-medium text-petrol-blue">{delayed}</p>
              <p className="mt-1 text-xs text-petrol-blue/50">Detenidos, sin dueño o sin proceso, incluidos los trimestres vencidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Ahorro comprometido</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1 text-2xl font-medium text-petrol-blue">
                {(savings.length ? savings : [{ currency: 'CLP', projected: 0, actual: 0, rate: 0 }]).map(row => (
                  <p key={row.currency}>{formatCurrency(row.projected, row.currency)}</p>
                ))}
              </div>
              <p className="mt-1 text-xs text-petrol-blue/50">Meta del plan de este año, por moneda</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Ahorro estimado</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1 text-2xl font-medium text-petrol-blue">
                {(savings.length ? savings : [{ currency: 'CLP', projected: 0, actual: 0, rate: 0 }]).map(row => (
                  <p key={row.currency}>{formatCurrency(row.actual, row.currency)}</p>
                ))}
              </div>
              <p className="mt-1 text-xs text-petrol-blue/50">
                Resultado de adjudicaciones en la misma moneda. Un cero es un resultado. El realizado se muestra solo con evidencia posterior.
              </p>
            </CardContent>
          </Card>
        </div>

        {pending.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Decisiones pendientes</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {pending.map(item => (
                <p key={item.id}>
                  {item.licitacion_id}
                  {item.event_id && <a className="ml-2 underline" href={`/sala/${item.event_id}/decision`}>Abrir expediente</a>}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

        {awards.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Decisiones de adjudicación</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {awards.map(row => (
                <div key={row.id}>
                  <p className="font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Oferta ganadora {row.award?.amount != null ? formatCurrency(row.award.amount, row.currency || 'CLP') : 'sin monto'}
                    {row.award?.target_savings != null ? ` · objetivo ${formatCurrency(row.award.target_savings, row.currency || 'CLP')}` : ''}
                    {row.award?.estimated_savings != null ? ` · estimado ${formatCurrency(row.award.estimated_savings, row.currency || 'CLP')}` : ''}
                    {row.award?.supplier_id ? ` · proveedor ${row.award.supplier_id}` : ''}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {queue && (
          <Card>
            <CardHeader><CardTitle>Qué explicar en la reunión</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {[
                ['Procesos detenidos', queue.stalled],
                ['Iniciativas sin proceso', queue.withoutProcess],
                ['Sin responsable', queue.withoutOwner],
                ['Bases por aprobar', queue.decisions],
              ].map(([label, items]) => (
                <div key={String(label)}>
                  <p className="text-[12px] font-medium text-petrol-blue/55">{label as string}</p>
                  {(items as MorningQueue['stalled']).length === 0 ? (
                    <p className="mt-1 text-xs text-petrol-blue/40">Nada en esta lista.</p>
                  ) : (
                    (items as MorningQueue['stalled']).map(item => (
                      <p key={item.id} className="mt-2 text-sm text-petrol-blue">
                        {item.title}
                        <span className="block text-xs text-petrol-blue/50">{item.detail}</span>
                      </p>
                    ))
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
