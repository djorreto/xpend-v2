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
  TrendingUp,
  Plus,
  LinkIcon
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { useToast } from '@/components/ui/toast'
import type { Licitacion } from '@/types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

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

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [licitacion, setLicitacion] = useState<Licitacion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [linkedPlans, setLinkedPlans] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [invoiceForm, setInvoiceForm] = useState({
    amount: '',
    currency: 'CLP',
    category: '',
    description: '',
    invoice_date: '',
    provider: ''
  })

  useEffect(() => {
    if (licitacionId) {
      loadLicitacionDetails()
    }
  }, [licitacionId])

  const loadLicitacionDetails = async () => {
    try {
      setLoading(true)
      setError(null)

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

      // Load linked sourcing plans (N:M)
      const { data: links } = await supabase
        .from('sourcing_plan_licitaciones')
        .select('plan_id, contribution_baseline, contribution_savings, plan:sourcing_plans(id, title, plan_year, quarter)')
        .eq('licitacion_id', licitacionId)
      setLinkedPlans(
        (links || []).map(link => ({
          plan_id: link.plan_id,
          title: link.plan?.title,
          plan_year: link.plan?.plan_year,
          quarter: link.plan?.quarter,
          contribution_baseline: link.contribution_baseline,
          contribution_savings: link.contribution_savings
        }))
      )

      // Load service invoices for this licitacion
      const { data: invoicesData } = await supabase
        .from('service_invoices')
        .select('*')
        .eq('licitacion_id', licitacionId)
        .order('invoice_date', { ascending: false })
      setInvoices(invoicesData || [])
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

  const handleInvoiceChange = (field: string, value: string) => {
    setInvoiceForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSaveInvoice = async () => {
    if (!licitacion || !company || !invoiceForm.amount) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Monto y licitación son obligatorios'
      })
      return
    }
    setSavingInvoice(true)
    try {
      const supabase = supabaseBrowser()
      const { error } = await supabase
        .from('service_invoices')
        .insert({
          licitacion_id: licitacion.id,
          company_id: company.id,
          amount: parseFloat(invoiceForm.amount),
          currency: invoiceForm.currency,
          category: invoiceForm.category || null,
          description: invoiceForm.description || null,
          invoice_date: invoiceForm.invoice_date || null,
          provider: invoiceForm.provider || null,
          created_by: user?.id || null
        })
      if (error) throw error
      addToast({
        type: 'success',
        title: 'Factura añadida',
        message: 'El gasto se registró correctamente'
      })
      await loadLicitacionDetails()
      setInvoiceForm({
        amount: '',
        currency: 'CLP',
        category: '',
        description: '',
        invoice_date: '',
        provider: ''
      })
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'No se pudo guardar la factura'
      })
    } finally {
      setSavingInvoice(false)
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

  const invoicesTotal = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)

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

        {/* Iniciativas vinculadas */}
        {linkedPlans.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Iniciativas del Sourcing Plan vinculadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {linkedPlans.map(plan => (
                <div key={plan.plan_id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{plan.title || plan.plan_id}</span>
                    <span className="text-xs text-muted-foreground">
                      {plan.plan_year} - {plan.quarter}
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => router.push(`/sourcing-plan/${plan.plan_id}`)}>
                    Ver iniciativa
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

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
              <CardTitle className="text-sm font-medium">Gasto real (facturas)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(invoicesTotal, licitacion.baseline_currency)}
              </div>
              <p className="text-xs text-muted-foreground">
                Suma de facturas registradas
              </p>
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="details">Detalles</TabsTrigger>
            <TabsTrigger value="dates">Cronograma</TabsTrigger>
            <TabsTrigger value="team">Equipo</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
            <TabsTrigger value="invoices">Facturas</TabsTrigger>
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

          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>Facturas / Gastos de servicio</CardTitle>
                <CardDescription>Registra y visualiza facturas asociadas a esta licitación</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Monto</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceForm.amount}
                      onChange={(e) => handleInvoiceChange('amount', e.target.value)}
                      placeholder="1000000"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Moneda</label>
                    <Input
                      value={invoiceForm.currency}
                      onChange={(e) => handleInvoiceChange('currency', e.target.value)}
                      placeholder="CLP"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Categoría</label>
                    <Input
                      value={invoiceForm.category}
                      onChange={(e) => handleInvoiceChange('category', e.target.value)}
                      placeholder="Categoría de gasto"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Proveedor</label>
                    <Input
                      value={invoiceForm.provider}
                      onChange={(e) => handleInvoiceChange('provider', e.target.value)}
                      placeholder="Nombre del proveedor"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Fecha factura</label>
                    <Input
                      type="date"
                      value={invoiceForm.invoice_date}
                      onChange={(e) => handleInvoiceChange('invoice_date', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Descripción</label>
                    <Textarea
                      value={invoiceForm.description}
                      onChange={(e) => handleInvoiceChange('description', e.target.value)}
                      placeholder="Detalle del gasto"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveInvoice} disabled={savingInvoice}>
                    <Plus className="mr-2 h-4 w-4" />
                    Guardar factura
                  </Button>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold">Facturas registradas</h4>
                    <div className="text-sm text-muted-foreground">
                      Total: {formatCurrency(invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0), invoiceForm.currency)}
                    </div>
                  </div>
                  {invoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay facturas registradas.</p>
                  ) : (
                    <div className="space-y-2">
                      {invoices.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                          <div className="flex flex-col text-sm">
                            <span className="font-semibold">{formatCurrency(inv.amount, inv.currency || licitacion.baseline_currency)}</span>
                            <span className="text-muted-foreground">
                              {inv.invoice_date ? formatDate(inv.invoice_date) : 'Sin fecha'} • {inv.provider || 'Sin proveedor'}
                            </span>
                            {inv.category && <span className="text-muted-foreground text-xs">Cat: {inv.category}</span>}
                            {inv.description && <span className="text-muted-foreground text-xs">{inv.description}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}
