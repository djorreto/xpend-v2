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
  Building2,
  FileText,
  Phone,
  Mail,
  Globe,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  Trash2,
  Eye,
  Calendar,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useVersion } from '@/contexts/version-context'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { useToast } from '@/components/ui/toast'
import {
  mockSuppliersData,
  mockAdministrativeEvaluationsData,
  mockLicitacionSuppliersData
} from '@/lib/mock-data'
import type {
  Supplier,
  AdministrativeEvaluation,
  LicitacionSupplier,
  ServiceType,
  SupplierFilters,
  EvaluationTrafficLight
} from '@/types'

const serviceTypeLabels: Record<ServiceType, string> = {
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

export default function SuppliersPage() {
  const router = useRouter()
  const { isMockup } = useVersion()
  const { addToast } = useToast()

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [administrativeEvaluations, setAdministrativeEvaluations] = useState<AdministrativeEvaluation[]>([])
  const [licitacionSuppliers, setLicitacionSuppliers] = useState<LicitacionSupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [filters, setFilters] = useState<SupplierFilters>({})
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadSuppliers()
  }, [isMockup])

  const loadSuppliers = async () => {
    try {
      setLoading(true)
      setError(null)

      // Check if we're in mockup mode
      if (isMockup) {
        // Use mock data in mockup mode
        setUser({
          name: 'Usuario Demo',
          email: 'demo@xpend.cl',
          role: 'admin'
        })

        setCompany({
          name: 'Xpend',
          id: '550e8400-e29b-41d4-a716-446655440000'
        })

        setSuppliers(mockSuppliersData as Supplier[])
        setAdministrativeEvaluations(mockAdministrativeEvaluationsData as AdministrativeEvaluation[])
        setLicitacionSuppliers(mockLicitacionSuppliersData as LicitacionSupplier[])
        return
      }

      // In functional mode, try to connect to Supabase
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

      // Fetch suppliers with relations
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select(`
          *,
          created_by_user:profiles!created_by(id, full_name, email)
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })

      if (suppliersError) throw suppliersError

      setSuppliers(suppliersData || [])

      // Fetch administrative evaluations
      const { data: adminEvalData, error: adminEvalError } = await supabase
        .from('administrative_evaluations')
        .select(`
          *,
          evaluator:profiles!evaluator_id(id, full_name, email)
        `)
        .eq('company_id', profile.company_id)

      if (adminEvalError) throw adminEvalError

      setAdministrativeEvaluations(adminEvalData || [])

      // Fetch licitacion suppliers
      const { data: licitacionSuppliersData, error: licitacionSuppliersError } = await supabase
        .from('licitacion_suppliers')
        .select(`
          *,
          supplier:suppliers(id, fantasy_name, legal_name, rut)
        `)
        .eq('company_id', profile.company_id)

      if (licitacionSuppliersError) throw licitacionSuppliersError

      setLicitacionSuppliers(licitacionSuppliersData || [])

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar proveedores')
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudieron cargar los proveedores'
      })
    } finally {
      setLoading(false)
    }
  }

  const getEvaluationTrafficLight = (supplier: Supplier): EvaluationTrafficLight => {
    const evaluation = administrativeEvaluations.find(evaluation => evaluation.supplier_id === supplier.id)

    if (!evaluation) {
      return {
        status: 'pending',
        color: 'gray',
        message: 'Sin evaluación'
      }
    }

    const today = new Date()
    const validUntil = new Date(evaluation.valid_until)

    if (validUntil < today) {
      return {
        status: 'expired',
        color: 'red',
        message: 'Evaluación expirada',
        score: evaluation.final_score
      }
    }

    if (evaluation.final_score === undefined || evaluation.final_score === null) {
      return {
        status: 'incomplete',
        color: 'yellow',
        message: 'Evaluación incompleta'
      }
    }

    if (evaluation.final_score >= 80) {
      return {
        status: 'valid',
        color: 'green',
        message: 'Evaluación vigente',
        score: evaluation.final_score
      }
    } else if (evaluation.final_score >= 60) {
      return {
        status: 'valid',
        color: 'yellow',
        message: 'Evaluación vigente',
        score: evaluation.final_score
      }
    } else {
      return {
        status: 'valid',
        color: 'red',
        message: 'Evaluación vigente',
        score: evaluation.final_score
      }
    }
  }

  const getSupplierParticipationCount = (supplierId: string): number => {
    return licitacionSuppliers.filter(ls => ls.supplier_id === supplierId).length
  }

  const filteredSuppliers = suppliers.filter(supplier => {
    // Filtro de búsqueda
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!supplier.fantasy_name.toLowerCase().includes(query) &&
          !supplier.legal_name.toLowerCase().includes(query) &&
          !supplier.rut.toLowerCase().includes(query) &&
          !supplier.contact_name?.toLowerCase().includes(query)) {
        return false
      }
    }

    // Filtro por tipo de servicio
    if (filters.service_type && supplier.service_type !== filters.service_type) {
      return false
    }

    // Filtro por NDA firmado
    if (filters.nda_signed !== undefined && supplier.nda_signed !== filters.nda_signed) {
      return false
    }

    // Filtro por evaluación válida
    if (filters.evaluation_valid !== undefined) {
      const trafficLight = getEvaluationTrafficLight(supplier)
      const isValid = trafficLight.status === 'valid'
      if (filters.evaluation_valid !== isValid) {
        return false
      }
    }

    // Filtro por estado activo
    if (filters.is_active !== undefined && supplier.is_active !== filters.is_active) {
      return false
    }

    return true
  })

  const handleDeleteSupplier = async (supplierId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este proveedor?')) {
      return
    }

    try {
      if (isMockup) {
        // In mockup mode, just show success message
        addToast({
          type: 'success',
          title: 'Proveedor eliminado',
          message: 'El proveedor ha sido eliminado correctamente (modo demo)'
        })
        loadSuppliers()
        return
      }

      // In functional mode, delete from Supabase
      const supabase = supabaseBrowser()
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplierId)

      if (error) throw error

      addToast({
        type: 'success',
        title: 'Proveedor eliminado',
        message: 'El proveedor ha sido eliminado correctamente'
      })
      loadSuppliers()
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo eliminar el proveedor'
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
          title="Error al cargar proveedores"
          message={error}
          onRetry={loadSuppliers}
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
            <h1 className="text-3xl font-bold tracking-tight">Proveedores</h1>
            <p className="text-muted-foreground">
              Gestiona todos tus proveedores y sus evaluaciones
            </p>
            {isMockup && (
              <div className="mt-2">
                <Badge variant="outline" className="text-xs">
                  Modo Demo - Datos Mock
                </Badge>
              </div>
            )}
          </div>
          <Button onClick={() => router.push('/suppliers/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Proveedor
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
                    placeholder="Buscar por nombre, RUT o contacto..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <Select
                value={filters.service_type || 'all'}
                onValueChange={(value) => setFilters(prev => ({
                  ...prev,
                  service_type: value === 'all' ? undefined : value as ServiceType
                }))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Tipo de servicio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los servicios</SelectItem>
                  {Object.entries(serviceTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.nda_signed === undefined ? 'all' : filters.nda_signed.toString()}
                onValueChange={(value) => setFilters(prev => ({
                  ...prev,
                  nda_signed: value === 'all' ? undefined : value === 'true'
                }))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="NDA" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="true">NDA Firmado</SelectItem>
                  <SelectItem value="false">Sin NDA</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.evaluation_valid === undefined ? 'all' : filters.evaluation_valid.toString()}
                onValueChange={(value) => setFilters(prev => ({
                  ...prev,
                  evaluation_valid: value === 'all' ? undefined : value === 'true'
                }))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Evaluación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="true">Evaluación Válida</SelectItem>
                  <SelectItem value="false">Sin Evaluación</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Suppliers Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium">Proveedor</th>
                    <th className="text-left p-4 font-medium">Servicio</th>
                    <th className="text-left p-4 font-medium">Contacto</th>
                    <th className="text-center p-4 font-medium">NDA</th>
                    <th className="text-center p-4 font-medium">Evaluación</th>
                    <th className="text-center p-4 font-medium">Participaciones</th>
                    <th className="text-center p-4 font-medium">Estado</th>
                    <th className="text-center p-4 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((supplier) => {
                    const trafficLight = getEvaluationTrafficLight(supplier)
                    const participationCount = getSupplierParticipationCount(supplier.id)

                    return (
                      <tr key={supplier.id} className="border-b hover:bg-muted/30 transition-colors">
                        {/* Proveedor */}
                        <td className="p-4">
                          <div className="space-y-1">
                            <div className="font-medium">{supplier.fantasy_name}</div>
                            <div className="text-sm text-muted-foreground">{supplier.legal_name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{supplier.rut}</div>
                          </div>
                        </td>

                        {/* Servicio */}
                        <td className="p-4">
                          <Badge variant="outline">
                            {serviceTypeLabels[supplier.service_type as ServiceType]}
                          </Badge>
                        </td>

                        {/* Contacto */}
                        <td className="p-4">
                          <div className="space-y-1">
                            {supplier.contact_name && (
                              <div className="text-sm font-medium">{supplier.contact_name}</div>
                            )}
                            {supplier.contact_email && (
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Mail className="h-3 w-3 mr-1" />
                                {supplier.contact_email}
                              </div>
                            )}
                            {supplier.contact_phone && (
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Phone className="h-3 w-3 mr-1" />
                                {supplier.contact_phone}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* NDA */}
                        <td className="p-4 text-center">
                          {supplier.nda_signed ? (
                            <div className="flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </div>
                          ) : (
                            <div className="flex items-center justify-center">
                              <XCircle className="h-4 w-4 text-red-600" />
                            </div>
                          )}
                        </td>

                        {/* Evaluación */}
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center">
                            <div className={`w-3 h-3 rounded-full mr-2 ${
                              trafficLight.color === 'green' ? 'bg-green-500' :
                              trafficLight.color === 'yellow' ? 'bg-yellow-500' :
                              trafficLight.color === 'red' ? 'bg-red-500' : 'bg-gray-500'
                            }`} />
                            <div className="text-sm">
                              {trafficLight.score ? `${trafficLight.score.toFixed(1)}` : '-'}
                            </div>
                          </div>
                        </td>

                        {/* Participaciones */}
                        <td className="p-4 text-center">
                          <div className="text-sm font-medium">{participationCount}</div>
                        </td>

                        {/* Estado */}
                        <td className="p-4 text-center">
                          <Badge className={supplier.is_active ? statusColors.active : statusColors.inactive}>
                            {supplier.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>

                        {/* Acciones */}
                        <td className="p-4">
                          <div className="flex items-center justify-center space-x-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/suppliers/${supplier.id}`)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/suppliers/${supplier.id}/edit`)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            {!isMockup && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteSupplier(supplier.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
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
        {filteredSuppliers.length === 0 && suppliers.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay proveedores</h3>
              <p className="text-muted-foreground text-center mb-4">
                Comienza agregando tu primer proveedor
              </p>
              <Button onClick={() => router.push('/suppliers/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar Proveedor
              </Button>
            </CardContent>
          </Card>
        )}

        {/* No Results */}
        {filteredSuppliers.length === 0 && suppliers.length > 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No se encontraron proveedores</h3>
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
