'use client'

import { useState, useEffect, useRef } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs } from '@/components/ui/tabs'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import {
  ArrowLeft,
  Save,
  Download,
  Copy,
  Archive,
  Lock,
  Unlock,
  AlertCircle,
  RefreshCw,
  FileText,
  Settings as SettingsIcon,
  Loader2,
  Sparkles
} from 'lucide-react'
import type { RfxProject } from '@/types/rfx-maker'
import { RfxParamsEditor } from '@/components/forms/rfx-params-editor'
import { RfxParamsViewer } from '@/components/forms/rfx-params-viewer'
import { RfxVersionsModal } from '@/components/forms/rfx-versions-modal'
import { RfxComments } from '@/components/forms/rfx-comments'
import { RichTextEditor } from '@/components/forms/rich-text-editor'
import { RfxQuickAdminForm } from '@/components/forms/rfx-quick-admin'
import { RfxSectionBases } from '@/components/forms/rfx-section-bases'
import { RfxServiceSheets } from '@/components/forms/rfx-service-sheets'
import { DossierThread } from '@/components/dossier-thread'
import { composeBases, saveDossier } from '@/lib/dossier-store'
import { basesTextIsReady } from '@/lib/rfx-sections'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { RfxWizardQuestion } from '@/types/rfx-maker'

interface Props {
  params: { id: string }
}

