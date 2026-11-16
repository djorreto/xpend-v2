'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'
import {
  SAVINGS_LABELS,
  loadMorningQueue,
  loadPlanSavingsLinks,
  realizedSavingsLabel,
  savingsByCurrency,
  validatedSavingsLabel,
  type CurrencySavings,
  type MorningQueue,
} from '@/lib/procurement-flow'
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
    const linkRows = await loadPlanSavingsLinks(supabase, planIds)
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
            <h1>Cierre mensual de gasto</h1>
            <p className="mt-1 max-w-2xl text-[13px] text-petrol-blue/55">
              {period}. Cierra el gasto del mes por moneda y prepara la reunión mensual. {source?.label}
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
            <CardHeader><CardTitle>{SAVINGS_LABELS.target}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1 text-2xl font-medium text-petrol-blue">
                {savings.filter(row => row.target != null).length === 0
                  ? <p className="text-base font-normal text-petrol-blue/55">{SAVINGS_LABELS.noInfo}</p>
                  : savings.filter(row => row.target != null).map(row => (
                      <p key={row.currency}>{formatCurrency(row.target as number, row.currency)}</p>
                    ))}
              </div>
              <p className="mt-1 text-xs text-petrol-blue/50">Meta del plan de este año, por moneda. No es un resultado.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{SAVINGS_LABELS.negotiated}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1 text-2xl font-medium text-petrol-blue">
                {savings.filter(row => row.negotiated != null).length === 0
                  ? <p className="text-base font-normal text-petrol-blue/55">{SAVINGS_LABELS.noInfo}</p>
                  : savings.filter(row => row.negotiated != null).map(row => (
                      <p key={row.currency}>{formatCurrency(row.negotiated as number, row.currency)}</p>
                    ))}
              </div>
              <p className="mt-1 text-xs text-petrol-blue/50">
                Línea base menos monto adjudicado por el comité, en la misma moneda. Un cero es un resultado de la adjudicación.
                {' '}Validado: {validatedSavingsLabel(savings.some(row => row.negotiated != null))}.
                {' '}Realizado: {realizedSavingsLabel()}.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Adjudicaciones</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-petrol-blue/70">
              {pending.length} {pending.length === 1 ? 'decisión pendiente' : 'decisiones pendientes'} · {awards.length} {awards.length === 1 ? 'expediente adjudicado' : 'expedientes adjudicados'}.
              {' '}Las decisiones del comité de adjudicación tienen su propia vista.
            </p>
            <Link href="/adjudicaciones" className="rounded-full border border-petrol-blue/15 bg-white/70 px-3 py-1.5 text-[12.5px] font-medium text-petrol-blue hover:bg-white">
              Ir a Adjudicaciones
            </Link>
          </CardContent>
        </Card>

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
