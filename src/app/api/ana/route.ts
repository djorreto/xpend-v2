import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { contextFromPath, type AnaContext } from '@/lib/ana'
import { runAna } from '@/lib/ana-run'

export const runtime = 'nodejs'

const MODULES = new Set(['spend', 'plan', 'rfx', 'licitacion', 'evaluacion', 'contrato', 'general'])

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const question = typeof body.question === 'string' ? body.question : ''
  const path = typeof body.path === 'string' ? body.path : ''
  const fromPath = contextFromPath(path)
  const moduleName = MODULES.has(body.module) ? body.module : fromPath.module
  const context: AnaContext = {
    module: moduleName,
    recordId: typeof body.recordId === 'string' ? body.recordId : fromPath.recordId,
    compareId: typeof body.compareId === 'string' ? body.compareId : undefined,
    label: typeof body.label === 'string' ? body.label : fromPath.label,
  }
  const result = await runAna(supabase, question, context, { useModel: true })
  if (result.error === 'No autorizado') return NextResponse.json({ error: result.error }, { status: 401 })
  return NextResponse.json({
    interactionId: result.interactionId,
    ...result.answer,
    modelCalled: false,
  })
}