export default function RfxProjectPage({ params }: Props) {
  const router = useRouter()
  const { addToast } = useToast()
  const [project, setProject] = useState<RfxProject | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<'admin' | 'technical' | 'context'>('admin')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isEditingParams, setIsEditingParams] = useState(false)
  const [showVersionsModal, setShowVersionsModal] = useState(false)
  const [isEditingTechnical, setIsEditingTechnical] = useState(false)
  const [technicalContent, setTechnicalContent] = useState('')
  const [adminBaseContent, setAdminBaseContent] = useState('')
  const [techQuestions, setTechQuestions] = useState<RfxWizardQuestion[]>([])
  const [adminQuestions, setAdminQuestions] = useState<RfxWizardQuestion[]>([])
  const [techAnswers, setTechAnswers] = useState<Record<string, string>>({})
  const [adminAnswers, setAdminAnswers] = useState<Record<string, string>>({})
  const [loadingWizardQuestions, setLoadingWizardQuestions] = useState(false)
  const wizardStarted = useRef(false)

  useEffect(() => {
    loadProject()
  }, [params.id])

  useEffect(() => {
    if (project?.technical_base_content) {
      setTechnicalContent(project.technical_base_content)
    }
    const admin = (project?.project_context as { administrative_base_content?: string } | null)?.administrative_base_content
    if (admin) setAdminBaseContent(admin)
  }, [project])

  useEffect(() => {
    if (!project?.project_context) return
    const ctx = project.project_context as Record<string, unknown>
    const wizard = ctx.wizard as
      | {
          tech?: { id: string; question: string; answer?: string }[]
          admin?: { id: string; question: string; answer?: string }[]
        }
      | undefined
    const start = ctx.start as { document?: string } | undefined
    if (start?.document === 'tecnica') setActiveTab('technical')
    if (start?.document === 'administrativa') setActiveTab('admin')
    if (!wizard) return
    if (Array.isArray(wizard.tech) && wizard.tech.length > 0) {
      setTechQuestions(wizard.tech.map((x) => ({ id: x.id, question: x.question })))
      const ta: Record<string, string> = {}
      wizard.tech.forEach((x) => {
        if (x.answer) ta[x.id] = x.answer
      })
      setTechAnswers(ta)
    }
    if (Array.isArray(wizard.admin) && wizard.admin.length > 0) {
      setAdminQuestions(wizard.admin.map((x) => ({ id: x.id, question: x.question })))
      const aa: Record<string, string> = {}
      wizard.admin.forEach((x) => {
        if (x.answer) aa[x.id] = x.answer
      })
      setAdminAnswers(aa)
    }
  }, [project?.id])

  const buildFollowUpFromState = () => {
    const ft: Record<string, string> = {}
    for (const q of techQuestions) {
      const a = techAnswers[q.id]?.trim()
      if (a) {
        const label = q.question.length > 180 ? `${q.question.slice(0, 177)}…` : q.question
        ft[label] = a
      }
    }
    const fa: Record<string, string> = {}
    for (const q of adminQuestions) {
      const a = adminAnswers[q.id]?.trim()
      if (a) {
        const label = q.question.length > 180 ? `${q.question.slice(0, 177)}…` : q.question
        fa[label] = a
      }
    }
    return { ft, fa }
  }

  const downloadDocx = async () => {
    if (!project) return
    try {
      const res = await fetch(
        `/api/rfx-maker/download?project_id=${project.id}&format=docx`,
        { credentials: 'include' }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || res.statusText)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safe = String(project.project_code || 'rfx').replace(/[^\w.-]+/g, '_')
      a.download = `${safe}_${project.rfx_type || 'RFx'}.docx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      addToast({ type: 'success', title: 'Descarga', message: 'Documento Word generado' })
    } catch (e) {
      console.error(e)
      addToast({
        type: 'error',
        title: 'Error al descargar',
        message: e instanceof Error ? e.message : 'No se pudo generar el DOCX',
      })
    }
  }

  const fetchWizardQuestions = async () => {
    if (!project) return
    setLoadingWizardQuestions(true)
    try {
      const res = await fetch('/api/rfx-maker/wizard-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: project.id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Error')
      setTechQuestions(data.technical_questions || [])
      setAdminQuestions(data.administrative_questions || [])
      addToast({
        type: 'success',
        title: 'Preguntas listas',
        message: 'Completa las respuestas y genera la base técnica',
      })
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Error',
        message: e instanceof Error ? e.message : 'No se pudieron obtener preguntas',
      })
    } finally {
      setLoadingWizardQuestions(false)
    }
  }

  useEffect(() => {
    if (!project || wizardStarted.current) return
    const ctx = project.project_context as { start?: { mode?: string }; wizard?: { tech?: unknown[]; admin?: unknown[] } } | null
    if (ctx?.start?.mode !== 'agente') return
    const pending = (ctx.wizard?.tech?.length || 0) + (ctx.wizard?.admin?.length || 0) === 0
    if (!pending) return
    wizardStarted.current = true
    void fetchWizardQuestions()
  }, [project])

  const loadProject = async () => {
    try {
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('rfx_projects')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) throw error
      setProject(data)
    } catch (error) {
      console.error('Error loading project:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo cargar el proyecto'
      })
      router.push('/rfx-maker')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!project) return

    setIsSaving(true)
    try {
      const supabase = supabaseBrowser()
      const { error } = await supabase
        .from('rfx_projects')
        .update({
          admin_parameters: project.admin_parameters,
          project_context: project.project_context,
          technical_base_content: project.technical_base_content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id)

      if (error) throw error

      setHasUnsavedChanges(false)
      addToast({
        type: 'success',
        title: 'Guardado',
        message: 'Los cambios se guardaron correctamente'
      })
    } catch (error) {
      console.error('Error saving project:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudieron guardar los cambios'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleGenerateTechnicalBase = async () => {
    if (!project) return

    setIsGenerating(true)
    try {
      const { ft, fa } = buildFollowUpFromState()
      const composed = composeBases({
        title: project.title,
        technical: techQuestions.map(q => ({ question: q.question, answer: techAnswers[q.id] || '' })),
        administrative: adminQuestions.map(q => ({ question: q.question, answer: adminAnswers[q.id] || '' })),
      })
      let technical = composed.technical
      try {
        const response = await fetch('/api/rfx-maker/generate-technical', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: project.id,
            admin_parameters: project.admin_parameters,
            project_context: {
              ...project.project_context,
              rfx_type: project.rfx_type,
              project_title: project.title,
            },
            follow_up_technical: Object.keys(ft).length ? ft : undefined,
            follow_up_administrative: Object.keys(fa).length ? fa : undefined,
          }),
        })
        const data = await response.json()
        if (data.success && data.content) technical = data.content
      } catch {
        technical = composed.technical
      }

      const wizard = {
        tech: techQuestions.map((q) => ({
          id: q.id,
          question: q.question,
          answer: techAnswers[q.id] || '',
        })),
        admin: adminQuestions.map((q) => ({
          id: q.id,
          question: q.question,
          answer: adminAnswers[q.id] || '',
        })),
      }

      const supabase = supabaseBrowser()
      const published = `${technical}\n\n${composed.administrative}`
      const basesReady = basesTextIsReady(published)
      const nextContext = {
        ...(project.project_context || {}),
        wizard,
        administrative_base_content: composed.administrative,
      }
      const { error } = await supabase
        .from('rfx_projects')
        .update({
          technical_base_content: technical,
          technical_base_generated_at: new Date().toISOString(),
          technical_base_is_valid: basesReady,
          technical_base_manually_edited: false,
          project_context: nextContext,
        })
        .eq('id', project.id)

      if (error) throw error
      const planId = (project.project_context as { sourcing_plan_id?: string } | null)?.sourcing_plan_id
      if (project.company_id) {
        await saveDossier(supabase, {
          companyId: project.company_id,
          sourcingPlanId: planId,
          rfxProjectId: project.id,
          title: project.title,
          stage: 'bases',
          basesText: published,
        })
      }
      setAdminBaseContent(composed.administrative)
      setTechnicalContent(technical)

      setProject({
        ...project,
        technical_base_content: technical,
        technical_base_is_valid: basesReady,
        technical_base_manually_edited: false,
        project_context: nextContext,
      })

      addToast({
        type: 'success',
        title: 'Base técnica generada',
        message: 'La base técnica se generó exitosamente con IA'
      })

      setActiveTab('technical')
    } catch (error) {
      console.error('Error generating technical base:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo generar la base técnica'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleChangeStatus = async (newStatus: 'ready' | 'closed' | 'archived') => {
    if (!project) return

    // Validaciones
    if (newStatus === 'ready' && !basesTextIsReady(project.technical_base_content)) {
      addToast({
        type: 'error',
        title: 'El borrador sigue incompleto',
        message: 'Completa qué se compra, el alcance, los requisitos y cómo se evalúa antes de marcar las bases como listas.',
      })
      return
    }

    try {
      const supabase = supabaseBrowser()
      const updates: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      }

      if (newStatus === 'closed') {
        updates.closed_at = new Date().toISOString()
      } else if (newStatus === 'archived') {
        updates.archived_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('rfx_projects')
        .update(updates)
        .eq('id', project.id)

      if (error) throw error

      setProject({ ...project, ...updates })
      addToast({
        type: 'success',
        title: 'Estado actualizado',
        message: `Proyecto marcado como ${newStatus}`
      })
    } catch (error) {
      console.error('Error updating status:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo actualizar el estado'
      })
    }
  }

  const handleSaveParams = async (newParams: Record<string, any>) => {
    if (!project) return

    try {
      const supabase = supabaseBrowser()
      const { error } = await supabase
        .from('rfx_projects')
        .update({
          admin_parameters: newParams,
          admin_parameters_last_modified: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id)

      if (error) throw error

      setProject({
        ...project,
        admin_parameters: newParams,
        admin_parameters_last_modified: new Date().toISOString(),
        technical_base_is_valid: false, // Se invalidará por el trigger
      })

      setIsEditingParams(false)
      addToast({
        type: 'success',
        title: 'Parámetros actualizados',
        message: 'Los cambios se guardaron correctamente. La base técnica fue invalidada.'
      })

      // Recargar el proyecto para obtener el estado actualizado
      await loadProject()
    } catch (error) {
      console.error('Error saving params:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudieron guardar los parámetros'
      })
      throw error
    }
  }

  const handleSaveTechnicalContent = async () => {
    if (!project) return

    setIsSaving(true)
    try {
      const supabase = supabaseBrowser()
      const { error } = await supabase
        .from('rfx_projects')
        .update({
          technical_base_content: technicalContent,
          technical_base_manually_edited: true,
          project_context: {
            ...(project.project_context || {}),
            administrative_base_content: adminBaseContent,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id)

      if (error) throw error
      const planId = (project.project_context as { sourcing_plan_id?: string } | null)?.sourcing_plan_id
      await saveDossier(supabase, {
        companyId: project.company_id,
        sourcingPlanId: planId,
        rfxProjectId: project.id,
        title: project.title,
        stage: 'bases',
        basesText: `${technicalContent}\n\n${adminBaseContent}`,
      })

      setProject({
        ...project,
        technical_base_content: technicalContent,
        technical_base_manually_edited: true,
        project_context: {
          ...(project.project_context || {}),
          administrative_base_content: adminBaseContent,
        },
      })

      setIsEditingTechnical(false)
      addToast({
        type: 'success',
        title: 'Base técnica guardada',
        message: 'El contenido se actualizó correctamente'
      })
    } catch (error) {
      console.error('Error saving technical content:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo guardar el contenido'
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

  if (!project) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <h2 className="text-2xl font-bold mb-4">Proyecto no encontrado</h2>
              <Button onClick={() => router.push('/rfx-maker')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a RFx Maker
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    )
  }

  const isEditable = project.status !== 'closed' && project.status !== 'archived'

  return (
    <MainLayout>
      <div className="space-y-6">
        <DossierThread match={{ companyId: project.company_id, rfxProjectId: project.id, sourcingPlanId: (project.project_context as { sourcing_plan_id?: string } | null)?.sourcing_plan_id }} />
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/rfx-maker')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{project.title}</h1>
                <Badge>{project.rfx_type}</Badge>
                <Badge variant={project.status === 'ready' ? 'default' : 'secondary'}>
                  {project.status}
                </Badge>
              </div>
              <p className="text-gray-600">Código: {project.project_code}</p>
            </div>
          </div>

          <div className="flex gap-2">
            {hasUnsavedChanges && (
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Guardar
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => {
                const planId = (project.project_context as { sourcing_plan_id?: string } | null)?.sourcing_plan_id
                const query = new URLSearchParams({ rfxId: project.id })
                if (planId) query.set('planId', planId)
                router.push(`/licitaciones/new?${query.toString()}`)
              }}
            >
              Seguir a licitación
            </Button>

            <Button variant="outline" onClick={downloadDocx}>
              <Download className="h-4 w-4 mr-2" />
              Descargar DOCX
            </Button>

            <Button
              variant="outline"
              onClick={() => window.open(`/api/rfx-maker/download?project_id=${project.id}&format=pdf`, '_blank')}
            >
              <Download className="h-4 w-4 mr-2" />
              Vista HTML/PDF
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowVersionsModal(true)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Versiones ({project.version_number || 1})
            </Button>

            {isEditable && project.status === 'draft' && (
              <Button
                variant="outline"
                onClick={() => handleChangeStatus('ready')}
              >
                <Unlock className="h-4 w-4 mr-2" />
                Marcar como Listo
              </Button>
            )}

            {isEditable && project.status === 'ready' && (
              <Button
                variant="outline"
                onClick={() => handleChangeStatus('closed')}
              >
                <Lock className="h-4 w-4 mr-2" />
                Cerrar Proyecto
              </Button>
            )}

          </div>
        </div>

        {/* Invalidation Banner */}
        {!project.technical_base_is_valid && project.technical_base_content && isEditable && (
          <Card className="border-orange-500 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                  <div>
                    <h3 className="font-semibold text-orange-900">Base Técnica Invalidada</h3>
                    <p className="text-sm text-orange-700">
                      Los parámetros administrativos cambiaron. Necesitas regenerar la base técnica para mantener consistencia.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleGenerateTechnicalBase}
                  disabled={isGenerating}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerar Base Técnica
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {((project.project_context as { start?: { mode?: string } } | null)?.start?.mode) === 'agente' && (
        <Card className="border-teal-200/60 bg-teal-50/20">
          <CardHeader>
            <CardTitle>
              {((project.project_context as { start?: { mode?: string; document?: string } } | null)?.start?.mode) === 'agente'
                ? 'El agente pregunta hasta poder armar el documento'
                : 'Llenado directo'}
            </CardTitle>
            <CardDescription>
              {((project.project_context as { start?: { document?: string } } | null)?.start?.document) === 'administrativa'
                ? 'Partiste por las bases administrativas. Las tablas de cotización y propuesta salen cuando exista la base técnica.'
                : 'Partiste por las bases técnicas. Abajo están la cotización y la propuesta del mismo servicio.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              variant="secondary"
              onClick={fetchWizardQuestions}
              disabled={loadingWizardQuestions || !isEditable}
            >
              {loadingWizardQuestions ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando preguntas…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {techQuestions.length + adminQuestions.length > 0 ? 'Volver a preguntar' : 'Pedir preguntas'}
                </>
              )}
            </Button>

            {(techQuestions.length > 0 || adminQuestions.length > 0) && (
              <div className="grid md:grid-cols-2 gap-6 pt-2">
                {((project.project_context as { start?: { document?: string } } | null)?.start?.document) !== 'administrativa' && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-800">Aclaraciones técnicas</h4>
                  {techQuestions.map((q) => (
                    <div key={q.id}>
                      <Label className="text-xs text-muted-foreground leading-snug">{q.question}</Label>
                      <Textarea
                        className="mt-1 min-h-[72px] text-sm"
                        value={techAnswers[q.id] || ''}
                        onChange={(e) =>
                          setTechAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        disabled={!isEditable}
                      />
                    </div>
                  ))}
                </div>
                )}
                {((project.project_context as { start?: { document?: string } } | null)?.start?.document) !== 'tecnica' && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-800">Aclaraciones administrativas</h4>
                  {adminQuestions.map((q) => (
                    <div key={q.id}>
                      <Label className="text-xs text-muted-foreground leading-snug">{q.question}</Label>
                      <Textarea
                        className="mt-1 min-h-[72px] text-sm"
                        value={adminAnswers[q.id] || ''}
                        onChange={(e) =>
                          setAdminAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        disabled={!isEditable}
                      />
                    </div>
                  ))}
                </div>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {((project.project_context as { start?: { mode?: string } } | null)?.start?.mode) === 'agente'
                ? 'Al abrir el proyecto, las preguntas salen solas. Responde y después genera la base: las respuestas viajan con ella.'
                : 'Si prefieres no usar preguntas, llena las secciones en la pestaña de abajo.'}
            </p>
          </CardContent>
        </Card>
        )}

        {(
          ((project.project_context as { start?: { document?: string } } | null)?.start?.document) !== 'administrativa'
          || Boolean(project.technical_base_generated_at)
          || /Alcance: (?!Por completar)/.test(project.technical_base_content || '')
        ) ? (
          <RfxServiceSheets
            project={project}
            disabled={!isEditable}
            onSaved={(patch) => setProject({ ...project, ...patch })}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            La cotización y la propuesta técnica aparecen cuando la base técnica tenga alcance, requisitos y entregables.
          </p>
        )}

        {/* Tabs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`pb-2 px-1 border-b-2 transition-colors ${
                    activeTab === 'admin'
                      ? 'border-blue-500 text-blue-600 font-semibold'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <FileText className="h-4 w-4 inline mr-2" />
                  Base Administrativa
                </button>
                <button
                  onClick={() => setActiveTab('technical')}
                  className={`pb-2 px-1 border-b-2 transition-colors ${
                    activeTab === 'technical'
                      ? 'border-blue-500 text-blue-600 font-semibold'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Sparkles className="h-4 w-4 inline mr-2" />
                  Base Técnica (IA)
                </button>
                <button
                  onClick={() => setActiveTab('context')}
                  className={`pb-2 px-1 border-b-2 transition-colors ${
                    activeTab === 'context'
                      ? 'border-blue-500 text-blue-600 font-semibold'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <SettingsIcon className="h-4 w-4 inline mr-2" />
                  Contexto
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {activeTab === 'admin' && project.project_context?.simple_bases && (
              <RfxSectionBases
                project={project}
                disabled={!isEditable}
                onSaved={(patch) => setProject({ ...project, ...patch })}
              />
            )}
            {activeTab === 'admin' && !project.project_context?.simple_bases && (
              <div className="space-y-4">
                <RfxQuickAdminForm
                  key={project.admin_parameters_last_modified ?? project.id}
                  initialParams={project.admin_parameters || {}}
                  disabled={!isEditable}
                  onApply={handleSaveParams}
                />
                {!isEditingParams ? (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Base Administrativa</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Parámetros y condiciones administrativas del proyecto
                        </p>
                      </div>
                      {isEditable && (
                        <Button
                          size="sm"
                          onClick={() => setIsEditingParams(true)}
                        >
                          <SettingsIcon className="h-4 w-4 mr-2" />
                          Editar Parámetros
                        </Button>
                      )}
                    </div>
                    <RfxParamsViewer params={project.admin_parameters || {}} />
                  </>
                ) : (
                  <RfxParamsEditor
                    initialParams={project.admin_parameters || {}}
                    onSave={handleSaveParams}
                    onCancel={() => setIsEditingParams(false)}
                  />
                )}
              </div>
            )}

            {activeTab === 'technical' && (
              <div className="space-y-4">
                {!project.technical_base_content && !isEditingTechnical ? (
                  <div className="text-center py-12">
                    <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Base Técnica no generada</h3>
                    <p className="text-gray-600 mb-6">
                      Usa la IA de Xpend para generar la base técnica automáticamente o escríbela manualmente
                    </p>
                    <div className="flex gap-3 justify-center">
                      <Button
                        onClick={handleGenerateTechnicalBase}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generando con IA...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generar con IA
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditingTechnical(true)
                          setTechnicalContent('')
                        }}
                      >
                        Escribir Manualmente
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {!isEditingTechnical ? (
                      <>
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">Base Técnica del Proyecto</h3>
                            <div className="flex items-center gap-3 mt-1">
                              <p className="text-sm text-gray-600">
                                Especificaciones técnicas y requisitos
                              </p>
                              {project.technical_base_manually_edited && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                                  Editado manualmente
                                </span>
                              )}
                            </div>
                          </div>
                          {isEditable && (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEditingTechnical(true)}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleGenerateTechnicalBase}
                                disabled={isGenerating}
                              >
                                {isGenerating ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Regenerando...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Regenerar con IA
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
                          <div
                            className="prose prose-slate max-w-none
                              prose-headings:text-gray-900 prose-headings:font-bold
                              prose-h1:text-2xl prose-h1:mb-4 prose-h1:pb-2 prose-h1:border-b-2 prose-h1:border-blue-500
                              prose-h2:text-xl prose-h2:mb-3 prose-h2:mt-6
                              prose-h3:text-lg prose-h3:mb-2 prose-h3:mt-4
                              prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
                              prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6
                              prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6
                              prose-li:text-gray-700 prose-li:mb-2
                              prose-strong:text-gray-900 prose-strong:font-semibold
                              prose-em:text-gray-600
                              prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:pl-4 prose-blockquote:italic
                              prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                            "
                            style={{ whiteSpace: 'pre-wrap' }}
                          >
                            {project.technical_base_content}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold">Editar Base Técnica</h3>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setIsEditingTechnical(false)
                                setTechnicalContent(project.technical_base_content || '')
                              }}
                              disabled={isSaving}
                            >
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSaveTechnicalContent}
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Guardando...
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4 mr-2" />
                                  Guardar Cambios
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                        <RichTextEditor
                          value={technicalContent}
                          onChange={setTechnicalContent}
                          placeholder="Escribe la base técnica aquí... Puedes usar formato rico, listas, tablas, etc."
                        />
                        <label className="mt-4 block text-sm font-medium">Base administrativa</label>
                        <textarea
                          className="mt-1 min-h-[160px] w-full rounded-md border p-3 text-sm"
                          value={adminBaseContent}
                          onChange={event => setAdminBaseContent(event.target.value)}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'context' && (
              <div className="space-y-4">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Contexto del Proyecto</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Información contextual utilizada por la IA para generar contenido relevante
                  </p>
                </div>

                {project.project_context && Object.keys(project.project_context).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(project.project_context).map(([key, value]) => (
                      <Card key={key} className="p-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-500 mb-1">
                            {key.replace(/_/g, ' ').split(' ').map(word =>
                              word.charAt(0).toUpperCase() + word.slice(1)
                            ).join(' ')}
                          </span>
                          <span className="text-base text-gray-900">
                            {typeof value === 'object'
                              ? JSON.stringify(value, null, 2)
                              : value?.toString() || 'N/A'}
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
                    No hay información contextual definida para este proyecto.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comentarios */}
        <Card>
          <CardHeader>
            <CardTitle>Comentarios y Colaboración</CardTitle>
          </CardHeader>
          <CardContent>
            <RfxComments projectId={project.id} />
          </CardContent>
        </Card>
      </div>

      {/* Modal de versiones */}
      {showVersionsModal && (
        <RfxVersionsModal
          projectId={project.id}
          onClose={() => setShowVersionsModal(false)}
          onVersionRestored={() => {
            setShowVersionsModal(false)
            loadProject()
          }}
        />
      )}
    </MainLayout>
  )
}

