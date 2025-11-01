'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import type { RfxTemplate, RfxCompanyPolicy } from '@/types/rfx-maker'

export default function NewRfxProjectPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [templates, setTemplates] = useState<RfxTemplate[]>([])
  const [activePolicy, setActivePolicy] = useState<RfxCompanyPolicy | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    rfx_type: 'RFP' as 'RFP' | 'RFQ' | 'RFI',
    template_id: '',
    project_context: {
      industry: '',
      project_budget: '',
      deadline: '',
      special_requirements: [] as string[],
    }
  })

  useEffect(() => {
    loadTemplatesAndPolicy()
  }, [])

  const loadTemplatesAndPolicy = async () => {
    try {
      const supabase = supabaseBrowser()

      // Cargar plantillas activas
      const { data: templatesData, error: templatesError } = await supabase
        .from('rfx_templates')
        .select('*')
        .eq('is_active_version', true)
        .eq('status', 'active')

      if (templatesError) throw templatesError
      setTemplates(templatesData || [])

      // Cargar política activa
      const { data: policyData, error: policyError } = await supabase
        .from('rfx_company_policies')
        .select('*')
        .eq('is_active', true)
        .single()

      if (!policyError && policyData) {
        setActivePolicy(policyData)
      }

      // Seleccionar primera plantilla por defecto
      if (templatesData && templatesData.length > 0) {
        setFormData(prev => ({ ...prev, template_id: templatesData[0].id }))
      }
    } catch (error) {
      console.error('Error loading data:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudieron cargar las plantillas'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const validateForm = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []

    // Validaciones requeridas
    if (!formData.title || formData.title.trim().length === 0) {
      errors.push('El título es requerido')
    }

    if (formData.title && formData.title.length < 10) {
      errors.push('El título debe tener al menos 10 caracteres')
    }

    if (formData.title && formData.title.length > 200) {
      errors.push('El título no puede exceder 200 caracteres')
    }

    if (!formData.template_id) {
      errors.push('Debes seleccionar una plantilla')
    }

    if (!formData.rfx_type) {
      errors.push('Debes seleccionar un tipo de RFx')
    }

    // Validaciones opcionales pero con formato
    if (formData.project_context.project_budget) {
      const budget = formData.project_context.project_budget
      if (isNaN(Number(budget)) || Number(budget) < 0) {
        errors.push('El presupuesto debe ser un número positivo')
      }
    }

    if (formData.project_context.deadline) {
      const deadline = new Date(formData.project_context.deadline)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (deadline < today) {
        errors.push('La fecha límite no puede ser en el pasado')
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validar formulario
    const validation = validateForm()
    if (!validation.isValid) {
      addToast({
        type: 'error',
        title: 'Errores de validación',
        message: validation.errors.join('. ')
      })
      return
    }

    setIsSaving(true)

    try {
      const supabase = supabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) throw new Error('Usuario no autenticado')

      // Obtener company_id del usuario
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile) throw new Error('Perfil no encontrado')

      // Obtener template seleccionado
      const selectedTemplate = templates.find(t => t.id === formData.template_id)
      if (!selectedTemplate) throw new Error('Plantilla no encontrada')

      // Generar código de proyecto
      const projectCode = `RFX-${Date.now().toString().slice(-6)}`

      // Crear proyecto
      const { data: newProject, error } = await supabase
        .from('rfx_projects')
        .insert({
          company_id: profile.company_id,
          project_code: projectCode,
          title: formData.title,
          description: formData.description,
          rfx_type: formData.rfx_type,
          template_id: formData.template_id,
          template_version_snapshot: selectedTemplate.version_number,
          policy_snapshot: activePolicy?.policy_values || {},
          admin_parameters: activePolicy?.policy_values || {},
          project_context: formData.project_context,
          status: 'draft',
          technical_base_is_valid: false,
          technical_base_manually_edited: false,
          responsible_user_id: user.id,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) throw error

      addToast({
        type: 'success',
        title: 'Proyecto creado',
        message: `Proyecto ${projectCode} creado exitosamente`
      })

      router.push(`/rfx-maker/${newProject.id}`)
    } catch (error) {
      console.error('Error creating project:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo crear el proyecto'
      })
    } finally {
      setIsSaving(false)
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

  if (templates.length === 0) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <h2 className="text-2xl font-bold mb-4">No hay plantillas disponibles</h2>
              <p className="text-gray-600 mb-6">
                Necesitas que un administrador cree una plantilla administrativa antes de poder crear proyectos RFx.
              </p>
              <Button onClick={() => router.push('/rfx-maker')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push('/rfx-maker')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Nuevo Proyecto RFx</h1>
            <p className="text-gray-600 mt-1">
              Crea un nuevo proyecto de bases administrativas y técnicas
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Información del Proyecto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tipo de RFx */}
              <div className="space-y-2">
                <Label htmlFor="rfx_type">Tipo de RFx *</Label>
                <select
                  id="rfx_type"
                  value={formData.rfx_type}
                  onChange={(e) => setFormData({ ...formData, rfx_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="RFP">RFP - Request for Proposal</option>
                  <option value="RFQ">RFQ - Request for Quotation</option>
                  <option value="RFI">RFI - Request for Information</option>
                </select>
              </div>

              {/* Título */}
              <div className="space-y-2">
                <Label htmlFor="title">Título del Proyecto *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ej: Licitación Servicios de Mantenimiento 2025"
                  required
                />
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción breve del proyecto..."
                  rows={3}
                />
              </div>

              {/* Plantilla */}
              <div className="space-y-2">
                <Label htmlFor="template_id">Plantilla Administrativa *</Label>
                <select
                  id="template_id"
                  value={formData.template_id}
                  onChange={(e) => setFormData({ ...formData, template_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} (v{template.version_number})
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500">
                  La plantilla define la estructura de la base administrativa
                </p>
              </div>

              {/* Contexto del Proyecto */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Contexto del Proyecto (para IA)</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industria</Label>
                    <Input
                      id="industry"
                      value={formData.project_context.industry}
                      onChange={(e) => setFormData({
                        ...formData,
                        project_context: { ...formData.project_context, industry: e.target.value }
                      })}
                      placeholder="Ej: Minería, Retail, Tecnología"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="project_budget">Presupuesto Estimado</Label>
                    <Input
                      id="project_budget"
                      type="number"
                      value={formData.project_context.project_budget}
                      onChange={(e) => setFormData({
                        ...formData,
                        project_context: { ...formData.project_context, project_budget: e.target.value }
                      })}
                      placeholder="Monto en CLP"
                    />
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <Label htmlFor="deadline">Plazo de Ejecución</Label>
                  <Input
                    id="deadline"
                    value={formData.project_context.deadline}
                    onChange={(e) => setFormData({
                      ...formData,
                      project_context: { ...formData.project_context, deadline: e.target.value }
                    })}
                    placeholder="Ej: 6 meses, 1 año"
                  />
                </div>

                <p className="text-sm text-gray-500 mt-4">
                  Esta información ayudará a la IA a generar una base técnica más precisa y contextualizada
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/rfx-maker')}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Crear Proyecto
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  )
}

