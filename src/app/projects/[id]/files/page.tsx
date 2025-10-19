'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft, 
  Upload, 
  Download, 
  Trash2, 
  FileText,
  Loader2
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { useToast } from '@/components/ui/toast'
import { ProjectFileService } from '@/lib/storage'

interface ProjectFile {
  id: string
  name: string
  file_path: string
  file_size: number
  mime_type: string
  uploaded_by: string
  created_at: string
}

export default function ProjectFilesPage() {
  const supabase = supabaseBrowser()
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [project, setProject] = useState<any>(null)
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()
  const { addToast } = useToast()

  const projectId = params.id as string

  useEffect(() => {
    if (projectId) {
      loadData()
    }
  }, [projectId])

  const loadData = async () => {
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
      await loadFiles()

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudieron cargar los datos'
      })
    } finally {
      setLoading(false)
    }
  }

  const loadFiles = async () => {
    try {
      const { data: filesData, error: filesError } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (filesError) throw filesError
      setFiles(filesData || [])
    } catch (err) {
      throw err
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)

    try {
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

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await ProjectFileService.upload(projectId, file)
      if (uploadError) throw uploadError

      // Save file record to database
      const { data: fileRecord, error: dbError } = await supabase
        .from('project_files')
        .insert({
          project_id: projectId,
          name: file.name,
          file_path: uploadData.path,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: profile.id
        })
        .select()
        .single()

      if (dbError) throw dbError

      setFiles(prev => [fileRecord, ...prev])
      addToast({
        type: 'success',
        title: 'Archivo subido',
        message: 'El archivo ha sido subido correctamente'
      })

    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo subir el archivo'
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (file: ProjectFile) => {
    try {
      const { data, error } = await ProjectFileService.download(file.file_path)
      if (error) throw error

      // Create download link
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo descargar el archivo'
      })
    }
  }

  const handleDeleteFile = async (fileId: string, filePath: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este archivo?')) {
      return
    }

    try {
      // Delete from storage
      const { error: storageError } = await ProjectFileService.delete(filePath)
      if (storageError) throw storageError

      // Delete from database
      const { error: dbError } = await supabase
        .from('project_files')
        .delete()
        .eq('id', fileId)

      if (dbError) throw dbError

      setFiles(prev => prev.filter(f => f.id !== fileId))
      addToast({
        type: 'success',
        title: 'Archivo eliminado',
        message: 'El archivo ha sido eliminado correctamente'
      })

    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo eliminar el archivo'
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
          title="Error al cargar archivos"
          message={error || 'Proyecto no encontrado'}
          onRetry={loadData}
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
              <h1 className="text-3xl font-bold tracking-tight">Archivos del Proyecto</h1>
              <p className="text-muted-foreground">
                {project.name}
              </p>
            </div>
          </div>
          <div className="flex space-x-2">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <label htmlFor="file-upload">
              <Button asChild disabled={uploading}>
                <span>
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Subir Archivo
                    </>
                  )}
                </span>
              </Button>
            </label>
          </div>
        </div>

        {/* Files List */}
        <Card>
          <CardHeader>
            <CardTitle>Archivos ({files.length})</CardTitle>
            <CardDescription>
              Gestiona los archivos asociados a este proyecto
            </CardDescription>
          </CardHeader>
          <CardContent>
            {files.length > 0 ? (
              <div className="space-y-4">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.file_size / 1024 / 1024).toFixed(2)} MB • {formatDate(file.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDownload(file)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Descargar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteFile(file.id, file.file_path)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay archivos</h3>
                <p className="text-muted-foreground mb-4">
                  Sube archivos relacionados con este proyecto
                </p>
                <input
                  type="file"
                  id="file-upload-empty"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                <label htmlFor="file-upload-empty">
                  <Button asChild disabled={uploading}>
                    <span>
                      {uploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Subir Primer Archivo
                        </>
                      )}
                    </span>
                  </Button>
                </label>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
