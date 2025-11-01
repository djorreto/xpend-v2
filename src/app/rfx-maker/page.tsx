'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  FileText,
  Settings,
  Download,
  Copy,
  Eye,
  Edit,
  Archive,
  AlertCircle,
  CheckCircle,
  Clock,
  Lock
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase'
import type { RfxProject, ProjectStatus } from '@/types/rfx-maker'

export default function RfxMakerPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<RfxProject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('')

  useEffect(() => {
    loadProjects()
    loadUserRole()
  }, [])

  const loadProjects = async () => {
    try {
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('rfx_projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadUserRole = async () => {
    try {
      const supabase = supabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        setUserRole(profile?.role || '')
      }
    } catch (error) {
      console.error('Error loading user role:', error)
    }
  }

  const getStatusIcon = (status: ProjectStatus) => {
    switch (status) {
      case 'draft':
        return <Edit className="h-4 w-4" />
      case 'ready':
        return <CheckCircle className="h-4 w-4" />
      case 'closed':
        return <Lock className="h-4 w-4" />
      case 'archived':
        return <Archive className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-500'
      case 'ready':
        return 'bg-green-500'
      case 'closed':
        return 'bg-blue-500'
      case 'archived':
        return 'bg-gray-400'
      default:
        return 'bg-gray-500'
    }
  }

  const getRfxTypeColor = (type: string) => {
    switch (type) {
      case 'RFP':
        return 'bg-purple-100 text-purple-800'
      case 'RFQ':
        return 'bg-blue-100 text-blue-800'
      case 'RFI':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const isAdmin = ['super_admin', 'admin'].includes(userRole)

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">RFx Maker</h1>
            <p className="text-gray-600 mt-1">
              Editor de Plantillas y Generación de Bases RFx
            </p>
          </div>
          <div className="flex gap-3">
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => router.push('/rfx-maker/templates')}
              >
                <Settings className="h-4 w-4 mr-2" />
                Plantillas
              </Button>
            )}
            <Button onClick={() => router.push('/rfx-maker/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Proyecto RFx
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Proyectos</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {projects.length}
                  </p>
                </div>
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">En Borrador</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {projects.filter(p => p.status === 'draft').length}
                  </p>
                </div>
                <Edit className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Listos</p>
                  <p className="text-2xl font-bold text-green-600">
                    {projects.filter(p => p.status === 'ready').length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Cerrados</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {projects.filter(p => p.status === 'closed').length}
                  </p>
                </div>
                <Lock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects List */}
        <Card>
          <CardHeader>
            <CardTitle>Proyectos RFx</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-4 text-gray-600">Cargando proyectos...</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No hay proyectos RFx creados</p>
                <Button onClick={() => router.push('/rfx-maker/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primer Proyecto
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="border rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/rfx-maker/${project.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {project.title}
                          </h3>
                          <Badge className={getRfxTypeColor(project.rfx_type)}>
                            {project.rfx_type}
                          </Badge>
                          <Badge className={getStatusColor(project.status)}>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(project.status)}
                              {project.status}
                            </span>
                          </Badge>
                        </div>

                        <p className="text-sm text-gray-600 mb-3">
                          Código: {project.project_code}
                        </p>

                        {project.description && (
                          <p className="text-sm text-gray-700 mb-3">
                            {project.description}
                          </p>
                        )}

                        {!project.technical_base_is_valid && project.status !== 'closed' && (
                          <div className="flex items-center gap-2 text-orange-600 text-sm">
                            <AlertCircle className="h-4 w-4" />
                            <span>Base técnica requiere regeneración</span>
                          </div>
                        )}

                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                          <span>Creado: {new Date(project.created_at).toLocaleDateString()}</span>
                          <span>v{project.version_number}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/rfx-maker/${project.id}`)
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>

                        {project.status !== 'archived' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                // TODO: Implement download
                              }}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Descargar
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                // TODO: Implement duplicate
                              }}
                            >
                              <Copy className="h-4 w-4 mr-1" />
                              Duplicar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

