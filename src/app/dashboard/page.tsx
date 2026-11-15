'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Gavel, DollarSign, Target, CheckCircle2, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { useToast } from '@/components/ui/toast'
import { SpendByCategoryChart, SpendDistributionChart, MonthlyTrendChart } from '@/components/ui/charts'
import { fetchUnifiedSpendForCompany, describeSpendSource, totalsByCurrency, primaryCurrency, type SpendSourceInfo, type MoneyTotal } from '@/lib/spend-sources'
import {
  SAVINGS_LABELS,
  loadMorningQueue,
  loadPlanSavingsLinks,
  realizedSavingsLabel,
  savingsByCurrency,
  validatedSavingsLabel,
  type MorningQueue,
  type CurrencySavings,
} from '@/lib/procurement-flow'

interface DashboardMetrics {
  totalLicitaciones: number
  activeLicitaciones: number
  totalSpend: MoneyTotal[]
  monthlySpend: MoneyTotal[]
  spendCurrency: string
  spendByCategory: Array<{
    category: string
    amount: number
    percentage: number
  }>
  sourcingPlan?: {
    totalPlanned: number
    inProgress: number
    completed: number
    byCurrency: CurrencySavings[]
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = supabaseBrowser()
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [queue, setQueue] = useState<MorningQueue | null>(null)
  const [spendSource, setSpendSource] = useState<SpendSourceInfo | null>(null)
  const [healthIssues, setHealthIssues] = useState<{ level: string; title: string; detail: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    loadDashboardData()
    fetch('/api/health/integrations')
      .then(response => response.json())
      .then(body => setHealthIssues((body.issues || []).filter((issue: { level?: string }) => issue.level === 'blocker')))
      .catch(() => setHealthIssues([]))
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Use real data from Supabase (asegurar sesión hidratada)
      let { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        await new Promise(r => setTimeout(r, 150))
        ;({ data: { session } } = await supabase.auth.getSession())
      }
      const authUser = session?.user
      if (!authUser) throw new Error('Usuario no autenticado')

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profileError || !profile) throw new Error('Perfil no encontrado')

      setUser({
        name: profile.full_name || authUser.email,
        email: authUser.email,
        role: profile.role
      })

      // Si es usuario demo sin empresa, no hay datos que cargar: mostrar error
      if (profile.role === 'demo' && !profile.company_id) {
        throw new Error('Perfil demo sin empresa asociada: no hay datos para mostrar')
      }

      if (profile.company_id) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .single()

        if (!companyError && companyData) setCompany(companyData)
      }

