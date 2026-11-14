'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Search,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  Target,
  FileSpreadsheet,
  Eye,
  Edit,
  Copy,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Grid
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { realizedSavings, savingsByCurrency } from '@/lib/procurement-flow'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { useToast } from '@/components/ui/toast'
import type { SourcingPlan, SourcingPlanFilters, Quarter, InitiativeType, PlanStatus } from '@/types'

// Labels y colores
const quarterLabels: Record<Quarter, string> = {
  Q1: 'Q1 (Ene-Mar)',
  Q2: 'Q2 (Abr-Jun)',
  Q3: 'Q3 (Jul-Sep)',
  Q4: 'Q4 (Oct-Dic)'
}

const typeLabels: Record<InitiativeType, string> = {
  licitacion: 'Licitación',
  project: 'Proyecto'
}

const statusColors: Record<PlanStatus, string> = {
  planned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800'
}

const statusLabels: Record<PlanStatus, string> = {
  planned: 'Planificado',
  in_progress: 'En Progreso',
  completed: 'Completado',
  cancelled: 'Cancelado'
}

const statusIcons: Record<PlanStatus, any> = {
  planned: Clock,
  in_progress: Target,
  completed: CheckCircle2,
  cancelled: XCircle
}

export default function SourcingPlanPage() {
  const router = useRouter()
  const { addToast } = useToast()

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [plans, setPlans] = useState<SourcingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [filters, setFilters] = useState<SourcingPlanFilters>({
    plan_year: new Date().getFullYear()
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [groupFilter, setGroupFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  // Estadísticas
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    loadSourcingPlans()
  }, [filters])

  const loadSourcingPlans = async () => {
    try {
      setLoading(true)
      setError(null)

      // Modo funcional con Supabase
      const supabase = supabaseBrowser()

      // 1) Asegurar que la sesión esté hidratada
      let { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        await new Promise(r => setTimeout(r, 150))
        ;({ data: { session } } = await supabase.auth.getSession())
      }
      const authUser = session?.user
      if (!authUser) throw new Error('Usuario no autenticado')

      // 2) Leer perfil protegido por RLS (id = auth.uid())
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, role, company_id')
        .eq('id', authUser.id)
        .single()

      if (profileError || !profile) throw new Error('Perfil no encontrado')

      setUser({
        name: profile.full_name || authUser.email,
        email: authUser.email,
        role: profile.role
      })

      if (profile.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .single()

        if (companyData) setCompany(companyData)

        const { data: groupRows } = await supabase
          .from('si_spend_groups')
          .select('id, name')
          .eq('company_id', profile.company_id)
          .order('name')
        setGroups(groupRows || [])

        // Cargar planes con filtros
        let query = supabase
          .from('sourcing_plans')
          .select(`
            *,
            department:departments(id, name),
            responsible_user:profiles!responsible_user_id(id, full_name, email)
          `)
          .eq('company_id', profile.company_id)

        if (filters.plan_year) query = query.eq('plan_year', filters.plan_year)
        if (filters.quarter) query = query.eq('quarter', filters.quarter)
        if (filters.initiative_type) query = query.eq('initiative_type', filters.initiative_type)
        if (filters.status) query = query.eq('status', filters.status)
        if (filters.is_spot !== undefined) query = query.eq('is_spot', filters.is_spot)

        query = query.order('plan_year', { ascending: false }).order('quarter', { ascending: true })

        const { data: plansData, error: plansError } = await query
        if (plansError) throw plansError

        // Para chips y agregados, traer enlaces y datos de licitaciones
        const planIds = (plansData || []).map(p => p.id)
        let countsByPlan: Record<string, number> = {}
        let licBaselineByPlan: Record<string, number> = {}
        let licSavingsByPlan: Record<string, number> = {}
        let awardedSavingsByPlan: Record<string, number> = {}
        let planLinksData: any[] = []
        if (planIds.length) {
          const { data } = await supabase
            .from('sourcing_plan_licitaciones')
            .select(`
              plan_id,
              licitacion:licitaciones(
                baseline_amount,
                baseline_currency,
                savings_amount,
                status
              )
            `)
            .in('plan_id', planIds)
          planLinksData = data || []
          const currencyByPlan = Object.fromEntries(
            (plansData || []).map(plan => [plan.id, String(plan.currency || 'CLP').toUpperCase()])
          )
          planLinksData.forEach(link => {
            const pid = link.plan_id
            countsByPlan[pid] = (countsByPlan[pid] || 0) + 1
            const planCurrency = currencyByPlan[pid] || 'CLP'
            const licCurrency = String(link.licitacion?.baseline_currency || planCurrency).toUpperCase()
            if (licCurrency !== planCurrency) return
            const b = link.licitacion?.baseline_amount || 0
            const s = link.licitacion?.savings_amount || 0
            licBaselineByPlan[pid] = (licBaselineByPlan[pid] || 0) + b
            licSavingsByPlan[pid] = (licSavingsByPlan[pid] || 0) + s
            if (link.licitacion?.status === 'awarded' && link.licitacion?.savings_amount != null) {
              awardedSavingsByPlan[pid] = (awardedSavingsByPlan[pid] ?? 0) + Number(link.licitacion.savings_amount)
            }
          })
        }

        setPlans((plansData || []).map(p => ({
          ...p,
          licitaciones_count: countsByPlan[p.id] || 0,
          lic_baseline_sum: licBaselineByPlan[p.id] || 0,
          lic_savings_sum: licSavingsByPlan[p.id] || 0,
          estimated_award_savings: Object.prototype.hasOwnProperty.call(awardedSavingsByPlan, p.id) ? awardedSavingsByPlan[p.id] : null
        })))

        // Calcular estadísticas incluyendo aportes de licitaciones
        const moneyLinks = planLinksData.map(link => ({
          plan_id: link.plan_id,
          savings_amount: link.licitacion?.savings_amount ?? null,
          currency: link.licitacion?.baseline_currency ?? null,
          awarded: link.licitacion?.status === 'awarded',
        }))
        calculateStats(plansData || [], licBaselineByPlan, licSavingsByPlan, moneyLinks)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el plan')
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo cargar el Sourcing Plan'
      })
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (
    plansData: SourcingPlan[],
    licBaselineByPlan: Record<string, number>,
    licSavingsByPlan: Record<string, number>,
    moneyLinks: { plan_id: string; savings_amount: number | null; currency: string | null }[]
  ) => {
    const planned = plansData.filter(p => p.status === 'planned' && !p.is_spot).length
    const inProgress = plansData.filter(p => p.status === 'in_progress').length
    const completed = plansData.filter(p => p.status === 'completed').length
    const spot = plansData.filter(p => p.is_spot).length

    const totalEstimated = plansData.reduce((sum, p) => {
      const licBaseline = licBaselineByPlan[p.id] || 0
      return sum + (p.estimated_spend || 0) + licBaseline
    }, 0)
    const totalActual = plansData.reduce((sum, p) => sum + (p.actual_spend || 0), 0)
    const totalProjectedSavings = plansData.reduce((sum, p) => sum + (p.projected_savings_amount || 0), 0)
    const totalActualSavings = plansData.reduce((sum, plan) => {
      const licSavings = licSavingsByPlan[plan.id] || 0
      return sum + realizedSavings(plan.actual_savings_amount, licSavings)
    }, 0)

    const completionRate = planned > 0 ? (completed / planned) * 100 : 0
    const achievementRate = totalProjectedSavings > 0 ? (totalActualSavings / totalProjectedSavings) * 100 : 0
    const byCurrency = savingsByCurrency(plansData, moneyLinks)

    setStats({
      total_planned: planned,
      total_in_progress: inProgress,
      total_completed: completed,
      total_spot: spot,
      total_estimated_spend: totalEstimated,
      total_actual_spend: totalActual,
      total_projected_savings: totalProjectedSavings,
      total_actual_savings: totalActualSavings,
      completion_rate: completionRate,
      savings_achievement_rate: achievementRate,
      savings_by_currency: byCurrency,
    })
  }

  const filteredPlans = plans.filter(plan => {
    if (groupFilter === 'none' && plan.group_id) return false
    if (groupFilter !== 'all' && groupFilter !== 'none' && plan.group_id !== groupFilter) return false
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      plan.title.toLowerCase().includes(query) ||
      plan.description?.toLowerCase().includes(query) ||
      plan.category?.toLowerCase().includes(query)
    )
  })

  const getAchievementColor = (actual?: number, projected?: number) => {
    if (!actual || !projected) return 'text-gray-500'
    const rate = (actual / projected) * 100
    if (rate >= 100) return 'text-green-600'
    if (rate >= 80) return 'text-yellow-600'
    return 'text-red-600'
  }

  const handleDuplicateYear = async () => {
    // Función para duplicar el plan del año anterior
    addToast({
      type: 'info',
      title: 'Próximamente',
      message: 'Función de duplicación en desarrollo'
    })
  }

  const handleExportPlan = () => {
    try {
      // Preparar datos para CSV
      const csvHeaders = [
        'Año',
        'Trimestre',
        'Título',
        'Descripción',
        'Categoría',
        'Tipo',
        'Estado',
        'Spot',
        'Spend Estimado',
        'Spend Real',
        'Moneda',
        'Ahorro Proyectado %',
        'Ahorro Proyectado Monto',
        'Ahorro comprometido %',
        'Ahorro comprometido monto',
        'Cumplimiento %',
        'Notas'
      ].join(',')

      const csvRows = filteredPlans.map(plan => {
        const actual = realizedSavings(plan.actual_savings_amount, plan.lic_savings_sum)
        const achievementRate = plan.projected_savings_amount
          ? ((actual / plan.projected_savings_amount) * 100).toFixed(1)
          : ''

        return [
          plan.plan_year,
          plan.quarter,
          `"${plan.title.replace(/"/g, '""')}"`,
          `"${(plan.description || '').replace(/"/g, '""')}"`,
          `"${(plan.category || '').replace(/"/g, '""')}"`,
          typeLabels[plan.initiative_type],
          statusLabels[plan.status],
          plan.is_spot ? 'Sí' : 'No',
          plan.estimated_spend || '',
          plan.actual_spend || '',
          plan.currency,
          plan.projected_savings_percentage || '',
          plan.projected_savings_amount || '',
          plan.actual_savings_percentage || '',
          actual || '',
          achievementRate,
          `"${(plan.notes || '').replace(/"/g, '""')}"`
        ].join(',')
      }).join('\n')

      const csvContent = `\uFEFF${csvHeaders}\n${csvRows}`

      // Crear blob y descargar
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)

      const fileName = `sourcing-plan-${filters.plan_year || 'all'}-${new Date().toISOString().split('T')[0]}.csv`
      link.setAttribute('href', url)
      link.setAttribute('download', fileName)
      link.style.visibility = 'hidden'

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      addToast({
        type: 'success',
        title: 'Exportación exitosa',
        message: `Se exportaron ${filteredPlans.length} iniciativas`
      })
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error al exportar',
        message: 'No se pudo generar el archivo CSV'
      })
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
          title="Error al cargar Sourcing Plan"
          message={error}
          onRetry={loadSourcingPlans}
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Sourcing Plan</h1>
            <p className="text-xs text-muted-foreground">Iniciativas del año</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={handleDuplicateYear}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Año anterior
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportPlan}>
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
              Exportar
            </Button>
            <Button size="sm" variant="outline" onClick={() => router.push('/sourcing-plan/kraljic')}>
              <Grid className="mr-1.5 h-3.5 w-3.5" />
              Kraljic
            </Button>
            <Button size="sm" onClick={() => router.push('/sourcing-plan/new')}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nueva
            </Button>
          </div>
        </div>

        {/* Estadísticas Resumen */}
        {stats && (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-3">
                <p className="text-[11px] text-muted-foreground">Planificado</p>
                <p className="text-lg font-semibold leading-tight">{stats.total_planned}</p>
                <p className="text-[11px] text-muted-foreground">
                  {stats.total_completed} listas · {stats.total_in_progress} en curso
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <p className="text-[11px] text-muted-foreground">Ahorro proyectado</p>
                <div className="text-sm font-semibold leading-tight text-green-700">
                  {(stats.savings_by_currency || []).length === 0
                    ? formatCurrency(0, 'CLP')
                    : stats.savings_by_currency.map((row: { currency: string; projected: number }) => (
                        <div key={row.currency}>{formatCurrency(row.projected, row.currency)}</div>
                      ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <p className="text-[11px] text-muted-foreground">Ahorro comprometido</p>
                <div className="text-sm font-semibold leading-tight">
                  {(stats.savings_by_currency || []).length === 0
                    ? formatCurrency(0, 'CLP')
                    : stats.savings_by_currency.map((row: { currency: string; actual: number; rate: number; projected: number }) => (
                        <div key={row.currency}>
                          {formatCurrency(row.actual, row.currency)}
                          <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                            {row.projected > 0 ? `${row.rate.toFixed(0)}%` : ''}
                          </span>
                        </div>
                      ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <p className="text-[11px] text-muted-foreground">Spot</p>
                <p className="text-lg font-semibold leading-tight">{stats.total_spot}</p>
                <p className="text-[11px] text-muted-foreground">Fuera del plan</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtros y Búsqueda */}
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por título, descripción o categoría..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={groupFilter}
                  onChange={event => setGroupFilter(event.target.value)}
                >
                  <option value="all">Todos los grupos</option>
                  <option value="none">Sin grupo</option>
                  {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Filtros
                  {showFilters ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
                </Button>
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-4 border-t">
                  <Select
                    value={filters.plan_year?.toString() || 'all'}
                    onValueChange={(value) =>
                      setFilters(prev => ({
                        ...prev,
                        plan_year: value === 'all' ? undefined : parseInt(value, 10)
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Año" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={filters.quarter || 'all'}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, quarter: value === 'all' ? undefined : value as Quarter }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Trimestre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="Q1">Q1</SelectItem>
                      <SelectItem value="Q2">Q2</SelectItem>
                      <SelectItem value="Q3">Q3</SelectItem>
                      <SelectItem value="Q4">Q4</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={filters.initiative_type || 'all'}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, initiative_type: value === 'all' ? undefined : value as InitiativeType }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="licitacion">Licitación</SelectItem>
                      <SelectItem value="project">Proyecto</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={filters.status || 'all'}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === 'all' ? undefined : value as PlanStatus }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="planned">Planificado</SelectItem>
                      <SelectItem value="in_progress">En Progreso</SelectItem>
                      <SelectItem value="completed">Completado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={filters.is_spot === undefined ? 'all' : filters.is_spot.toString()}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, is_spot: value === 'all' ? undefined : value === 'true' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="false">Planificados</SelectItem>
                      <SelectItem value="true">Spot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabla de Iniciativas */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-[12px] leading-tight">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="w-[22%] p-2 text-left font-medium">Iniciativa</th>
                    <th className="w-[8%] p-2 text-left font-medium">Año</th>
                    <th className="w-[9%] p-2 text-left font-medium">Tipo</th>
                    <th className="w-[12%] p-2 text-left font-medium">Estado</th>
                    <th className="w-[6%] p-2 text-center font-medium">Lic.</th>
                    <th className="w-[12%] p-2 text-right font-medium">Spend</th>
                    <th className="w-[11%] p-2 text-right font-medium">Ahorro</th>
                    <th className="w-[11%] p-2 text-right font-medium">Real</th>
                    <th className="w-[5%] p-2 text-center font-medium">%</th>
                    <th className="w-[4%] p-2 text-center font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {filteredPlans.map((plan) => {
                    const estimatedAward = (plan as SourcingPlan & { estimated_award_savings?: number | null }).estimated_award_savings
                    const actualSavings = estimatedAward == null
                      ? realizedSavings(plan.actual_savings_amount, plan.lic_savings_sum)
                      : estimatedAward
                    const achievementRate = plan.projected_savings_amount
                      ? (actualSavings / plan.projected_savings_amount) * 100
                      : null

                    return (
                      <tr key={plan.id} className="border-b hover:bg-muted/30 transition-colors">
                        {/* Iniciativa */}
                        <td className="p-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="truncate font-medium">{plan.title}</span>
                              {plan.is_spot && (
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                  SPOT
                                </Badge>
                              )}
                            </div>
                            {(plan.category || plan.group_id) && (
                              <div className="truncate text-[11px] text-muted-foreground">
                                {[groups.find(group => group.id === plan.group_id)?.name, plan.category].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Año/Trimestre */}
                        <td className="whitespace-nowrap p-2">
                          {plan.plan_year} {plan.quarter}
                        </td>

                        <td className="p-2">
                          {typeLabels[plan.initiative_type]}
                        </td>

                        <td className="p-2">
                          <Badge className={`${statusColors[plan.status]} px-1.5 py-0 text-[10px]`}>
                            {statusLabels[plan.status]}
                          </Badge>
                        </td>

                        <td className="p-2 text-center tabular-nums">
                          {(plan as any).licitaciones_count || 0}
                        </td>

                        <td className="whitespace-nowrap p-2 text-right tabular-nums">
                          {formatCurrency(plan.estimated_spend, plan.currency)}
                        </td>

                        <td className="whitespace-nowrap p-2 text-right tabular-nums">
                          {plan.projected_savings_amount ? (
                            <div>
                              <div className="font-medium text-green-600">
                                {formatCurrency(plan.projected_savings_amount, plan.currency)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ({plan.projected_savings_percentage?.toFixed(1)}%)
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>

                        {/* Ahorro Real */}
                        <td className="whitespace-nowrap p-2 text-right tabular-nums">
                          {estimatedAward == null && !actualSavings ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            <div>
                              <div className="font-medium text-emerald-600">
                                {formatCurrency(actualSavings, plan.currency)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {estimatedAward == null ? 'sin adjudicación' : 'estimado'}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Cumplimiento */}
                        <td className="p-2 text-center tabular-nums">
                          {achievementRate !== null ? (
                            <div className={`font-semibold ${getAchievementColor(actualSavings, plan.projected_savings_amount)}`}>
                              {achievementRate.toFixed(0)}%
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="p-1">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/sourcing-plan/${plan.id}`)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/sourcing-plan/${plan.id}/edit`)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Empty State */}
        {filteredPlans.length === 0 && plans.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay iniciativas planificadas</h3>
              <p className="text-muted-foreground text-center mb-4">
                Comienza creando tu plan anual de Strategic Sourcing
              </p>
              <Button onClick={() => router.push('/sourcing-plan/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Crear Primera Iniciativa
              </Button>
            </CardContent>
          </Card>
        )}

        {/* No Results */}
        {filteredPlans.length === 0 && plans.length > 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No se encontraron iniciativas</h3>
              <p className="text-muted-foreground text-center mb-4">
                Intenta con otros términos de búsqueda o filtros
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}

