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
import { ArrowLeft, Save, Loader2, Sparkles } from 'lucide-react'
import type { RfxTemplate, RfxCompanyPolicy } from '@/types/rfx-maker'
import { saveDossier } from '@/lib/dossier-store'
import { RFX_FIELDS, basesAreReady, basesMarkdown } from '@/lib/rfx-sections'
import { errorMessage } from '@/lib/errors'

export default function NewRfxProjectPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [planId, setPlanId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [templates, setTemplates] = useState<RfxTemplate[]>([])
  const [activePolicy, setActivePolicy] = useState<RfxCompanyPolicy | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [preparing, setPreparing] = useState(false)
  const [startDocument, setStartDocument] = useState<'tecnica' | 'administrativa'>('tecnica')
  const [fillMode, setFillMode] = useState<'directo' | 'agente'>('directo')
  const [sections, setSections] = useState<Record<string, string>>({})
  const [planMeta, setPlanMeta] = useState<{ id?: string; responsible_user_id?: string | null; estimated_spend?: number | null; category?: string | null; title?: string } | null>(null)

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
    const linkedPlan = new URLSearchParams(window.location.search).get('planId')
    if (!linkedPlan) return
    setPlanId(linkedPlan)
    const supabase = supabaseBrowser()
    supabase
      .from('sourcing_plans')
      .select('title, description, estimated_spend, category, responsible_user_id')
      .eq('id', linkedPlan)
      .single()
      .then(({ data }) => {
        if (!data) return
        setPlanMeta({ id: linkedPlan, ...data })
        setFormData(prev => ({
          ...prev,
          title: prev.title || data.title || '',
          description: prev.description || data.description || '',
          project_context: {
            ...prev.project_context,
            project_budget: prev.project_context.project_budget || (data.estimated_spend ? String(data.estimated_spend) : ''),
            special_requirements: data.category ? [data.category] : prev.project_context.special_requirements,
          },
        }))
      })
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
      const ensured = await fetch('/api/rfx-maker/ensure-template', { method: 'POST' })
      const ensuredBody = await ensured.json()
      if (ensured.ok && ensuredBody.id) {
        setFormData(prev => ({ ...prev, template_id: ensuredBody.id }))
        setTemplates(current => current.some(item => item.id === ensuredBody.id) ? current : [...current, { id: ensuredBody.id, name: 'Bases por secciones', version_number: ensuredBody.version_number || 1 } as RfxTemplate])
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
          admin_parameters: { ...activePolicy?.policy_values, ...sections },
          sourcing_plan_id: planId,
          project_context: {
            ...formData.project_context,
            ...(planId ? { sourcing_plan_id: planId } : {}),
            simple_bases: true,
            start: {
              process: formData.rfx_type,
              document: startDocument,
              mode: fillMode,
            },
          },
          technical_base_content: fillMode === 'directo' ? basesMarkdown(formData.title, formData.rfx_type, sections) : null,
          technical_base_is_valid: fillMode === 'directo' && basesAreReady(sections),
          status: 'draft',
          technical_base_manually_edited: fillMode === 'directo',
          responsible_user_id: user.id,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) throw error

      if (planId && profile.company_id) {
        await saveDossier(supabase, {
          companyId: profile.company_id,
          userId: user.id,
          title: formData.title,
          sourcingPlanId: planId,
          rfxProjectId: newProject.id,
          netSpend: formData.project_context.project_budget ? Number(formData.project_context.project_budget) : null,
          stage: 'bases',
        })
      }

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
        message: errorMessage(error, 'No se pudo crear el proyecto')
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
            <h1 className="text-xl font-semibold text-gray-900">Nuevo RFx</h1>
            <p className="text-sm text-gray-600 mt-1">
              Elige el proceso, por dónde partes y si lo llenas tú o te lo pregunta un agente.
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
              <Choice
                label="1. Tipo de proceso"
                value={formData.rfx_type}
                onChange={value => setFormData({ ...formData, rfx_type: value as 'RFP' | 'RFQ' | 'RFI' })}
                options={[
                  ['RFP', 'Propuesta'],
                  ['RFQ', 'Cotización'],
                  ['RFI', 'Información'],
                ]}
              />
              <Choice
                label="2. Por dónde empezar"
                value={startDocument}
                onChange={value => setStartDocument(value as 'tecnica' | 'administrativa')}
                options={[
                  ['tecnica', 'Bases técnicas'],
                  ['administrativa', 'Bases administrativas'],
                ]}
              />
              <Choice
                label="3. Cómo llenarlo"
                value={fillMode}
                onChange={value => setFillMode(value as 'directo' | 'agente')}
                options={[
                  ['directo', 'Lo lleno yo'],
                  ['agente', 'Que me pregunte'],
                ]}
              />
              <p className="text-sm text-muted-foreground">
                {startDocument === 'tecnica'
                  ? 'Después de las bases técnicas se arman dos tablas del mismo servicio: cotización y propuesta técnica.'
                  : 'Partes por plazos, pago y evaluación. Las tablas técnicas se arman cuando exista la base técnica.'}
                {fillMode === 'agente' ? ' En el proyecto, el agente pregunta hasta tener lo necesario para el documento.' : ' En el proyecto llenas las secciones directo.'}
              </p>

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

              {fillMode === 'directo' && (
              <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Secciones de las bases</h3>
                  <p className="text-sm text-gray-500">ANA las propone. Tú corriges el texto.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={preparing}
                  onClick={async () => {
                    setPreparing(true)
                    try {
                      const response = await fetch('/api/rfx-maker/prefill', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          title: formData.title,
                          rfx_type: formData.rfx_type,
                          description: formData.description,
                          alcance: sections.alcance || formData.description,
                          plan: planMeta || { title: formData.title },
                        }),
                      })
                      const body = await response.json()
                      if (!response.ok) {
                        addToast({ type: 'error', title: 'ANA no pudo preparar las bases', message: body.error || 'Error' })
                        return
                      }
                      setSections(body.values || {})
                    } catch {
                      addToast({ type: 'error', title: 'ANA no pudo preparar las bases', message: 'Inténtalo de nuevo.' })
                    } finally {
                      setPreparing(false)
                    }
                  }}
                >
                  {preparing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Preparar con ANA
                </Button>
              </div>
              {Array.from(new Set(RFX_FIELDS.filter(field => startDocument === 'tecnica' ? field.kind === 'technical' : field.kind === 'admin').map(field => field.section))).map(section => (
                <div key={section} className="space-y-3 rounded-xl border border-gray-200 p-4">
                  <p className="text-sm font-medium">{section}</p>
                  {RFX_FIELDS.filter(field => field.section === section && (startDocument === 'tecnica' ? field.kind === 'technical' : field.kind === 'admin')).map(field => (
                    <div key={field.key} className="space-y-1">
                      <Label htmlFor={field.key}>{field.label}</Label>
                      <Textarea
                        id={field.key}
                        rows={2}
                        value={sections[field.key] || ''}
                        onChange={(event) => setSections(current => ({ ...current, [field.key]: event.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              ))}

              </>
              )}

              {fillMode === 'directo' && (
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
              )}
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
                  {fillMode === 'agente' ? 'Empezar preguntas' : 'Crear y llenar'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  )
}

function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<[string, string]>
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map(([id, text]) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`rounded-md border px-3 py-1.5 text-sm ${value === id ? 'border-[#1B4D3E] bg-[#1B4D3E] text-white' : 'bg-white'}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

