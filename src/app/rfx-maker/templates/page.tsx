'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabaseBrowser } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Edit,
  Copy,
  Trash2,
  CheckCircle,
  Circle,
  Loader2,
  FileText,
  Settings,
  ArrowLeft
} from 'lucide-react'
import type { RfxTemplate } from '@/types/rfx-maker'

export default function TemplatesAdminPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [templates, setTemplates] = useState<RfxTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    checkPermissions()
    loadTemplates()
  }, [])

  const checkPermissions = async () => {
    try {
      const supabase = supabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
        addToast({
          type: 'error',
          title: 'Acceso denegado',
          message: 'Solo administradores pueden acceder a esta sección'
        })
        router.push('/rfx-maker')
        return
      }

      setUserRole(profile.role)
    } catch (error) {
      console.error('Error checking permissions:', error)
      router.push('/rfx-maker')
    }
  }

  const loadTemplates = async () => {
    try {
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('rfx_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTemplates(data || [])
    } catch (error) {
      console.error('Error loading templates:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudieron cargar las plantillas'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleActivateTemplate = async (templateId: string) => {
    try {
      const supabase = supabaseBrowser()

      // Desactivar todas las plantillas primero
      await supabase
        .from('rfx_templates')
        .update({ is_active_version: false })
        .eq('status', 'active')

      // Activar la seleccionada
      const { error } = await supabase
        .from('rfx_templates')
        .update({ is_active_version: true })
        .eq('id', templateId)

      if (error) throw error

      addToast({
        type: 'success',
        title: 'Plantilla activada',
        message: 'La plantilla ahora es la versión activa para nuevos proyectos'
      })

      loadTemplates()
    } catch (error) {
      console.error('Error activating template:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo activar la plantilla'
      })
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta plantilla? Esta acción no se puede deshacer.')) {
      return
    }

    try {
      const supabase = supabaseBrowser()
      const { error } = await supabase
        .from('rfx_templates')
        .delete()
        .eq('id', templateId)

      if (error) throw error

      addToast({
        type: 'success',
        title: 'Plantilla eliminada',
        message: 'La plantilla se eliminó correctamente'
      })

      loadTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo eliminar la plantilla'
      })
    }
  }

  const handleDuplicateTemplate = async (template: RfxTemplate) => {
    try {
      const supabase = supabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) throw new Error('Usuario no autenticado')

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile) throw new Error('Perfil no encontrado')

      const { data: newTemplate, error } = await supabase
        .from('rfx_templates')
        .insert({
          company_id: profile.company_id,
          name: `${template.name} (Copia)`,
          description: template.description,
          version_number: 1,
          template_structure: template.template_structure,
          placeholder_definitions: template.placeholder_definitions,
          status: 'draft',
          is_active_version: false,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) throw error

      addToast({
        type: 'success',
        title: 'Plantilla duplicada',
        message: 'Se creó una copia de la plantilla'
      })

      loadTemplates()
    } catch (error) {
      console.error('Error duplicating template:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo duplicar la plantilla'
      })
    }
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/rfx-maker')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Plantillas Administrativas</h1>
              <p className="text-gray-600 mt-1">
                Gestiona las plantillas de bases administrativas (solo Admin)
              </p>
            </div>
          </div>
          <Button onClick={() => router.push('/rfx-maker/templates/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Plantilla
          </Button>
        </div>

        {/* Templates List */}
        {templates.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay plantillas</h3>
              <p className="text-gray-600 mb-6">
                Crea tu primera plantilla administrativa para empezar a generar proyectos RFx
              </p>
              <Button onClick={() => router.push('/rfx-maker/templates/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera Plantilla
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {templates.map((template) => (
              <Card key={template.id} className={template.is_active_version ? 'border-2 border-green-500' : ''}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold">{template.name}</h3>
                        <Badge variant={template.status === 'active' ? 'success' : 'secondary'}>
                          {template.status}
                        </Badge>
                        {template.is_active_version && (
                          <Badge className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Activa
                          </Badge>
                        )}
                        <span className="text-sm text-gray-500">v{template.version_number}</span>
                      </div>
                      {template.description && (
                        <p className="text-gray-600 mb-3">{template.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>
                          Creada: {new Date(template.created_at).toLocaleDateString('es-CL')}
                        </span>
                        {template.updated_at && (
                          <span>
                            Actualizada: {new Date(template.updated_at).toLocaleDateString('es-CL')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {!template.is_active_version && template.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActivateTemplate(template.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Activar
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/rfx-maker/templates/${template.id}`)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicateTemplate(template)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Settings className="h-6 w-6 text-blue-600 mt-1" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Sobre las Plantillas Administrativas</h3>
                <ul className="space-y-1 text-sm text-blue-800">
                  <li>• Las plantillas definen la estructura de las bases administrativas</li>
                  <li>• Solo puede haber una plantilla activa a la vez</li>
                  <li>• La plantilla activa se usa para todos los nuevos proyectos</li>
                  <li>• Cada proyecto guarda un snapshot de la plantilla usada</li>
                  <li>• El versionado permite mantener historial de cambios</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

