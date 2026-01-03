'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  DollarSign,
  Gavel,
  Edit,
  Trash2,
  FileText,
  TrendingDown,
  TrendingUp
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { useToast } from '@/components/ui/toast'
import type { Licitacion } from '@/types'

const statusColors = {
  planned: 'bg-gray-100 text-gray-800',
  bases_review: 'bg-blue-100 text-blue-800',
  published: 'bg-cyan-100 text-cyan-800',
  evaluation: 'bg-yellow-100 text-yellow-800',
  awarded: 'bg-purple-100 text-purple-800',
  contract_signed: 'bg-green-100 text-green-800'
}

const statusLabels = {
  planned: 'Planificado',
  bases_review: 'Revisión Bases',
  published: 'Publicada',
  evaluation: 'Evaluación',
  awarded: 'Adjudicada',
  contract_signed: 'Contrato firmado'
}

const typeLabels = {
  RFP: 'RFP',
  RFQ: 'RFQ',
  RFI: 'RFI'
}

const categoryLabels = {
  recurring_service: 'Servicio recurrente',
  non_recurring_service: 'Servicio no recurrente',
  improvement_project: 'Proyecto de mejora',
  construction_project: 'Proyecto de construcción'
}

type PlanLink = {
  plan_id: string
  licitacion_id: string
  plan?: {
    id: string
    title: string | null
    plan_year: number | null
    quarter: string | null
  }
}

