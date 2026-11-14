import { NextRequest, NextResponse } from 'next/server'
import { generateRfxWizardQuestions } from '@/lib/ai'
import { recordExternalAiCall, requireExternalAi } from '@/lib/spend-access'
import { redactOutboundText } from '@/lib/spend-redaction'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const access = await requireExternalAi('analyst')
    if (!access.ok) return access.response

    const body = await req.json()
    const projectId = body.project_id as string | undefined
    if (!projectId) {
      return NextResponse.json({ success: false, error: 'project_id requerido' }, { status: 400 })
    }

    const { data: project, error } = await access.supabase
      .from('rfx_projects')
      .select('id, title, description, rfx_type, project_context, admin_parameters')
      .eq('id', projectId)
      .single()

    if (error || !project) {
      return NextResponse.json(
        { success: false, error: 'Proyecto no encontrado o sin acceso' },
        { status: 404 }
      )
    }

    const rawCtx = (project.project_context || {}) as Record<string, unknown>
    const { wizard: _wiz, ...ctxWithoutWizard } = rawCtx

    const safeTitle = redactOutboundText(String(project.title || ''))
    const safeDescription = redactOutboundText(String(project.description || ''))
    if (safeTitle.blocked || safeDescription.blocked) {
      await recordExternalAiCall(access.supabase, {
        company_id: access.profile.company_id,
        user_id: access.profile.id,
        outcome: 'blocked',
        block_reason: 'listado',
        model: 'qwen/qwen3.8-27b',
        payload_chars: String(project.description || '').length,
      })
      return NextResponse.json({ success: false, error: 'El proyecto parece un listado de gasto. No se envió a la IA.' }, { status: 422 })
    }
    const recorded = await recordExternalAiCall(access.supabase, {
      company_id: access.profile.company_id,
      user_id: access.profile.id,
      outcome: 'sent',
      model: 'qwen/qwen3.8-27b',
      payload_chars: safeDescription.text.length,
    })
    if (!recorded) {
      return NextResponse.json({ success: false, error: 'No se pudo registrar el envío. El texto no salió de Xpend.' }, { status: 503 })
    }

    const result = await generateRfxWizardQuestions({
      rfx_type: project.rfx_type,
      project_title: safeTitle.text,
      description: safeDescription.text || undefined,
      project_context: ctxWithoutWizard,
      admin_parameters: (project.admin_parameters || {}) as Record<string, unknown>,
    })

    return NextResponse.json({ success: true, ...result })
  } catch {
    console.error('wizard-questions')
    return NextResponse.json(
      { success: false, error: 'Error generando preguntas' },
      { status: 500 }
    )
  }
}
