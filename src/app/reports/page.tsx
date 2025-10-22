'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  FileText,
  Download,
  Calendar,
  Filter,
  BarChart3,
  PieChart,
  TrendingUp,
  Search,
  Plus
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { useToast } from '@/components/ui/toast'
import { ReportsService, ReportParameters } from '@/lib/reports-service'

interface Report {
  id: string
  name: string
  type: string
  description: string | null
  created_at: string
  created_by: string
  status: string
}

const reportTypes = {
  spend_analysis: 'Análisis de Gastos',
  project_status: 'Estado de Proyectos',
  vendor_performance: 'Rendimiento de Proveedores',
  budget_tracking: 'Seguimiento de Presupuesto',
  compliance: 'Cumplimiento'
}

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  generating: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800'
}

const statusLabels = {
  draft: 'Borrador',
  generating: 'Generando',
  completed: 'Completado',
  failed: 'Error'
}

export default function ReportsPage() {
  const supabase = supabaseBrowser()
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const { addToast } = useToast()

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    try {
      setLoading(true)
      setError(null)

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

        // Load reports from database (temporary mock data until DB is configured)
        try {
          const reportsData = await ReportsService.getCompanyReports(profile.company_id)
          setReports(reportsData)
        } catch (reportsError) {
          // If reports table doesn't exist yet, use mock data
          console.log('Reports table not configured yet, using mock data')
          const mockReports: Report[] = [
            {
              id: '1',
              name: 'Análisis de Gastos Q4 2024',
              type: 'spend_analysis',
              description: 'Análisis detallado de gastos del cuarto trimestre',
              created_at: new Date().toISOString(),
              status: 'completed'
            },
            {
              id: '2',
              name: 'Estado de Proyectos Activos',
              type: 'project_status',
              description: 'Reporte de estado actual de todos los proyectos',
              created_at: new Date(Date.now() - 86400000).toISOString(),
              status: 'completed'
            },
            {
              id: '3',
              name: 'Rendimiento de Proveedores',
              type: 'vendor_performance',
              description: 'Evaluación de rendimiento de proveedores principales',
              created_at: new Date(Date.now() - 172800000).toISOString(),
              status: 'generating'
            }
          ]
          setReports(mockReports)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar reportes')
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudieron cargar los reportes'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateReport = async (type: string) => {
    if (!user || !company) return

    try {
      addToast({
        type: 'info',
        title: 'Generando reporte',
        message: 'El reporte se está generando, esto puede tomar unos minutos...'
      })

      // Simular generación de reporte (hasta que se configure la DB)
      setTimeout(() => {
        const reportName = `${reportTypes[type as keyof typeof reportTypes]} - ${new Date().toLocaleDateString('es-ES')}`
        const newReport: Report = {
          id: Date.now().toString(),
          name: reportName,
          type: type,
          description: `Reporte generado automáticamente el ${new Date().toLocaleDateString('es-ES')}`,
          created_at: new Date().toISOString(),
          status: 'completed'
        }

        setReports(prev => [newReport, ...prev])

        addToast({
          type: 'success',
          title: 'Reporte generado',
          message: 'El reporte ha sido generado exitosamente'
        })
      }, 2000)

    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo generar el reporte'
      })
    }
  }

  const handleDownloadReport = async (reportId: string) => {
    try {
      addToast({
        type: 'info',
        title: 'Descargando reporte',
        message: 'Preparando descarga...'
      })

      // Buscar el reporte
      const report = reports.find(r => r.id === reportId)
      if (!report) {
        throw new Error('Reporte no encontrado')
      }

      // Simular descarga (hasta que se configure la DB)
      setTimeout(() => {
        // Crear un archivo CSV de ejemplo
        const csvContent = `Tipo,Descripción,Fecha Generado
${report.type},${report.description},${new Date(report.created_at).toLocaleDateString('es-ES')}
`

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${report.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)

        addToast({
          type: 'success',
          title: 'Descarga iniciada',
          message: 'El reporte se está descargando'
        })
      }, 1000)

    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo descargar el reporte'
      })
    }
  }

  const filteredReports = reports.filter(report =>
    report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (report.description && report.description.toLowerCase().includes(searchQuery.toLowerCase()))
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
          title="Error al cargar reportes"
          message={error}
          onRetry={loadReports}
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
            <h1 className="text-3xl font-bold tracking-tight">Reportes</h1>
            <p className="text-muted-foreground">
              Genera y gestiona reportes de análisis y seguimiento
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Reporte
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleGenerateReport('spend_analysis')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Análisis de Gastos</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Generar reporte de análisis de gastos
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleGenerateReport('project_status')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estado de Proyectos</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Reporte de estado de proyectos
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleGenerateReport('vendor_performance')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rendimiento de Proveedores</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Evaluación de proveedores
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleGenerateReport('budget_tracking')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Seguimiento de Presupuesto</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Control de presupuestos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar reportes..."
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

        {/* Reports List */}
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <Card key={report.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold">{report.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[report.status as keyof typeof statusColors]}`}>
                        {statusLabels[report.status as keyof typeof statusLabels]}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {reportTypes[report.type as keyof typeof reportTypes]}
                    </p>
                    {report.description && (
                      <p className="text-sm text-muted-foreground">
                        {report.description}
                      </p>
                    )}
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(report.created_at)}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {report.status === 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadReport(report.id)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Descargar
                      </Button>
                    )}
                    {report.status === 'generating' && (
                      <Button variant="outline" size="sm" disabled>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
                        Generando...
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredReports.length === 0 && reports.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay reportes</h3>
              <p className="text-muted-foreground text-center mb-4">
                Genera tu primer reporte para comenzar el análisis
              </p>
              <Button onClick={() => handleGenerateReport('spend_analysis')}>
                <Plus className="mr-2 h-4 w-4" />
                Generar Reporte
              </Button>
            </CardContent>
          </Card>
        )}

        {/* No Results */}
        {filteredReports.length === 0 && reports.length > 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No se encontraron reportes</h3>
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
