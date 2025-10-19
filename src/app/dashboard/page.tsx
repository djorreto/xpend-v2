'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  FolderOpen, 
  Gavel, 
  TrendingUp, 
  DollarSign,
  Calendar
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { useToast } from '@/components/ui/toast'
import { useVersion } from '@/contexts/version-context'
import { mockDashboardData, mockChartData } from '@/lib/mock-data'
import { 
  SpendByCategoryChart, 
  SpendDistributionChart, 
  MonthlyTrendChart, 
  ProjectEvolutionChart, 
  SavingsByProjectChart 
} from '@/components/ui/charts'

interface DashboardMetrics {
  totalProjects: number
  activeProjects: number
  totalLicitaciones: number
  activeLicitaciones: number
  totalSpend: number
  monthlySpend: number
  spendByCategory: Array<{
    category: string
    amount: number
    percentage: number
  }>
  recentProjects: Array<{
    id: string
    name: string
    status: string
    progress: number
  }>
  upcomingMilestones: Array<{
    id: string
    project: string
    milestone: string
    dueDate: string
  }>
}

export default function DashboardPage() {
  const supabase = supabaseBrowser()
  const { isMockup } = useVersion()
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    loadDashboardData()
  }, [isMockup])

  // Función para generar datos de ahorros basados en proyectos reales
  const generateSavingsData = (projects: any[]) => {
    return projects.map(project => {
      const budget = project.budget || 0
      const spent = project.spent || 0
      const savings = Math.max(0, budget - spent) // Ahorro = presupuesto - gastado
      
      return {
        project: project.name,
        ahorro: savings,
        presupuesto: budget
      }
    }).filter(item => item.presupuesto > 0) // Solo proyectos con presupuesto
  }

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Si Supabase no está configurado, usar modo mockup
      const isSupabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      if (isMockup || !isSupabaseConfigured) {
        // Use mock data
        setUser({
          name: 'Juan Pérez',
          email: 'juan.perez@empresa.com',
          role: 'admin'
        })
        setCompany({
          id: 'company-1',
          name: 'Perico los Palotes S.A.',
          industry: 'Tecnología'
        })
        
        // Transform mock data to match interface
        const mockMetrics: DashboardMetrics = {
          totalProjects: mockDashboardData.projects.total,
          activeProjects: mockDashboardData.projects.active,
          totalLicitaciones: mockDashboardData.licitaciones.total,
          activeLicitaciones: mockDashboardData.licitaciones.active,
          totalSpend: mockDashboardData.spend.total,
          monthlySpend: mockDashboardData.spend.thisMonth,
          spendByCategory: mockDashboardData.spend.byCategory,
          recentProjects: mockDashboardData.recentProjects.map(p => ({
            id: p.id,
            name: p.name,
            status: p.status,
            progress: p.progress
          })),
          upcomingMilestones: mockDashboardData.upcomingMilestones.map(m => ({
            id: m.id,
            project: m.projectName,
            milestone: m.milestone,
            dueDate: m.dueDate
          }))
        }
        setMetrics(mockMetrics)
        setLoading(false)
        return
      }

      // Use real data from Supabase
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
      if (userError || !authUser) throw new Error('Usuario no autenticado')

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
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, status')
        .eq('company_id', companyId)
      if (projectsError) throw projectsError

      const totalProjects = projects?.length || 0
      const activeProjects = projects?.filter(p => p.status === 'active').length || 0

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

      const { data: recentProjects, error: recentProjectsError } = await supabase
        .from('projects')
        .select('id, name, status')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(5)
      if (recentProjectsError) throw recentProjectsError

      const recentProjectsFormatted = recentProjects?.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        progress: Math.floor(Math.random() * 100)
      })) || []

      // ✅ CORREGIDO: Upcoming Milestones
      const { data: milestones, error: milestonesError } = await supabase
        .from('project_milestones')
        .select(`
          id,
          name,
          due_date,
          project:projects!inner(name)
        `)
        .eq('projects.company_id', companyId)
        .eq('completed', false)
        .gte('due_date', new Date().toISOString().split('T')[0])
        .order('due_date', { ascending: true })
        .limit(5)

      if (milestonesError) throw milestonesError

      const upcomingMilestones = (milestones ?? []).map((m: any) => ({
        id: m.id,
        project: m.project?.name ?? '',
        milestone: m.name,
        dueDate: m.due_date
      }))

      setMetrics({
        totalProjects,
        activeProjects,
        totalLicitaciones,
        activeLicitaciones,
        totalSpend,
        monthlySpend,
        spendByCategory,
        recentProjects: recentProjectsFormatted,
        upcomingMilestones
      })
    } catch (err) {
      throw err
    }
  }

  if (loading) {
    return (
      <MainLayout user={user} companyName={company?.name || 'SpendPlan.cl'}>
        <LoadingSpinner />
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout user={user} companyName={company?.name || 'SpendPlan.cl'}>
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
      <MainLayout user={user} companyName={company?.name || 'SpendPlan.cl'}>
        <ErrorMessage 
          title="Sin datos"
          message="No se encontraron datos para mostrar"
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name || 'SpendPlan.cl'}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Resumen general de tu plataforma de Strategic Sourcing
          </p>
        </div>

        {/* Cards principales */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Proyectos Activos - Turquoise */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader 
              className="flex justify-between pb-2"
              style={{ background: 'linear-gradient(to right, rgba(42, 212, 210, 0.15), rgba(42, 212, 210, 0.25))' }}
            >
              <CardTitle className="text-sm font-semibold" style={{ color: '#2D3E3D' }}>Proyectos Activos</CardTitle>
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#2AD4D2' }}>
                <FolderOpen className="h-4 w-4" style={{ color: '#2D3E3D' }} />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold" style={{ color: '#2AD4D2' }}>{metrics.activeProjects}</div>
              <p className="text-xs text-slate-500">
                de {metrics.totalProjects} proyectos totales
              </p>
            </CardContent>
          </Card>

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
            <CardContent className="pt-4">
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
            <CardContent className="pt-4">
              <div className="text-2xl font-bold" style={{ color: '#2D3E3D' }}>{formatCurrency(metrics.totalSpend)}</div>
              <p className="text-xs text-slate-500">
                {formatCurrency(metrics.monthlySpend)} este mes
              </p>
            </CardContent>
          </Card>

          {/* Eficiencia */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader 
              className="flex justify-between pb-2"
              style={{ background: 'linear-gradient(to right, rgba(45, 62, 61, 0.1), rgba(45, 62, 61, 0.2))' }}
            >
              <CardTitle className="text-sm font-semibold" style={{ color: '#2D3E3D' }}>Eficiencia</CardTitle>
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#2D3E3D' }}>
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold" style={{ color: '#2D3E3D' }}>
                {metrics.totalProjects > 0 ? Math.round((metrics.activeProjects / metrics.totalProjects) * 100) : 0}%
              </div>
              <p className="text-xs text-slate-500">Proyectos activos</p>
            </CardContent>
          </Card>
        </div>

        {/* Próximos Hitos */}
        <Card>
          <CardHeader>
            <CardTitle>Próximos Hitos</CardTitle>
            <CardDescription>Hitos importantes que se aproximan en los próximos días</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.upcomingMilestones.length > 0 ? (
                metrics.upcomingMilestones.map((milestone) => (
                  <div key={milestone.id} className="flex items-center space-x-4">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">{milestone.milestone}</p>
                      <p className="text-xs text-muted-foreground">{milestone.project}</p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(milestone.dueDate).toLocaleDateString('es-ES')}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay hitos próximos
                </p>
              )}
            </div>
          </CardContent>
        </Card>

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
            data={isMockup ? mockChartData.monthlyTrend : []}
            title="Tendencia Mensual"
            description="Evolución de gastos y ahorros por mes"
          />

          {/* Evolución de proyectos */}
          <ProjectEvolutionChart 
            data={isMockup ? mockChartData.projectEvolution : []}
            title="Evolución de Proyectos"
            description="Cantidad de proyectos por estado a lo largo del tiempo"
          />
        </div>

        {/* Gráfico de ahorros por proyecto */}
        <div className="grid grid-cols-1 gap-6">
          {(() => {
            const savingsData = isMockup 
              ? mockChartData.savingsByProject 
              : generateSavingsData(metrics.recentProjects).length > 0 
                ? generateSavingsData(metrics.recentProjects) 
                : mockChartData.savingsByProject
            
            return (
              <SavingsByProjectChart 
                data={savingsData}
                title="Ahorros por Proyecto"
                description="Comparación entre presupuesto asignado y ahorros generados"
              />
            )
          })()}
        </div>
      </div>
    </MainLayout>
  )
}