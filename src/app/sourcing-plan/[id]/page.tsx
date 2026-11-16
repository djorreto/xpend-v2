'use client'

import { useState, useEffect } from 'react'
import { can } from '@/lib/navigation'
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
  Plus,
  Scale,
} from 'lucide-react'
import {
  SAVINGS_LABELS,
  classifyLinkSavings,
  planSavings,
  realizedSavingsLabel,
  toSavingsLinks,
  validatedSavingsLabel,
  type SavingsLink,
} from '@/lib/procurement-flow'
import { FichaGate } from '@/components/ficha-gate'
import { DossierThread } from '@/components/dossier-thread'
import { InitiativeOwners } from '@/components/initiative-owners'
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
    name: string | null
    status: string | null
    baseline_amount?: number | null
    baseline_currency?: string | null
    awarded_amount?: number | null
    savings_amount?: number | null
    award?: { estimated_savings?: number | null; currency?: string | null } | { estimated_savings?: number | null; currency?: string | null }[] | null
  }
}

const licitacionStatusLabels: Record<string, string> = {
  planned: 'Planificado',
  bases_review: 'Revisión bases',
  published: 'Publicada',
  evaluation: 'Evaluación',
  awarded: 'Adjudicada',
  contract_signed: 'Contrato firmado',
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
  const [linkedDocs, setLinkedDocs] = useState<{ id: string; title: string; href: string; detail: string }[]>([])
  const [linkedLicitaciones, setLinkedLicitaciones] = useState<SPLLink[]>([])
  const [savingsLinks, setSavingsLinks] = useState<SavingsLink[]>([])

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
              name,
              status,
              baseline_amount,
              baseline_currency,
              awarded_amount,
              savings_amount,
              award:process_awards(estimated_savings, currency)
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
        setSavingsLinks(toSavingsLinks(linkData))

        const [{ data: rfxRows }, { data: salaRows }] = await Promise.all([
          supabase.from('rfx_projects').select('id, title, status, project_context').eq('company_id', profile.company_id),
          supabase.from('offer_events').select('id, title, status, modality').eq('sourcing_plan_id', planId),
        ])
        const docs = [
          ...((rfxRows || []).filter(row => row.project_context?.sourcing_plan_id === planId).map(row => ({
            id: row.id,
            title: row.title,
            href: `/rfx-maker/${row.id}`,
            detail: `Bases · ${row.status}`,
          }))),
          ...((salaRows || []).map(row => ({
            id: row.id,
            title: row.title,
            href: `/sala/${row.id}`,
            detail: `Sala · ${row.modality}`,
          }))),
          ...normalizedLinks.map(link => ({
            id: link.licitacion_id,
            title: link.licitacion?.name || 'Licitación',
            href: `/licitaciones/${link.licitacion_id}`,
            detail: `Proceso · ${link.licitacion?.status || 'sin estado'}`,
          })),
        ]
        setLinkedDocs(docs)
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

  // Baseline total = propio + suma de licitaciones
  const totalBaseline = (plan.estimated_spend || 0) + linkedBaseline
  // Ahorros: objetivo, negociado (solo adjudicación de comité) y declarado. El realizado no se mide todavía.
  const savings = planSavings(plan, savingsLinks)
  const hasNegotiated = savings.negotiated.length > 0

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

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.push(`/rfx-maker/new?planId=${plan.id}`)}>
              <FileText className="mr-2 h-4 w-4" />
              Bases con esta iniciativa
            </Button>
            {can(user?.role, 'createLicitacion') && (
              <Button variant="outline" onClick={() => router.push(`/licitaciones/new?planId=${plan.id}`)}>
                <Plus className="mr-2 h-4 w-4" />
                Licitación con esta iniciativa
              </Button>
            )}
            {can(user?.role, 'openSala') && (
              <Button variant="outline" onClick={() => router.push(`/sala/new?planId=${plan.id}`)}>
                <Scale className="mr-2 h-4 w-4" />
                Sala con esta iniciativa
              </Button>
            )}
            {can(user?.role, 'createInitiative') && (
              <Button onClick={() => router.push(`/sourcing-plan/${plan.id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
            )}
          </div>
        </div>

        <DossierThread match={{ companyId: company?.id || plan.company_id, sourcingPlanId: plan.id }} />
        <InitiativeOwners plan={plan as any} canManage={can(user?.role, 'manageTeams')} onChanged={loadPlan} />
        <FichaGate
          planId={plan.id}
          hasOwner={Boolean(plan.responsible_user_id)}
          links={linkedLicitaciones}
        />

        <Card>
          <CardHeader>
            <CardTitle>Flujo de esta iniciativa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
            {[
              ['1. Gasto base', formatCurrency(plan.estimated_spend || 0, plan.currency)],
              ['2. Bases', linkedDocs.filter(doc => doc.detail.startsWith('Bases')).length ? `${linkedDocs.filter(doc => doc.detail.startsWith('Bases')).length} proyecto(s) de bases` : 'Todavía no hay bases.'],
              ['3. Proceso', linkedLicitaciones.length ? `${linkedLicitaciones.length} licitación(es)` : 'Todavía no hay proceso.'],
              ['4. Sala', `${linkedDocs.filter(doc => doc.detail.startsWith('Sala')).length} sala(s)`],
            ].map(([title, detail]) => (
              <div key={title} className="glass-chip px-3 py-3">
                <p className="text-[12px] font-medium text-petrol-blue/75">{title}</p>
                <p className="mt-1 text-sm text-petrol-blue">{detail}</p>
              </div>
            ))}
            </div>
            {linkedDocs.map(doc => (
              <button key={doc.id} type="button" onClick={() => router.push(doc.href)} className="block text-left text-sm text-petrol-blue">
                {doc.title}
                <span className="ml-2 text-xs text-petrol-blue/75">{doc.detail}</span>
              </button>
            ))}
          </CardContent>
        </Card>

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
              <CardTitle className="text-sm font-medium">{SAVINGS_LABELS.target}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {savings.target != null ? (
                <>
                  <div className="text-2xl font-bold">
                    {formatCurrency(savings.target, plan.currency)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {plan.projected_savings_percentage?.toFixed(1)}% del spend. Meta, no resultado.
                  </p>
                </>
              ) : (
                <div className="text-lg font-medium text-muted-foreground">{SAVINGS_LABELS.noInfo}</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{SAVINGS_LABELS.negotiated}</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {hasNegotiated ? (
                <>
                  {savings.negotiated.map(row => (
                    <div key={row.currency} className="text-2xl font-bold">
                      {formatCurrency(row.amount, row.currency)}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Adjudicación de comité. Validado: {validatedSavingsLabel(true)}.
                  </p>
                </>
              ) : (
                <>
                  <div className="text-lg font-medium text-muted-foreground">
                    {savings.withoutComparableBase > 0 ? 'Sin base comparable' : SAVINGS_LABELS.noInfo}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {savings.withoutComparableBase > 0
                      ? 'La adjudicación no tiene línea base, moneda o alcance comparables.'
                      : 'Aparece cuando el comité adjudica con una línea base comparable.'}
                  </p>
                </>
              )}
              {savings.declared.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {SAVINGS_LABELS.declared}: {savings.declared.map(row => formatCurrency(row.amount, row.currency)).join(' · ')}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{SAVINGS_LABELS.realized}</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-medium text-muted-foreground">{realizedSavingsLabel()}</div>
              <p className="text-xs text-muted-foreground">
                Todavía no se mide. Se reconocerá solo con evidencia posterior a la adjudicación.
                {savings.negotiatedVsTarget != null && ` ${SAVINGS_LABELS.negotiatedVsTarget}: ${savings.negotiatedVsTarget.toFixed(0)}%.`}
              </p>
            </CardContent>
          </Card>
        </div>

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
                    <div className="text-xs text-muted-foreground mb-1">{SAVINGS_LABELS.target}</div>
                    {savings.target != null ? (
                      <>
                        <p className="font-bold">{formatCurrency(savings.target, plan.currency)}</p>
                        <p className="text-xs text-muted-foreground">
                          {plan.projected_savings_percentage?.toFixed(1) ?? '-'}%
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">{SAVINGS_LABELS.noInfo}</p>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">{SAVINGS_LABELS.negotiated}</div>
                    {hasNegotiated ? (
                      savings.negotiated.map(row => (
                        <p key={row.currency} className="font-bold">{formatCurrency(row.amount, row.currency)}</p>
                      ))
                    ) : (
                      <p className="text-muted-foreground">
                        {savings.withoutComparableBase > 0 ? 'Sin base comparable' : SAVINGS_LABELS.noInfo}
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">{SAVINGS_LABELS.declared}</div>
                    {savings.declared.length > 0 ? (
                      <>
                        {savings.declared.map(row => (
                          <p key={row.currency} className="font-bold">{formatCurrency(row.amount, row.currency)}</p>
                        ))}
                        {plan.actual_savings_percentage != null && (
                          <p className="text-xs text-muted-foreground">{plan.actual_savings_percentage.toFixed(1)}% declarado</p>
                        )}
                      </>
                    ) : (
                      <p className="text-muted-foreground">{SAVINGS_LABELS.noInfo}</p>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">{SAVINGS_LABELS.validated}</div>
                    <p className="text-muted-foreground">{validatedSavingsLabel(hasNegotiated)}</p>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">{SAVINGS_LABELS.realized}</div>
                    <p className="text-muted-foreground">{realizedSavingsLabel()}</p>
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
              Procesos de licitación (gestión manual)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              En esta versión cada proceso se registra y actualiza en XPEND. Más adelante podrá sincronizarse con herramientas externas (p. ej. e-sourcing).
            </p>
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
                      <th className="text-right py-2">Ahorro negociado (est.)</th>
                      <th className="text-center py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedLicitaciones.map(link => (
                      <tr key={link.licitacion_id} className="border-b last:border-0">
                        <td className="py-2 font-mono text-xs text-muted-foreground">{link.licitacion_id}</td>
                        <td className="py-2">{link.licitacion?.name || 'Sin nombre'}</td>
                        <td className="py-2">
                          {link.licitacion?.status
                            ? licitacionStatusLabels[link.licitacion.status] || link.licitacion.status
                            : '-'}
                        </td>
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
                          {(() => {
                            const source = savingsLinks.find(item => item.licitacion_id === link.licitacion_id)
                            const result = source ? classifyLinkSavings(source) : null
                            if (result?.kind === 'negotiated') return formatCurrency(result.amount, result.currency)
                            if (result?.kind === 'declared') {
                              return (
                                <span className="text-muted-foreground">
                                  {SAVINGS_LABELS.declared}: {formatCurrency(result.amount, result.currency)}
                                </span>
                              )
                            }
                            return (
                              <span className="text-muted-foreground">
                                {result?.reason === 'not_comparable' ? 'Sin base comparable' : SAVINGS_LABELS.noInfo}
                              </span>
                            )
                          })()}
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

