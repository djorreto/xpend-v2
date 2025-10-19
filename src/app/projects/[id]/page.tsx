'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  FileText, 
  MessageSquare,
  Calendar,
  DollarSign,
  User,
  Plus
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { useToast } from '@/components/ui/toast'

interface Project {
  id: string
  name: string
  description: string | null
  status: string
  start_date: string
  end_date: string | null
  budget: number | null
  currency: string
  created_at: string
  updated_at: string
}

interface ProjectFile {
  id: string
  name: string
  file_path: string
  file_size: number
  mime_type: string
  uploaded_by: string
  created_at: string
}

interface ProjectComment {
  id: string
  content: string
  user_id: string
  created_at: string
  profiles: {
    full_name: string
    email: string
  }
}

const statusColors = {
  planning: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  on_hold: 'bg-orange-100 text-orange-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800'
}

const statusLabels = {
  planning: 'Planificación',
  active: 'Activo',
  on_hold: 'En Pausa',
  completed: 'Completado',
  cancelled: 'Cancelado'
}

export default function ProjectDetailPage() {
  const supabase = supabaseBrowser()
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [comments, setComments] = useState<ProjectComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'comments'>('overview')
  const router = useRouter()
  const params = useParams()
  const { addToast } = useToast()

  const projectId = params.id as string

  useEffect(() => {
    if (projectId) {
      loadProjectData()
    }
  }, [projectId])

  const loadProjectData = async () => {
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
      }

      // Load project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (projectError || !projectData) {
        throw new Error('Proyecto no encontrado')
      }

      setProject(projectData)

      // Load files
      const { data: filesData, error: filesError } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (filesError) throw filesError
      setFiles(filesData || [])

      // Load comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('project_comments')
        .select(`
          *,
          profiles!inner(full_name, email)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (commentsError) throw commentsError
      setComments(commentsData || [])

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar proyecto')
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo cargar el proyecto'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar este proyecto?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (error) throw error

      addToast({
        type: 'success',
        title: 'Proyecto eliminado',
        message: 'El proyecto ha sido eliminado correctamente'
      })

      router.push('/projects')
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo eliminar el proyecto'
      })
    }
  }

  if (loading) {
    return (
      <MainLayout user={user} companyName={company?.name || 'Spendora'}>
        <LoadingSpinner />
      </MainLayout>
    )
  }

  if (error || !project) {
    return (
      <MainLayout user={user} companyName={company?.name || 'Spendora'}>
        <ErrorMessage 
          title="Error al cargar proyecto"
          message={error || 'Proyecto no encontrado'}
          onRetry={loadProjectData}
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name || 'Spendora'}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
              <p className="text-muted-foreground">
                {project.description || 'Sin descripción'}
              </p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/edit`)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
            <Button variant="outline" onClick={handleDeleteProject}>
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          </div>
        </div>

        {/* Project Info */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Estado</CardTitle>
            </CardHeader>
            <CardContent>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[project.status as keyof typeof statusColors]}`}>
                {statusLabels[project.status as keyof typeof statusLabels]}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Fechas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(project.start_date)} - {project.end_date ? formatDate(project.end_date) : 'Sin fecha fin'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Presupuesto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4" />
                  <span>{project.budget ? formatCurrency(project.budget, project.currency) : 'Sin presupuesto'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
              }`}
            >
              Resumen
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'files'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
              }`}
            >
              <FileText className="inline h-4 w-4 mr-2" />
              Archivos ({files.length})
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'comments'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
              }`}
            >
              <MessageSquare className="inline h-4 w-4 mr-2" />
              Comentarios ({comments.length})
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <Card>
            <CardHeader>
              <CardTitle>Información del Proyecto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Descripción</h4>
                  <p className="text-muted-foreground">
                    {project.description || 'No hay descripción disponible'}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-2">Fecha de Creación</h4>
                    <p className="text-muted-foreground">{formatDate(project.created_at)}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Última Actualización</h4>
                    <p className="text-muted-foreground">{formatDate(project.updated_at)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'files' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Archivos del Proyecto</CardTitle>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Subir Archivo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {files.length > 0 ? (
                <div className="space-y-4">
                  {files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(file.file_size / 1024 / 1024).toFixed(2)} MB • {formatDate(file.created_at)}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Descargar
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No hay archivos</h3>
                  <p className="text-muted-foreground mb-4">
                    Sube archivos relacionados con este proyecto
                  </p>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Subir Primer Archivo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'comments' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Comentarios del Proyecto</CardTitle>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Comentario
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {comments.length > 0 ? (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="border-l-4 border-primary pl-4 py-2">
                      <div className="flex items-center space-x-2 mb-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{comment.profiles.full_name}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{comment.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No hay comentarios</h3>
                  <p className="text-muted-foreground mb-4">
                    Inicia la conversación sobre este proyecto
                  </p>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Escribir Primer Comentario
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
