import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { confirmAna } from '@/lib/ana-run'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const interactionId = typeof body.interactionId === 'string' ? body.interactionId : ''
  const edited = typeof body.body === 'string' ? body.body : ''
  if (!interactionId) return NextResponse.json({ error: 'Falta la propuesta' }, { status: 400 })
  const result = await confirmAna(supabase, interactionId, edited)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ saved: true, detail: result.detail })
}
