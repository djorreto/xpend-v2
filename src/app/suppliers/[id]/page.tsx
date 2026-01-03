'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Edit,
  Trash2,
  Building2,
  Phone,
  Mail,
  Globe,
  FileText,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Download,
  ExternalLink,
  User,
  Clock,
  Star
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { useToast } from '@/components/ui/toast'
import type {
  Supplier,
  AdministrativeEvaluation,
  TechnicalEvaluation,
  LicitacionSupplier,
  EvaluationTrafficLight
} from '@/types'

const serviceTypeLabels: Record<string, string> = {
  tecnologia: 'Tecnología',
  servicios_profesionales: 'Servicios Profesionales',
  suministros: 'Suministros',
  marketing: 'Marketing',
  infraestructura: 'Infraestructura',
  construccion: 'Construcción',
  consultoria: 'Consultoría',
  mantenimiento: 'Mantenimiento',
  otros: 'Otros'
}

const statusColors = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800'
}

export default function SupplierDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { addToast } = useToast()

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [administrativeEvaluation, setAdministrativeEvaluation] = useState<AdministrativeEvaluation | null>(null)
  const [technicalEvaluations, setTechnicalEvaluations] = useState<TechnicalEvaluation[]>([])
  const [licitacionSuppliers, setLicitacionSuppliers] = useState<LicitacionSupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supplierId = params.id as string

  // Load user and company data on component mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const supabase = supabaseBrowser()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single()

        if (!profile) return

        setUser({
          id: authUser.id,
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

          if (companyData) {
            setCompany({
              id: companyData.id,
              name: companyData.name
            })
          }
        }
      } catch (err) {
        console.error('Error loading user data:', err)
      }
    }

    loadUserData()
  }, [])

  useEffect(() => {
    loadSupplierDetails()
  }, [supplierId])

  const loadSupplierDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      // Functional mode: load from Supabase
      const supabase = supabaseBrowser()

      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', supplierId)
        .single()

      if (supplierError || !supplierData) {
        throw new Error('Proveedor no encontrado')
      }

      setSupplier(supplierData as Supplier)

      // Load administrative evaluation (optional)
      const { data: adminEvalData } = await supabase
        .from('administrative_evaluations')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('evaluation_date', { ascending: false })
        .limit(1)
        .single()

      setAdministrativeEvaluation(adminEvalData as AdministrativeEvaluation || null)

      // Load technical evaluations (optional)
      const { data: techEvalsData } = await supabase
        .from('technical_evaluations')
        .select('*')
        .eq('supplier_id', supplierId)

      setTechnicalEvaluations(techEvalsData as TechnicalEvaluation[] || [])

      // Load licitacion suppliers (optional)
      const { data: licitacionSuppsData } = await supabase
        .from('licitacion_suppliers')
        .select('*')
        .eq('supplier_id', supplierId)

      setLicitacionSuppliers(licitacionSuppsData as LicitacionSupplier[] || [])

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar proveedor')
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo cargar el proveedor'
      })
    } finally {
      setLoading(false)
    }
  }

  const getEvaluationTrafficLight = (): EvaluationTrafficLight => {
    if (!administrativeEvaluation) {
      return {
        status: 'pending',
        color: 'gray',
        message: 'Sin evaluación'
      }
    }

    const today = new Date()
    const validUntil = new Date(administrativeEvaluation.valid_until)

    if (validUntil < today) {
      return {
        status: 'expired',
        color: 'red',
        message: 'Evaluación expirada',
        score: administrativeEvaluation.final_score
      }
    }

    if (administrativeEvaluation.final_score === undefined || administrativeEvaluation.final_score === null) {
      return {
        status: 'incomplete',
        color: 'yellow',
        message: 'Evaluación incompleta'
      }
    }

    if (administrativeEvaluation.final_score >= 80) {
      return {
        status: 'valid',
        color: 'green',
        message: 'Evaluación vigente',
        score: administrativeEvaluation.final_score
      }
    } else if (administrativeEvaluation.final_score >= 60) {
      return {
        status: 'valid',
        color: 'yellow',
        message: 'Evaluación vigente',
        score: administrativeEvaluation.final_score
      }
    } else {
      return {
        status: 'valid',
        color: 'red',
        message: 'Evaluación vigente',
        score: administrativeEvaluation.final_score
      }
    }
  }

  const handleDeleteSupplier = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar este proveedor?')) {
      return
    }

    try {
      // TODO: Implement Supabase deletion
      throw new Error('Eliminación no implementada aún')

    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'No se pudo eliminar el proveedor'
      })
    }
  }

  const downloadNDA = () => {
    // TODO: Implement real NDA download
  }

  if (loading) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <LoadingSpinner />
      </MainLayout>
    )
  }

  if (error || !supplier) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <ErrorMessage
          title="Error al cargar proveedor"
          message={error || 'Proveedor no encontrado'}
          onRetry={loadSupplierDetails}
        />
      </MainLayout>
    )
  }

  const trafficLight = getEvaluationTrafficLight()

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => router.push('/suppliers')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{supplier.fantasy_name}</h1>
              <p className="text-muted-foreground">{supplier.legal_name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={() => router.push(`/suppliers/${supplier.id}/edit`)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
            <Button variant="destructive" onClick={handleDeleteSupplier}>
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center space-x-4">
          <Badge className={supplier.is_active ? statusColors.active : statusColors.inactive}>
            {supplier.is_active ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="details" className="space-y-6">
          <TabsList>
            <TabsTrigger value="details">Detalles</TabsTrigger>
            <TabsTrigger value="evaluations">Evaluaciones</TabsTrigger>
            <TabsTrigger value="licitaciones">Licitaciones</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
          </TabsList>

          {/* Detalles Tab */}
          <TabsContent value="details" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Información Básica */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building2 className="mr-2 h-5 w-5" />
                    Información Básica
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">RUT</label>
                    <p className="font-mono">{supplier.rut}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tipo de Servicio</label>
                    <Badge variant="outline" className="mt-1">
                      {serviceTypeLabels[supplier.service_type]}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">NDA</label>
                    <div className="flex items-center space-x-2 mt-1">
                      {supplier.nda_signed ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-600">NDA Firmado</span>
                          {supplier.nda_signed_date && (
                            <span className="text-xs text-muted-foreground">
                              ({formatDate(supplier.nda_signed_date)})
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">Sin NDA</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Comentarios</label>
                    <p className="text-sm">{supplier.comments || 'Sin comentarios'}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Información de Contacto */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="mr-2 h-5 w-5" />
                    Información de Contacto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {supplier.contact_name && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Contacto</label>
                      <p>{supplier.contact_name}</p>
                    </div>
                  )}
                  {supplier.contact_email && (
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${supplier.contact_email}`} className="text-blue-600 hover:underline">
                        {supplier.contact_email}
                      </a>
                    </div>
                  )}
                  {supplier.contact_phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${supplier.contact_phone}`} className="text-blue-600 hover:underline">
                        {supplier.contact_phone}
                      </a>
                    </div>
                  )}
                  {supplier.website && (
                    <div className="flex items-center space-x-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {supplier.website}
                        <ExternalLink className="ml-1 h-3 w-3 inline" />
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Metadatos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  Información del Sistema
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Fecha de Creación</label>
                    <p className="text-sm">{formatDate(supplier.created_at)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Última Actualización</label>
                    <p className="text-sm">{formatDate(supplier.updated_at)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Creado por</label>
                    <p className="text-sm">{supplier.created_by_user?.full_name || 'Sistema'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Evaluaciones Tab */}
          <TabsContent value="evaluations" className="space-y-6">
            {/* Evaluación Administrativa */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Star className="mr-2 h-5 w-5" />
                    Evaluación Administrativa
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      trafficLight.color === 'green' ? 'bg-green-500' :
                      trafficLight.color === 'yellow' ? 'bg-yellow-500' :
                      trafficLight.color === 'red' ? 'bg-red-500' : 'bg-gray-500'
                    }`} />
                    <span className="text-sm text-muted-foreground">{trafficLight.message}</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {administrativeEvaluation ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Documentación</label>
                        <p className="text-2xl font-bold">{administrativeEvaluation.documentation_score || 0}</p>
                        <p className="text-xs text-muted-foreground">{administrativeEvaluation.documentation_notes}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Financiera</label>
                        <p className="text-2xl font-bold">{administrativeEvaluation.financial_score || 0}</p>
                        <p className="text-xs text-muted-foreground">{administrativeEvaluation.financial_notes}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Experiencia</label>
                        <p className="text-2xl font-bold">{administrativeEvaluation.experience_score || 0}</p>
                        <p className="text-xs text-muted-foreground">{administrativeEvaluation.experience_notes}</p>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold">Nota Final</span>
                        <span className="text-3xl font-bold">{administrativeEvaluation.final_score?.toFixed(1) || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Evaluada el {formatDate(administrativeEvaluation.evaluation_date)}</span>
                        <span>Válida hasta {formatDate(administrativeEvaluation.valid_until)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No hay evaluación administrativa</p>
                    <Button className="mt-4" onClick={() => router.push(`/suppliers/${supplier.id}/evaluations/administrative/new`)}>
                      Crear Evaluación
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Evaluaciones Técnicas */}
            <Card>
              <CardHeader>
                <CardTitle>Evaluaciones Técnicas</CardTitle>
                <CardDescription>
                  Evaluaciones específicas por licitación
                </CardDescription>
              </CardHeader>
              <CardContent>
                {technicalEvaluations.length > 0 ? (
                  <div className="space-y-4">
                    {technicalEvaluations.map((evaluation) => (
                      <div key={evaluation.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Licitación {evaluation.licitacion_id}</span>
                          <span className="text-2xl font-bold">{evaluation.final_score?.toFixed(1) || 'N/A'}</span>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Prevención de Riesgos: </span>
                            <span className="font-medium">{evaluation.risk_prevention_score || 0}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Propuesta Técnica: </span>
                            <span className="font-medium">{evaluation.technical_proposal_score || 0}</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Evaluada el {formatDate(evaluation.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No hay evaluaciones técnicas</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Licitaciones Tab */}
          <TabsContent value="licitaciones" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Participaciones en Licitaciones</CardTitle>
                <CardDescription>
                  Historial de participación en licitaciones
                </CardDescription>
              </CardHeader>
              <CardContent>
                {licitacionSuppliers.length > 0 ? (
                  <div className="space-y-4">
                    {licitacionSuppliers.map((ls) => (
                      <div key={ls.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Licitación {ls.licitacion_id}</span>
                          <Badge variant={ls.status === 'awarded' ? 'default' : 'secondary'}>
                            {ls.status === 'awarded' ? 'Adjudicado' :
                             ls.status === 'evaluated' ? 'Evaluado' :
                             ls.status === 'rejected' ? 'Rechazado' : 'Registrado'}
                          </Badge>
                        </div>
                        <div className="grid gap-2 md:grid-cols-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Nota Admin: </span>
                            <span className="font-medium">{ls.administrative_score?.toFixed(1) || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Nota Técnica: </span>
                            <span className="font-medium">{ls.technical_score?.toFixed(1) || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Nota Final: </span>
                            <span className="font-medium">{ls.final_weighted_score?.toFixed(1) || 'N/A'}</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Registrado el {formatDate(ls.registered_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No ha participado en licitaciones</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documentos Tab */}
          <TabsContent value="documents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5" />
                  Documentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* NDA Status */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {supplier.nda_signed ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-600" />
                      )}
                      <div>
                        <p className="font-medium">Acuerdo de Confidencialidad (NDA)</p>
                        <p className="text-sm text-muted-foreground">
                          {supplier.nda_signed ? 'Firmado' : 'No firmado'}
                          {supplier.nda_signed_date && ` el ${formatDate(supplier.nda_signed_date)}`}
                        </p>
                      </div>
                    </div>
                    {supplier.nda_file_path && (
                      <Button variant="outline" size="sm" onClick={downloadNDA}>
                        <Download className="mr-2 h-4 w-4" />
                        Descargar
                      </Button>
                    )}
                  </div>

                  {/* Other Documents Placeholder */}
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No hay otros documentos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}