      await loadMetrics(profile.company_id)
      if (profile.company_id) {
        const [nextQueue, source] = await Promise.all([
          loadMorningQueue(supabase, profile.company_id),
          describeSpendSource(supabase, profile.company_id),
        ])
        setQueue(nextQueue)
        setSpendSource(source)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudieron cargar los datos del dashboard'
      })
    } finally {
      setLoading(false)
    }
  }

  const loadMetrics = async (companyId: string | null) => {
    if (!companyId) return

    try {
      const { data: licitaciones, error: licitacionesError } = await supabase
        .from('licitaciones')
        .select('id, status')
        .eq('company_id', companyId)
      if (licitacionesError) throw licitacionesError

      const totalLicitaciones = licitaciones?.length || 0
      const activeLicitaciones = licitaciones?.filter(l =>
        ['bases_review', 'published', 'evaluation'].includes(l.status)
      ).length || 0

      const spendRows = await fetchUnifiedSpendForCompany(supabase, companyId)

      const totalSpend = totalsByCurrency(spendRows)
      const currentMonth = new Date().toISOString().slice(0, 7)
      const monthlySpend = totalsByCurrency(spendRows.filter(i => i.date.startsWith(currentMonth)))
      const spendCurrency = primaryCurrency(spendRows)
      const chartRows = spendRows.filter(row => row.currency === spendCurrency)
      const chartTotal = chartRows.reduce((sum, row) => sum + Number(row.amount), 0)

      const categoryTotals = chartRows.reduce((acc, i) => {
        acc[i.category] = (acc[i.category] || 0) + Number(i.amount)
        return acc
      }, {} as Record<string, number>)

      const spendByCategory = Object.entries(categoryTotals)
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: chartTotal > 0 ? Math.round((amount / chartTotal) * 100) : 0
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)

      // Sourcing Plan metrics (current year)
      const currentYear = new Date().getFullYear()
      const { data: sourcingPlans, error: sourcingPlanError } = await supabase
        .from('sourcing_plans')
        .select('*')
        .eq('company_id', companyId)
        .eq('plan_year', currentYear)

      let sourcingPlanMetrics
      if (!sourcingPlanError && sourcingPlans) {
        const planIds = sourcingPlans.map(plan => plan.id)
        const linkRows = await loadPlanSavingsLinks(supabase, planIds)
        const totalPlanned = sourcingPlans.filter(p => p.status === 'planned' && !p.is_spot).length
        const inProgress = sourcingPlans.filter(p => p.status === 'in_progress').length
        const completed = sourcingPlans.filter(p => p.status === 'completed').length

        sourcingPlanMetrics = {
          totalPlanned,
          inProgress,
          completed,
          byCurrency: savingsByCurrency(sourcingPlans, linkRows),
        }
      }

      setMetrics({
        totalLicitaciones,
        activeLicitaciones,
        totalSpend,
        monthlySpend,
        spendCurrency,
        spendByCategory,
        sourcingPlan: sourcingPlanMetrics
      })
    } catch (err) {
      throw err
    }
  }

  if (loading) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <LoadingSpinner />
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <ErrorMessage
          title="Error al cargar el dashboard"
          message={error}
          onRetry={loadDashboardData}
        />
      </MainLayout>
    )
  }

  if (!metrics) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <ErrorMessage
          title="Sin datos"
          message="No se encontraron datos para mostrar"
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-5" suppressHydrationWarning>
        <div>
          <h1>Dashboard</h1>
          <p className="mt-1 text-[13px] text-petrol-blue/55">
            {spendSource?.label || 'Resumen de tu plataforma de strategic sourcing'}
          </p>
        </div>

        {healthIssues.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Para que funcione</CardTitle>
              <CardDescription>Estas piezas hay que corregir antes de confiar en la operación.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {healthIssues.map(issue => (
                <div key={issue.title}>
                  <p className="text-sm font-medium text-petrol-blue">{issue.title}</p>
                  <p className="text-xs text-petrol-blue/60">{issue.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {queue && (
          <Card>
            <CardHeader>
              <CardTitle>Cola de hoy</CardTitle>
              <CardDescription>
                {queue.needsReview > 0
                  ? `${queue.needsReview} líneas de gasto siguen sin clasificar.`
                  : 'Decisiones, procesos detenidos e iniciativas abiertas, también de trimestres ya vencidos.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ['Para aprobar', queue.decisions],
                ['Detenidos', queue.stalled],
                ['Sin responsable', queue.withoutOwner],
                ['Sin proceso', queue.withoutProcess],
              ].map(([label, items]) => (
                <div key={String(label)} className="space-y-2">
                  <p className="text-[12px] font-medium tracking-wide text-petrol-blue/55">{label as string}</p>
                  {(items as MorningQueue['decisions']).length === 0 ? (
                    <p className="text-xs text-petrol-blue/40">Nada en esta lista.</p>
                  ) : (
                    (items as MorningQueue['decisions']).map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => router.push(item.href)}
                        className="block w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/70"
                      >
                        <p className="text-sm text-petrol-blue">{item.title}</p>
                        <p className="text-xs text-petrol-blue/50">{item.detail}</p>
                      </button>
                    ))
                  )}
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={() => router.push('/comite')}>Ver comité</Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:-translate-y-0.5 hover:bg-white/72">
            <CardContent className="p-5" suppressHydrationWarning>
              <div className="flex items-start justify-between">
                <p className="text-[12px] font-medium tracking-wide text-petrol-blue/55">Licitaciones activas</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-mint text-petrol-blue shadow-sm shadow-accent-mint/40">
                  <Gavel className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-4 text-[1.7rem] font-medium tracking-tight text-petrol-blue">{metrics.activeLicitaciones}</div>
              <p className="mt-1 text-xs text-petrol-blue/45">
                de {metrics.totalLicitaciones} licitaciones
              </p>
            </CardContent>
          </Card>

          <Card className="hover:-translate-y-0.5 hover:bg-white/72">
            <CardContent className="p-5" suppressHydrationWarning>
              <div className="flex items-start justify-between">
                <p className="text-[12px] font-medium tracking-wide text-petrol-blue/55">Spend total</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-petrol-blue text-white shadow-sm">
                  <DollarSign className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-4 space-y-1 text-[1.35rem] font-medium tracking-tight text-petrol-blue">
                {(metrics.totalSpend.length ? metrics.totalSpend : [{ currency: 'CLP', amount: 0 }]).map(item => (
                  <div key={item.currency}>{formatCurrency(item.amount, item.currency)}</div>
                ))}
              </div>
              <p className="mt-1 text-xs text-petrol-blue/45">
                Este mes:{' '}
                {(metrics.monthlySpend.length ? metrics.monthlySpend : [{ currency: metrics.spendCurrency, amount: 0 }])
                  .map(item => formatCurrency(item.amount, item.currency))
                  .join(' · ')}
              </p>
            </CardContent>
          </Card>

          {metrics.sourcingPlan && (
            <Card className="hover:-translate-y-0.5 hover:bg-white/72">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <p className="text-[12px] font-medium tracking-wide text-petrol-blue/55">{SAVINGS_LABELS.negotiatedVsTarget}</p>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-turquoise text-petrol-blue shadow-sm shadow-accent-turquoise/40">
                    <Target className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-4 space-y-1 text-[1.35rem] font-medium tracking-tight text-petrol-blue">
                  {metrics.sourcingPlan.byCurrency.length === 0 ? (
                    <div className="text-base font-normal text-petrol-blue/55">{SAVINGS_LABELS.noInfo}</div>
                  ) : (
                    metrics.sourcingPlan.byCurrency.map(row => (
                      <div key={row.currency}>
                        {row.negotiatedVsTarget != null
                          ? `${row.negotiatedVsTarget.toFixed(0)}%`
                          : <span className="text-base font-normal text-petrol-blue/55">{row.target == null ? 'Sin objetivo' : SAVINGS_LABELS.noInfo}</span>}
                        <span className="ml-2 text-xs font-normal text-petrol-blue/45">{row.currency}</span>
                      </div>
                    ))
                  )}
                </div>
                <p className="mt-1 text-xs text-petrol-blue/45">
                  Estimación de adjudicaciones de comité. {SAVINGS_LABELS.realized}: {realizedSavingsLabel()}.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {metrics.sourcingPlan && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-medium tracking-tight text-petrol-blue">
                  Sourcing Plan {new Date().getFullYear()}
                </CardTitle>
                <CardDescription>Cumplimiento del plan anual</CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push('/sourcing-plan')}
                className="flex items-center gap-2"
              >
                Ver plan
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                <div className="glass-chip flex flex-col items-center px-3 py-4">
                  <div className="text-2xl font-medium tracking-tight text-petrol-blue">{metrics.sourcingPlan.totalPlanned}</div>
                  <p className="mt-1 text-[11px] tracking-wide text-petrol-blue/50">Planificadas</p>
                </div>
                <div className="glass-chip flex flex-col items-center px-3 py-4">
                  <div className="text-2xl font-medium tracking-tight text-accent-turquoise">{metrics.sourcingPlan.inProgress}</div>
                  <p className="mt-1 text-[11px] tracking-wide text-petrol-blue/50">En progreso</p>
                </div>
                <div className="glass-chip flex flex-col items-center px-3 py-4">
                  <div className="flex items-center gap-1.5 text-2xl font-medium tracking-tight text-petrol-blue">
                    {metrics.sourcingPlan.completed}
                    <CheckCircle2 className="h-4 w-4 text-accent-mint" />
                  </div>
                  <p className="mt-1 text-[11px] tracking-wide text-petrol-blue/50">Completadas</p>
                </div>
                <div className="glass-chip flex flex-col items-center px-3 py-4">
                  <div className="space-y-1 text-center text-sm font-medium tracking-tight text-petrol-blue">
                    {metrics.sourcingPlan.byCurrency.filter(row => row.target != null).length === 0
                      ? SAVINGS_LABELS.noInfo
                      : metrics.sourcingPlan.byCurrency.filter(row => row.target != null).map(row => (
                          <div key={row.currency}>{formatCurrency(row.target as number, row.currency)}</div>
                        ))}
                  </div>
                  <p className="mt-1 text-[11px] tracking-wide text-petrol-blue/50">{SAVINGS_LABELS.target}</p>
                </div>
                <div className="glass-chip flex flex-col items-center border-dashed px-3 py-4">
                  <div className="space-y-1 text-center text-sm font-medium tracking-tight text-petrol-blue">
                    {metrics.sourcingPlan.byCurrency.filter(row => row.negotiated != null).length === 0
                      ? SAVINGS_LABELS.noInfo
                      : metrics.sourcingPlan.byCurrency.filter(row => row.negotiated != null).map(row => (
                          <div key={row.currency}>{formatCurrency(row.negotiated as number, row.currency)}</div>
                        ))}
                  </div>
                  <p className="mt-1 text-[11px] tracking-wide text-petrol-blue/50">{SAVINGS_LABELS.negotiated}</p>
                  <p className="text-[10px] text-petrol-blue/40">
                    {validatedSavingsLabel(metrics.sourcingPlan.byCurrency.some(row => row.negotiated != null))}
                  </p>
                </div>
                <div className="glass-chip flex flex-col items-center border-dashed px-3 py-4">
                  <div className="text-center text-sm font-medium tracking-tight text-petrol-blue/60">{realizedSavingsLabel()}</div>
                  <p className="mt-1 text-[11px] tracking-wide text-petrol-blue/50">{SAVINGS_LABELS.realized}</p>
                  <p className="text-[10px] text-petrol-blue/40">Aún no se mide</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de gastos por categoría */}
          <SpendByCategoryChart
            data={metrics.spendByCategory}
            title="Gastos por Categoría"
            description={`Solo ${metrics.spendCurrency}. Las otras monedas van en el total, aparte.`}
          />

          {/* Gráfico de distribución de gastos */}
          <SpendDistributionChart
            data={metrics.spendByCategory}
            title="Distribución de Gastos"
            description={`Porcentaje dentro de ${metrics.spendCurrency}`}
          />
        </div>

        {/* Gráficos de tendencias */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tendencia mensual */}
          <MonthlyTrendChart
            data={[]}
            title="Tendencia Mensual"
            description="Evolución de gastos y ahorros por mes"
          />
        </div>
      </div>
    </MainLayout>
  )
}
