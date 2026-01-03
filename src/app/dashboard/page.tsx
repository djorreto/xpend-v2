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

interface DashboardMetrics {
  totalLicitaciones: number
  activeLicitaciones: number
  totalSpend: number
  monthlySpend: number
  spendByCategory: Array<{
    category: string
    amount: number
    percentage: number
  }>
  sourcingPlan?: {
    totalPlanned: number
    inProgress: number
    completed: number
    totalProjectedSavings: number
    totalActualSavings: number
    achievementRate: number
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = supabaseBrowser()
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    loadDashboardData()
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
        ['published', 'in_progress', 'evaluation'].includes(l.status)
      ).length || 0

      const { data: spendData, error: spendError } = await supabase
        .from('spend_data')
        .select('amount, category, date')
        .eq('company_id', companyId)
      if (spendError) throw spendError

      const totalSpend = spendData?.reduce((sum, i) => sum + Number(i.amount), 0) || 0
      const currentMonth = new Date().toISOString().slice(0, 7)
      const monthlySpend = spendData?.filter(i => i.date.startsWith(currentMonth))
        .reduce((sum, i) => sum + Number(i.amount), 0) || 0

      const categoryTotals = spendData?.reduce((acc, i) => {
        acc[i.category] = (acc[i.category] || 0) + Number(i.amount)
        return acc
      }, {} as Record<string, number>) || {}

      const spendByCategory = Object.entries(categoryTotals)
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0
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
        const totalPlanned = sourcingPlans.filter(p => p.status === 'planned' && !p.is_spot).length
        const inProgress = sourcingPlans.filter(p => p.status === 'in_progress').length
        const completed = sourcingPlans.filter(p => p.status === 'completed').length
        const totalProjectedSavings = sourcingPlans.reduce((sum, p) => sum + (p.projected_savings_amount || 0), 0)
        const totalActualSavings = sourcingPlans.reduce((sum, p) => sum + (p.actual_savings_amount || 0), 0)
        const achievementRate = totalProjectedSavings > 0 ? (totalActualSavings / totalProjectedSavings) * 100 : 0

        sourcingPlanMetrics = {
          totalPlanned,
          inProgress,
          completed,
          totalProjectedSavings,
          totalActualSavings,
          achievementRate
        }
      }

      setMetrics({
        totalLicitaciones,
        activeLicitaciones,
        totalSpend,
        monthlySpend,
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
      <div className="space-y-6" suppressHydrationWarning>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Resumen general de tu plataforma de Strategic Sourcing
          </p>
        </div>

        {/* Cards principales */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Licitaciones Activas - Mint */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader
              className="flex justify-between pb-2"
              style={{ background: 'linear-gradient(to right, rgba(59, 231, 174, 0.15), rgba(59, 231, 174, 0.25))' }}
            >
              <CardTitle className="text-sm font-semibold" style={{ color: '#2D3E3D' }}>Licitaciones Activas</CardTitle>
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#3BE7AE' }}>
                <Gavel className="h-4 w-4" style={{ color: '#2D3E3D' }} />
              </div>
            </CardHeader>
            <CardContent className="pt-4" suppressHydrationWarning>
              <div className="text-2xl font-bold" style={{ color: '#3BE7AE' }}>{metrics.activeLicitaciones}</div>
              <p className="text-xs text-slate-500">
                de {metrics.totalLicitaciones} licitaciones totales
              </p>
            </CardContent>
          </Card>

          {/* Spend Total - Petrol Blue */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader
              className="flex justify-between pb-2"
              style={{ background: 'linear-gradient(to right, rgba(45, 62, 61, 0.1), rgba(45, 62, 61, 0.2))' }}
            >
              <CardTitle className="text-sm font-semibold" style={{ color: '#2D3E3D' }}>Spend Total</CardTitle>
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#2D3E3D' }}>
                <DollarSign className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent className="pt-4" suppressHydrationWarning>
              <div className="text-2xl font-bold" style={{ color: '#2D3E3D' }}>{formatCurrency(metrics.totalSpend)}</div>
              <p className="text-xs text-slate-500">
                {formatCurrency(metrics.monthlySpend)} este mes
              </p>
            </CardContent>
          </Card>

        </div>

        {/* Sourcing Plan del Año */}
        {metrics.sourcingPlan && (
          <Card className="border-slate-200 shadow-md">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-purple-600 shadow-sm">
                    <Target className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Sourcing Plan {new Date().getFullYear()}</CardTitle>
                    <CardDescription>Cumplimiento del plan anual de Strategic Sourcing</CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => router.push('/sourcing-plan')}
                  className="flex items-center gap-2"
                >
                  Ver Plan Completo
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Iniciativas Planificadas */}
                <div className="flex flex-col items-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">{metrics.sourcingPlan.totalPlanned}</div>
                  <p className="text-sm text-slate-600 mt-1">Planificadas</p>
                </div>

                {/* En Progreso */}
                <div className="flex flex-col items-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-3xl font-bold text-yellow-600">{metrics.sourcingPlan.inProgress}</div>
                  <p className="text-sm text-slate-600 mt-1">En Progreso</p>
                </div>

                {/* Completadas */}
                <div className="flex flex-col items-center p-4 bg-green-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600 flex items-center gap-2">
                    {metrics.sourcingPlan.completed}
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <p className="text-sm text-slate-600 mt-1">Completadas</p>
                </div>

                {/* Ahorro Proyectado */}
                <div className="flex flex-col items-center p-4 bg-emerald-50 rounded-lg">
                  <div className="text-xl font-bold text-emerald-600">
                    {formatCurrency(metrics.sourcingPlan.totalProjectedSavings)}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">Ahorro Proyectado</p>
                </div>

                {/* Ahorro Real */}
                <div className="flex flex-col items-center p-4 bg-teal-50 rounded-lg border-2 border-teal-200">
                  <div className="text-xl font-bold text-teal-600">
                    {formatCurrency(metrics.sourcingPlan.totalActualSavings)}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">Ahorro Real</p>
                  <div className={`text-xs font-semibold mt-2 px-2 py-1 rounded-full ${
                    metrics.sourcingPlan.achievementRate >= 100 ? 'bg-green-200 text-green-800' :
                    metrics.sourcingPlan.achievementRate >= 80 ? 'bg-yellow-200 text-yellow-800' :
                    'bg-red-200 text-red-800'
                  }`}>
                    {metrics.sourcingPlan.achievementRate.toFixed(1)}% cumplimiento
                  </div>
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
            description="Distribución de gastos por categoría en el último período"
          />

          {/* Gráfico de distribución de gastos */}
          <SpendDistributionChart
            data={metrics.spendByCategory}
            title="Distribución de Gastos"
            description="Porcentaje de gastos por categoría"
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
