'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Edit,
  Calendar,
  TrendingUp,
  DollarSign,
  Target,
  FileText,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Link2
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import type { SourcingPlan, Quarter, InitiativeType, PlanStatus } from '@/types'

type SPLLink = {
  plan_id: string
  licitacion_id: string
  licitacion?: {
    id: string
    titulo: string | null
    estado: string | null
    baseline_amount?: number | null
    baseline_currency?: string | null
    awarded_amount?: number | null
    savings_amount?: number | null
  }
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

const typeLabels: Record<InitiativeType, string> = {
  licitacion: 'Licitación',
  project: 'Proyecto'
}

export default function SourcingPlanDetailPage() {
  const router = useRouter()
  const params = useParams()
  const planId = params.id as string

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [plan, setPlan] = useState<SourcingPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [linkedLicitaciones, setLinkedLicitaciones] = useState<SPLLink[]>([])
  const [invoicesTotal, setInvoicesTotal] = useState(0)

  useEffect(() => {
    loadPlan()
  }, [planId])

  const loadPlan = async () => {
    try {
      setLoading(true)
      setError(null)

      // Modo funcional con Supabase
      const supabase = supabaseBrowser()
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
        const { data: companyData } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .single()

        if (companyData) setCompany(companyData)

        // Cargar plan específico
        const { data: planData, error: planError } = await supabase
          .from('sourcing_plans')
          .select(`
            *,
            department:departments(id, name),
            responsible_user:profiles!responsible_user_id(id, full_name, email)
          `)
          .eq('id', planId)
          .eq('company_id', profile.company_id)
          .single()

        if (planError) throw planError
        if (!planData) throw new Error('Iniciativa no encontrada')

        setPlan(planData)

        // Cargar licitaciones vinculadas (tabla puente)
        const { data: linkData } = await supabase
          .from('sourcing_plan_licitaciones')
          .select(`
            plan_id,
            licitacion_id,
            licitacion:licitaciones(
              id,
              titulo,
              estado,
              baseline_amount,
              baseline_currency,
              awarded_amount,
              savings_amount
            )
          `)
          .eq('plan_id', planId)

        const normalizedLinks: SPLLink[] = (linkData || []).map(link => {
          const licInfo = Array.isArray(link.licitacion) ? link.licitacion[0] : link.licitacion
          return {
            plan_id: link.plan_id,
            licitacion_id: link.licitacion_id,
            licitacion: licInfo
          }
        })
        setLinkedLicitaciones(normalizedLinks)

        // Calcular total de facturas de las licitaciones vinculadas
        const licIds = (linkData || []).map(l => l.licitacion_id)
        if (licIds.length) {
          const { data: invData } = await supabase
            .from('service_invoices')
            .select('amount, licitacion_id')
            .in('licitacion_id', licIds)
          const totalInv = (invData || []).reduce((sum, inv) => sum + (inv.amount || 0), 0)
          setInvoicesTotal(totalInv)
        } else {
          setInvoicesTotal(0)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la iniciativa')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <LoadingSpinner />
      </MainLayout>
    )
  }

  if (error || !plan) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <ErrorMessage
          title="Error al cargar iniciativa"
          message={error || 'Iniciativa no encontrada'}
          onRetry={loadPlan}
        />
      </MainLayout>
    )
  }

  const StatusIcon = statusIcons[plan.status]

  // Agregados a partir de licitaciones vinculadas
  const linkedBaseline = linkedLicitaciones.reduce((sum, link) => {
    const val = link.licitacion?.baseline_amount || 0
    return sum + val
  }, 0)
  const linkedSavings = linkedLicitaciones.reduce((sum, link) => {
    const val = link.licitacion?.savings_amount || 0
    return sum + val
  }, 0)

  // Baseline total = propio + suma de licitaciones
  const totalBaseline = (plan.estimated_spend || 0) + linkedBaseline
  // Ahorro proyectado: mantenemos el proyectado propio
  const projected = plan.projected_savings_amount || 0
  // Ahorro real = ahorro propio + ahorro de licitaciones
  const actual = (plan.actual_savings_amount || 0) + linkedSavings
  const achievementRate = projected > 0 ? (actual / projected) * 100 : null

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/sourcing-plan')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold tracking-tight">{plan.title}</h1>
                {plan.is_spot && (
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                    SPOT
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {plan.plan_year} - {plan.quarter}
                </span>
                <span>•</span>
                <span>{typeLabels[plan.initiative_type]}</span>
                {plan.category && (
                  <>
                    <span>•</span>
                    <span>{plan.category}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <Button onClick={() => router.push(`/sourcing-plan/${plan.id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
        </div>

        {/* Estado */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <StatusIcon className="h-5 w-5" />
              <span className="text-sm font-medium">Estado:</span>
              <Badge className={statusColors[plan.status]}>
                {statusLabels[plan.status]}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Grid de Métricas */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Spend Estimado</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(plan.estimated_spend, plan.currency)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total con licitaciones: {formatCurrency(totalBaseline, plan.currency)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ahorro Proyectado</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              {plan.projected_savings_amount ? (
                <>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(plan.projected_savings_amount, plan.currency)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {plan.projected_savings_percentage?.toFixed(1)}% del spend
                  </p>
                </>
              ) : (
                <div className="text-2xl font-bold text-muted-foreground">-</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ahorro Real</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              {actual ? (
                <>
                  <div className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(actual, plan.currency)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {plan.actual_savings_percentage?.toFixed(1) ?? '-'}% del spend
                  </p>
                </>
              ) : (
                <div className="text-2xl font-bold text-muted-foreground">-</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cumplimiento</CardTitle>
              <Target className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              {achievementRate !== null ? (
                <>
                  <div className={`text-2xl font-bold ${
                    achievementRate >= 100 ? 'text-green-600' :
                    achievementRate >= 80 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {achievementRate.toFixed(0)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    vs proyectado
                  </p>
                </>
              ) : (
                <div className="text-2xl font-bold text-muted-foreground">-</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Gasto real (facturas) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gasto real (facturas)</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(invoicesTotal, plan.currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Suma de facturas asociadas a las licitaciones vinculadas
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Información General */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Información General
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {plan.description && (
                <div>
                  <div className="text-sm font-medium mb-1">Descripción</div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-1">Año del Plan</div>
                  <p className="text-sm text-muted-foreground">{plan.plan_year}</p>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Trimestre</div>
                  <p className="text-sm text-muted-foreground">{plan.quarter}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-1">Tipo</div>
                  <p className="text-sm text-muted-foreground">{typeLabels[plan.initiative_type]}</p>
                </div>
                {plan.category && (
                  <div>
                    <div className="text-sm font-medium mb-1">Categoría</div>
                    <p className="text-sm text-muted-foreground">{plan.category}</p>
                  </div>
                )}
              </div>

              {plan.notes && (
                <div>
                  <div className="text-sm font-medium mb-1">Notas</div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{plan.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Información Financiera */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Información Financiera
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-1">Spend Estimado</div>
                <p className="text-lg font-bold">{formatCurrency(plan.estimated_spend, plan.currency)}</p>
              </div>

              {plan.actual_spend && (
                <div>
                  <div className="text-sm font-medium mb-1">Spend Real</div>
                  <p className="text-lg font-bold">{formatCurrency(plan.actual_spend, plan.currency)}</p>
                </div>
              )}

              <div className="border-t pt-4">
                <div className="text-sm font-medium mb-3">Ahorros</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Proyectado</div>
                {(projected + linkedSavings) ? (
                      <>
                        <p className="font-bold text-green-600">
                      {formatCurrency(projected + linkedSavings, plan.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                      {plan.projected_savings_percentage?.toFixed(1) ?? '-'}%
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">-</p>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Real</div>
                {(plan.actual_savings_amount || linkedSavings) ? (
                      <>
                        <p className="font-bold text-emerald-600">
                      {formatCurrency((plan.actual_savings_amount || 0) + linkedSavings, plan.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                      {plan.actual_savings_percentage?.toFixed(1) ?? '-'}%
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">-</p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Moneda</div>
                <p className="text-sm text-muted-foreground">{plan.currency}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Licitaciones vinculadas (N:M) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Licitaciones asociadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {linkedLicitaciones.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin licitaciones vinculadas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-muted-foreground">
                    <tr>
                      <th className="text-left py-2">ID</th>
                      <th className="text-left py-2">Título</th>
                      <th className="text-left py-2">Estado</th>
                      <th className="text-right py-2">Baseline</th>
                      <th className="text-right py-2">Adjudicado</th>
                      <th className="text-right py-2">Ahorro</th>
                      <th className="text-center py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedLicitaciones.map(link => (
                      <tr key={link.licitacion_id} className="border-b last:border-0">
                        <td className="py-2 font-mono text-xs text-muted-foreground">{link.licitacion_id}</td>
                        <td className="py-2">{link.licitacion?.titulo || 'Sin título'}</td>
                        <td className="py-2">{link.licitacion?.estado || '-'}</td>
                        <td className="py-2 text-right">
                          {link.licitacion?.baseline_amount
                            ? formatCurrency(link.licitacion.baseline_amount, link.licitacion.baseline_currency || plan.currency)
                            : '-'}
                        </td>
                        <td className="py-2 text-right">
                          {link.licitacion?.awarded_amount
                            ? formatCurrency(link.licitacion.awarded_amount, link.licitacion.baseline_currency || plan.currency)
                            : '-'}
                        </td>
                        <td className="py-2 text-right">
                          {link.licitacion?.savings_amount
                            ? formatCurrency(link.licitacion.savings_amount, link.licitacion.baseline_currency || plan.currency)
                            : '-'}
                        </td>
                        <td className="py-2 text-center">
                          <Button size="sm" variant="outline" onClick={() => router.push(`/licitaciones/${link.licitacion_id}`)}>
                            Ver
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Información de Gestión
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {plan.created_at && (
                <div>
                  <div className="font-medium mb-1">Creado</div>
                  <p className="text-muted-foreground">{formatDate(plan.created_at)}</p>
                </div>
              )}
              {plan.updated_at && (
                <div>
                  <div className="font-medium mb-1">Última Actualización</div>
                  <p className="text-muted-foreground">{formatDate(plan.updated_at)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