export default function LicitacionesPage() {
  const supabase = supabaseBrowser()
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [licitaciones, setLicitaciones] = useState<Licitacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [planLinks, setPlanLinks] = useState<Record<string, PlanLink[]>>({})
  const router = useRouter()
  const { addToast } = useToast()

  useEffect(() => {
    loadLicitaciones()
  }, [])

  const loadLicitaciones = async () => {
    try {
      setLoading(true)
      setError(null)

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

      // Get company info
      if (profile.company_id) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .single()

        if (!companyError && companyData) {
          setCompany(companyData)
        }

        // Load licitaciones with department and responsible user
        const { data: licitacionesData, error: licitacionesError } = await supabase
          .from('licitaciones')
          .select(`
            *,
            department:departments(id, name),
            responsible_user:profiles!responsible_user_id(id, full_name, email)
          `)
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false })

        if (licitacionesError) throw licitacionesError
        setLicitaciones(licitacionesData || [])

        // Cargar asociaciones con iniciativas para chips
        const licIds = (licitacionesData || []).map(l => l.id)
        if (licIds.length) {
          const { data: links } = await supabase
            .from('sourcing_plan_licitaciones')
            .select('plan_id, licitacion_id, plan:sourcing_plans(id, title, plan_year, quarter)')
            .in('licitacion_id', licIds)
          const grouped: Record<string, PlanLink[]> = {}
          ;(links || []).forEach(link => {
            if (!grouped[link.licitacion_id]) grouped[link.licitacion_id] = []
            grouped[link.licitacion_id].push(link as PlanLink)
          })
          setPlanLinks(grouped)
        } else {
          setPlanLinks({})
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar licitaciones')
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudieron cargar las licitaciones'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteLicitacion = async (licitacionId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta licitación?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('licitaciones')
        .delete()
        .eq('id', licitacionId)

      if (error) throw error

      setLicitaciones(prev => prev.filter(l => l.id !== licitacionId))
      addToast({
        type: 'success',
        title: 'Licitación eliminada',
        message: 'La licitación ha sido eliminada correctamente'
      })
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo eliminar la licitación'
      })
    }
  }

  const filteredLicitaciones = licitaciones.filter(licitacion =>
    licitacion.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (licitacion.description && licitacion.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    licitacion.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
          title="Error al cargar licitaciones"
          message={error}
          onRetry={loadLicitaciones}
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Licitaciones</h1>
            <p className="text-muted-foreground">
              Gestiona todas tus licitaciones y procesos de compra
            </p>
          </div>
          <Button onClick={() => router.push('/licitaciones/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Licitación
          </Button>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por ID, nombre o descripción..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Licitaciones Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium">ID / Nombre</th>
                    <th className="text-left p-4 font-medium">Estado</th>
                    <th className="text-left p-4 font-medium">Tipo</th>
                    <th className="text-left p-4 font-medium">Categoría</th>
                    <th className="text-right p-4 font-medium">Baseline</th>
                    <th className="text-right p-4 font-medium">Adjudicado</th>
                    <th className="text-right p-4 font-medium">Ahorro</th>
                    <th className="text-left p-4 font-medium">Fechas</th>
                    <th className="text-center p-4 font-medium">Iniciativas</th>
                    <th className="text-center p-4 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLicitaciones.map((licitacion) => (
                    <tr key={licitacion.id} className="border-b hover:bg-muted/30 transition-colors">
                      {/* ID / Nombre */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">{licitacion.id}</span>
                            {licitacion.type && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                                {typeLabels[licitacion.type as keyof typeof typeLabels]}
                              </span>
                            )}
                          </div>
                          <div className="font-medium">{licitacion.name}</div>
                          {licitacion.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {licitacion.description}
                            </div>
                          )}
                          {/* Chips de iniciativas */}
                          <div className="flex flex-wrap gap-2 mt-1">
                            {(planLinks[licitacion.id] || []).map(link => (
                              <Badge
                                key={link.plan_id}
                                variant="outline"
                                className="text-xs cursor-pointer"
                                onClick={() => router.push(`/sourcing-plan/${link.plan_id}`)}
                              >
                                {link.plan?.title || link.plan_id} • {link.plan?.plan_year}-{link.plan?.quarter}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[licitacion.status as keyof typeof statusColors]}`}>
                          {statusLabels[licitacion.status as keyof typeof statusLabels]}
                        </span>
                      </td>

                      {/* Tipo */}
                      <td className="p-4">
                        {licitacion.type && (
                          <span className="text-sm">
                            {typeLabels[licitacion.type as keyof typeof typeLabels]}
                          </span>
                        )}
                      </td>

                      {/* Categoría */}
                      <td className="p-4">
                        {licitacion.category && (
                          <span className="text-sm text-muted-foreground">
                            {categoryLabels[licitacion.category as keyof typeof categoryLabels]}
                          </span>
                        )}
                      </td>

                      {/* Baseline */}
                      <td className="p-4 text-right">
                        {licitacion.baseline_amount ? (
                          <span className="font-medium">
                            {formatCurrency(licitacion.baseline_amount, licitacion.baseline_currency)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Adjudicado */}
                      <td className="p-4 text-right">
                        {licitacion.awarded_amount ? (
                          <span className="font-medium">
                            {formatCurrency(licitacion.awarded_amount, licitacion.baseline_currency)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Ahorro */}
                      <td className="p-4 text-right">
                        {licitacion.savings_amount !== undefined && licitacion.savings_amount !== null ? (
                          <div className={`flex items-center justify-end gap-1 ${
                            licitacion.savings_amount > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {licitacion.savings_amount > 0 ? (
                              <TrendingDown className="h-3 w-3" />
                            ) : (
                              <TrendingUp className="h-3 w-3" />
                            )}
                            <span className="font-semibold">
                              {formatCurrency(Math.abs(licitacion.savings_amount), licitacion.baseline_currency)}
                              {licitacion.savings_percentage !== undefined && licitacion.savings_percentage !== null && (
                                <span className="ml-1 text-xs">({Math.abs(licitacion.savings_percentage).toFixed(1)}%)</span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Fechas */}
                      <td className="p-4">
                        {(licitacion.publication_date || licitacion.proposal_closing_date) ? (
                          <div className="flex items-center space-x-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {licitacion.publication_date && formatDate(licitacion.publication_date)}
                              {licitacion.proposal_closing_date && (
                                <> - {formatDate(licitacion.proposal_closing_date)}</>
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="outline">{(planLinks[licitacion.id] || []).length}</Badge>
                      </td>

                      {/* Acciones */}
                      <td className="p-4">
                        <div className="flex items-center justify-center space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/licitaciones/${licitacion.id}`)}
                          >
                            Ver
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/licitaciones/${licitacion.id}/edit`)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteLicitacion(licitacion.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Empty State */}
        {filteredLicitaciones.length === 0 && licitaciones.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Gavel className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay licitaciones</h3>
              <p className="text-muted-foreground text-center mb-4">
                Comienza creando tu primera licitación
              </p>
              <Button onClick={() => router.push('/licitaciones/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Crear Licitación
              </Button>
            </CardContent>
          </Card>
        )}

        {/* No Results */}
        {filteredLicitaciones.length === 0 && licitaciones.length > 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No se encontraron licitaciones</h3>
              <p className="text-muted-foreground text-center mb-4">
                Intenta con otros términos de búsqueda
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
