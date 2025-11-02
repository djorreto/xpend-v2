'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  DollarSign,
  User,
  FileText,
  Building2,
  Download,
  ExternalLink,
  TrendingDown,
  TrendingUp
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { useToast } from '@/components/ui/toast'
import { useVersion } from '@/contexts/version-context'
import { mockLicitacionesData } from '@/lib/mock-data'
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
  RFP: 'RFP (Request for Proposal)',
  RFQ: 'RFQ (Request for Quotation)',
  RFI: 'RFI (Request for Information)'
}

const categoryLabels = {
  recurring_service: 'Servicio recurrente',
  non_recurring_service: 'Servicio no recurrente',
  improvement_project: 'Proyecto de mejora',
  construction_project: 'Proyecto de construcción'
}

const baselineSourceLabels = {
  historical: 'Línea base histórica',
  budget: 'Presupuesto',
  other: 'Otro'
}

export default function LicitacionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const licitacionId = params.id as string
  const { addToast } = useToast()
  const { isMockup } = useVersion()

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [licitacion, setLicitacion] = useState<Licitacion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (licitacionId) {
      loadLicitacionDetails()
    }
  }, [licitacionId])

  const loadLicitacionDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      // Check if we're in mockup mode or if Supabase is not configured
      const isSupabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL &&
                                   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (isMockup || !isSupabaseConfigured) {
        // Use mock data
        const mockLicitacion = mockLicitacionesData.find(l => l.id === licitacionId)

        if (!mockLicitacion) {
          throw new Error('Licitación no encontrada')
        }

        // Set mock user and company data
        setUser({
          name: 'Usuario Demo',
          email: 'demo@xpend.cl',
          role: 'admin'
        })

        setCompany({
          name: 'Xpend',
          id: 'company-1'
        })

        // Add mock department and user data
        setLicitacion({
          ...mockLicitacion,
          department: { id: 'dept-1', name: 'Finanzas' },
          responsible_user: { id: 'user-1', full_name: 'Juan Pérez', email: 'juan.perez@empresa.com' },
          created_by_user: { id: 'user-1', full_name: 'Juan Pérez', email: 'juan.perez@empresa.com' }
        } as any)
        return
      }

      const supabase = supabaseBrowser()

      // Get current user
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
      if (userError || !authUser) {
        throw new Error('Usuario no autenticado')
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profileError || !profile) {
        throw new Error('Perfil no encontrado')
      }

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
      }

      // Fetch licitacion details with relations
      const { data, error: licitacionError } = await supabase
        .from('licitaciones')
        .select(`
          *,
          department:departments(id, name),
          responsible_user:profiles!responsible_user_id(id, full_name, email),
          created_by_user:profiles!created_by(id, full_name, email)
        `)
        .eq('id', licitacionId)
        .single()

      if (licitacionError) throw licitacionError
      if (!data) throw new Error('Licitación no encontrada')

      setLicitacion(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la licitación')
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo cargar la licitación'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteLicitacion = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta licitación?')) {
      return
    }

    try {
      if (isMockup) {
        // In mockup mode, just show success message
        addToast({
          type: 'success',
          title: 'Licitación eliminada',
          message: 'La licitación ha sido eliminada correctamente (modo demo)'
        })
        router.push('/licitaciones')
        return
      }

      const supabase = supabaseBrowser()
      const { error } = await supabase
        .from('licitaciones')
        .delete()
        .eq('id', licitacionId)

      if (error) throw error

      addToast({
        type: 'success',
        title: 'Licitación eliminada',
        message: 'La licitación ha sido eliminada correctamente'
      })
      router.push('/licitaciones')
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo eliminar la licitación'
      })
    }
  }

  const downloadTenderDocument = async () => {
    if (!licitacion?.tender_document_path) return

    try {
      if (isMockup) {
        // In mockup mode, show demo message
        addToast({
          type: 'info',
          title: 'Modo Demo',
          message: 'En modo demo, la descarga es simulada'
        })
        return
      }

      const supabase = supabaseBrowser()
      const { data, error } = await supabase.storage
        .from('documents')
        .download(licitacion.tender_document_path)

      if (error) throw error

      // Create download link
      const url = window.URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = licitacion.tender_document_name || 'bases.pdf'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo descargar el documento'
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
          title="Error al cargar la licitación"
          message={error}
          onRetry={loadLicitacionDetails}
        />
      </MainLayout>
    )
  }

  if (!licitacion) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <ErrorMessage
          title="Licitación no encontrada"
          message="La licitación que buscas no existe o no tienes permisos para verla."
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/licitaciones')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-sm font-mono text-muted-foreground">{licitacion.id}</span>
                {licitacion.type && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                    {licitacion.type}
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{licitacion.name}</h1>
              <p className="text-muted-foreground">
                {licitacion.description || 'Sin descripción'}
              </p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => router.push(`/licitaciones/${licitacionId}/edit`)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
            <Button variant="outline" onClick={handleDeleteLicitacion}>
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estado</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[licitacion.status as keyof typeof statusColors]}`}>
                {statusLabels[licitacion.status as keyof typeof statusLabels]}
              </span>
              {licitacion.category && (
                <p className="text-xs text-muted-foreground mt-2">
                  {categoryLabels[licitacion.category as keyof typeof categoryLabels]}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Baseline</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {licitacion.baseline_amount ? formatCurrency(licitacion.baseline_amount, licitacion.baseline_currency) : 'N/A'}
              </div>
              {licitacion.baseline_source && (
              <p className="text-xs text-muted-foreground">
                  {baselineSourceLabels[licitacion.baseline_source as keyof typeof baselineSourceLabels]}
              </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monto Adjudicado</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {licitacion.awarded_amount ? formatCurrency(licitacion.awarded_amount, licitacion.baseline_currency) : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                {licitacion.award_date ? `Adjudicado el ${formatDate(licitacion.award_date)}` : 'Pendiente'}
              </p>
            </CardContent>
          </Card>

          <Card className={licitacion.savings_amount && licitacion.savings_amount > 0 ? 'border-green-200' : licitacion.savings_amount && licitacion.savings_amount < 0 ? 'border-red-200' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ahorro</CardTitle>
              {licitacion.savings_amount && licitacion.savings_amount > 0 ? (
                <TrendingDown className="h-4 w-4 text-green-600" />
              ) : licitacion.savings_amount && licitacion.savings_amount < 0 ? (
                <TrendingUp className="h-4 w-4 text-red-600" />
              ) : (
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent>
              {licitacion.savings_amount !== undefined && licitacion.savings_amount !== null ? (
                <>
                  <div className={`text-2xl font-bold ${
                    licitacion.savings_amount > 0 ? 'text-green-600' : licitacion.savings_amount < 0 ? 'text-red-600' : ''
                  }`}>
                    {formatCurrency(Math.abs(licitacion.savings_amount), licitacion.baseline_currency)}
              </div>
                  {licitacion.savings_percentage !== undefined && licitacion.savings_percentage !== null && (
                    <p className={`text-xs font-medium ${
                      licitacion.savings_amount > 0 ? 'text-green-600' : licitacion.savings_amount < 0 ? 'text-red-600' : 'text-muted-foreground'
                    }`}>
                      {Math.abs(licitacion.savings_percentage).toFixed(2)}% {licitacion.savings_amount > 0 ? 'ahorro' : 'sobrecosto'}
                    </p>
                  )}
                </>
              ) : (
                <div className="text-2xl font-bold text-muted-foreground">N/A</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Details */}
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Detalles</TabsTrigger>
            <TabsTrigger value="dates">Cronograma</TabsTrigger>
            <TabsTrigger value="team">Equipo</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle>Información General</CardTitle>
                <CardDescription>
                  Detalles básicos de la licitación
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-2">ID de Licitación</h4>
                    <p className="text-muted-foreground font-mono">{licitacion.id}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Estado</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[licitacion.status as keyof typeof statusColors]}`}>
                      {statusLabels[licitacion.status as keyof typeof statusLabels]}
                    </span>
                  </div>
                  {licitacion.type && (
                  <div>
                      <h4 className="font-medium mb-2">Tipo</h4>
                      <p className="text-muted-foreground">{typeLabels[licitacion.type as keyof typeof typeLabels]}</p>
                  </div>
                  )}
                  {licitacion.category && (
                  <div>
                      <h4 className="font-medium mb-2">Categoría</h4>
                      <p className="text-muted-foreground">{categoryLabels[licitacion.category as keyof typeof categoryLabels]}</p>
                  </div>
                  )}
                  <div>
                    <h4 className="font-medium mb-2">Baseline</h4>
                    <p className="text-muted-foreground">
                      {licitacion.baseline_amount ? formatCurrency(licitacion.baseline_amount, licitacion.baseline_currency) : 'No especificado'}
                    </p>
                    {licitacion.baseline_source && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Fuente: {baselineSourceLabels[licitacion.baseline_source as keyof typeof baselineSourceLabels]}
                      </p>
                    )}
                  </div>
                  {licitacion.awarded_amount && (
                  <div>
                      <h4 className="font-medium mb-2">Monto Adjudicado</h4>
                    <p className="text-muted-foreground">
                        {formatCurrency(licitacion.awarded_amount, licitacion.baseline_currency)}
                    </p>
                  </div>
                  )}
                </div>
                {licitacion.description && (
                  <div>
                    <h4 className="font-medium mb-2">Descripción</h4>
                    <p className="text-muted-foreground whitespace-pre-wrap">{licitacion.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dates">
            <Card>
              <CardHeader>
                <CardTitle>Cronograma del Proceso</CardTitle>
                <CardDescription>
                  Fechas importantes de la licitación
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {licitacion.request_date && (
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="font-medium">Fecha de solicitud</span>
                      <span className="text-muted-foreground">{formatDate(licitacion.request_date)}</span>
                    </div>
                  )}
                  {licitacion.publication_date && (
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="font-medium">Fecha de Publicación</span>
                      <span className="text-muted-foreground">{formatDate(licitacion.publication_date)}</span>
                    </div>
                  )}
                  {licitacion.questions_date && (
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="font-medium">Fecha de Preguntas</span>
                      <span className="text-muted-foreground">{formatDate(licitacion.questions_date)}</span>
                    </div>
                  )}
                  {licitacion.answers_date && (
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="font-medium">Fecha de Respuestas</span>
                      <span className="text-muted-foreground">{formatDate(licitacion.answers_date)}</span>
                    </div>
                  )}
                  {licitacion.proposal_reception_date && (
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="font-medium">Fecha de recepción de propuestas</span>
                      <span className="text-muted-foreground">{formatDate(licitacion.proposal_reception_date)}</span>
                    </div>
                  )}
                  {licitacion.proposal_closing_date && (
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="font-medium">Fecha de cierre de propuestas</span>
                      <span className="text-muted-foreground">{formatDate(licitacion.proposal_closing_date)}</span>
                    </div>
                  )}
                  {licitacion.committee_date && (
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="font-medium">Fecha de Comité / Informe</span>
                      <span className="text-muted-foreground">{formatDate(licitacion.committee_date)}</span>
                    </div>
                  )}
                  {licitacion.award_date && (
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="font-medium">Fecha de Adjudicación</span>
                      <span className="text-muted-foreground">{formatDate(licitacion.award_date)}</span>
                    </div>
                  )}
                  {licitacion.contract_signature_date && (
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="font-medium">Fecha de firma de contrato</span>
                      <span className="text-muted-foreground">{formatDate(licitacion.contract_signature_date)}</span>
                    </div>
                  )}
                  {!licitacion.request_date && !licitacion.publication_date && !licitacion.questions_date &&
                   !licitacion.answers_date && !licitacion.proposal_reception_date && !licitacion.proposal_closing_date &&
                   !licitacion.committee_date && !licitacion.award_date && !licitacion.contract_signature_date && (
                    <p className="text-muted-foreground text-center py-4">No se han especificado fechas del proceso.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team">
            <Card>
              <CardHeader>
                <CardTitle>Equipo y Responsables</CardTitle>
                <CardDescription>
                  Información del equipo asignado a la licitación
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {licitacion.department && (
                  <div className="flex items-start space-x-4">
                    <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <h4 className="font-medium">Gerencia</h4>
                      <p className="text-muted-foreground">{licitacion.department.name}</p>
                    </div>
                  </div>
                )}
                {licitacion.responsible_user && (
                  <div className="flex items-start space-x-4">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <h4 className="font-medium">Solicitante Responsable</h4>
                      <p className="text-muted-foreground">
                        {licitacion.responsible_user.full_name || licitacion.responsible_user.email}
                      </p>
                      {licitacion.responsible_user.email && licitacion.responsible_user.full_name && (
                        <p className="text-sm text-muted-foreground">{licitacion.responsible_user.email}</p>
                      )}
                    </div>
                  </div>
                )}
                {(licitacion as any).created_by_user && (
                  <div className="flex items-start space-x-4">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <h4 className="font-medium">Creado por</h4>
                      <p className="text-muted-foreground">
                        {(licitacion as any).created_by_user.full_name || (licitacion as any).created_by_user.email}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(licitacion.created_at)}</p>
                    </div>
                  </div>
                )}
                {!licitacion.department && !licitacion.responsible_user && (
                  <p className="text-muted-foreground text-center py-4">No se ha asignado equipo a esta licitación.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>Documentos y Enlaces</CardTitle>
                <CardDescription>
                  Bases de licitación y documentación relacionada
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {licitacion.tender_document_path && (
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <h4 className="font-medium">Bases de Licitación</h4>
                          <p className="text-sm text-muted-foreground">
                            {licitacion.tender_document_name}
                            {licitacion.tender_document_size && (
                              <span className="ml-2">
                                ({(licitacion.tender_document_size / 1024 / 1024).toFixed(2)} MB)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={downloadTenderDocument}>
                        <Download className="h-4 w-4 mr-2" />
                        Descargar
                      </Button>
                    </div>
                  </div>
                )}
                {licitacion.tender_link && (
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <ExternalLink className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <h4 className="font-medium">Enlace a bases y anexos</h4>
                          <p className="text-sm text-muted-foreground break-all">
                            {licitacion.tender_link}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={licitacion.tender_link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Abrir
                        </a>
                      </Button>
                  </div>
                  </div>
                )}
                {!licitacion.tender_document_path && !licitacion.tender_link && (
                  <p className="text-muted-foreground text-center py-4">No se han cargado documentos para esta licitación.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}
