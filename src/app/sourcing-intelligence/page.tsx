'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabaseBrowser } from '@/lib/supabase'
import { Brain, Upload, FileSpreadsheet, TrendingUp, Target, CheckCircle, Clock, AlertCircle, Plus } from 'lucide-react'
import { SIUpload } from '@/types'

export default function SourcingIntelligencePage() {
  const router = useRouter()
  const supabase = supabaseBrowser()
  
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [uploads, setUploads] = useState<SIUpload[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Obtener sesión
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Obtener perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('*, companies(*)')
        .eq('id', session.user.id)
        .single()

      if (profile) {
        setUser(profile)
        setCompany(profile.companies)

        // Obtener uploads
        const { data: uploadsData } = await supabase
          .from('si_uploads')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false })

        if (uploadsData) {
          setUploads(uploadsData)
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'uploaded':
        return { label: 'Cargado', color: 'bg-blue-500', icon: Upload }
      case 'processing':
        return { label: 'Procesando', color: 'bg-yellow-500', icon: Clock }
      case 'classified':
        return { label: 'Clasificado', color: 'bg-purple-500', icon: Brain }
      case 'reviewed':
        return { label: 'Revisado', color: 'bg-indigo-500', icon: CheckCircle }
      case 'completed':
        return { label: 'Completado', color: 'bg-green-500', icon: CheckCircle }
      case 'error':
        return { label: 'Error', color: 'bg-red-500', icon: AlertCircle }
      default:
        return { label: status, color: 'bg-gray-500', icon: FileSpreadsheet }
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <Brain className="h-8 w-8" style={{ color: '#2AD4D2' }} />
              <span>Sourcing Intelligence</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Analiza archivos de gasto con IA, genera planes de compras automáticos y visualiza la Matriz de Kraljic
            </p>
          </div>
          <Button
            onClick={() => router.push('/sourcing-intelligence/upload')}
            size="lg"
            className="bg-gradient-to-r from-[#2AD4D2] to-[#3BE7AE] hover:opacity-90"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nuevo Análisis
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Archivos Analizados</CardTitle>
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uploads.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Líneas Procesadas</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {uploads.reduce((sum, u) => sum + u.processed_rows, 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Planes Generados</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {uploads.filter(u => u.status === 'completed').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En Proceso</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {uploads.filter(u => ['processing', 'classified', 'reviewed'].includes(u.status)).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Uploads List */}
        <Card>
          <CardHeader>
            <CardTitle>Historial de Análisis</CardTitle>
            <CardDescription>
              Gestiona tus análisis de gasto y accede a los planes generados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {uploads.length === 0 ? (
              <div className="text-center py-12">
                <Brain className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium mb-2">No hay análisis aún</h3>
                <p className="text-muted-foreground mb-6">
                  Sube tu primer archivo Excel o CSV para comenzar
                </p>
                <Button
                  onClick={() => router.push('/sourcing-intelligence/upload')}
                  className="bg-gradient-to-r from-[#2AD4D2] to-[#3BE7AE]"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Subir Archivo
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {uploads.map((upload) => {
                  const statusInfo = getStatusInfo(upload.status)
                  const StatusIcon = statusInfo.icon

                  return (
                    <div
                      key={upload.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => {
                        if (upload.status === 'processing' || upload.status === 'uploaded') {
                          router.push(`/sourcing-intelligence/${upload.id}/classify`)
                        } else if (upload.status === 'completed') {
                          router.push(`/sourcing-intelligence/${upload.id}/plan`)
                        } else {
                          router.push(`/sourcing-intelligence/${upload.id}/classify`)
                        }
                      }}
                    >
                      <div className="flex items-center space-x-4 flex-1">
                        <div className={`p-3 rounded-lg ${statusInfo.color} bg-opacity-10`}>
                          <StatusIcon className={`h-6 w-6 ${statusInfo.color.replace('bg-', 'text-')}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{upload.file_name}</h4>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                            <span>{formatBytes(upload.file_size)}</span>
                            <span>•</span>
                            <span>{upload.total_rows} líneas</span>
                            <span>•</span>
                            <span>{formatDate(upload.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color} bg-opacity-10 ${statusInfo.color.replace('bg-', 'text-')}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {upload.processed_rows} / {upload.total_rows} procesadas
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (upload.status === 'completed') {
                              router.push(`/sourcing-intelligence/${upload.id}/plan`)
                            } else {
                              router.push(`/sourcing-intelligence/${upload.id}/classify`)
                            }
                          }}
                        >
                          Ver Detalles →
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

