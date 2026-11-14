import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { PROCESS_ACTIONS, appendProcessEvent, listProcessEvents, type ProcessAction } from '@/lib/process-log'

export const runtime = 'nodejs'

const BASELINE_METHODS = new Set(['historical', 'budget', 'last_price', 'standing_offer'])

async function actor() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_id')
    .eq('id', session.user.id)
    .single()
  if (!profile?.company_id) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  return { supabase, userId: session.user.id, companyId: profile.company_id }
}

export async function GET(request: NextRequest) {
  const who = await actor()
  if (who instanceof NextResponse) return who
  const { companyId } = who
  const action = request.nextUrl.searchParams.get('action')
  const licitacionId = request.nextUrl.searchParams.get('licitacion_id')
  let events = await listProcessEvents(companyId)
  if (action) events = events.filter(event => event.action === action)
  if (licitacionId) events = events.filter(event => event.metadata?.licitacion_id === licitacionId)
  return NextResponse.json({ events })
}

export async function POST(request: NextRequest) {
  const who = await actor()
  if (who instanceof NextResponse) return who
  const { supabase, userId, companyId } = who

  const body = await request.json()
  const action = String(body.action || '') as ProcessAction
  if (!PROCESS_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
  }

  const licitacionId = body.licitacion_id ? String(body.licitacion_id) : null
  const planId = body.plan_id ? String(body.plan_id) : null
  const payload = (body.payload || {}) as Record<string, unknown>

  if (licitacionId) {
    const { data: licitacion } = await supabase
      .from('licitaciones')
      .select('id, company_id')
      .eq('id', licitacionId)
      .maybeSingle()
    if (!licitacion || licitacion.company_id !== companyId) {
      return NextResponse.json({ error: 'Licitación no encontrada' }, { status: 404 })
    }
  }

  if (action === 'spend_closed') {
    const period = String(payload.period || '')
    const totals = Array.isArray(payload.totals) ? payload.totals : []
    if (!/^\d{4}-\d{2}$/.test(period) || !totals.length) {
      return NextResponse.json({ error: 'El cierre necesita el mes y los totales por moneda' }, { status: 400 })
    }
    const existing = (await listProcessEvents(companyId)).filter(event => event.action === 'spend_closed')
    const saved = []
    for (const row of totals) {
      const currency = String(row.currency || '')
      const already = existing.find(event => event.metadata?.period === period && event.metadata?.currency === currency)
      if (already) {
        saved.push(already)
        continue
      }
      const result = await appendProcessEvent({
        companyId,
        actorId: userId,
        action,
        payload: {
          period,
          currency,
          total: Number(row.amount) || 0,
          line_count: Number(payload.line_count) || 0,
        },
      })
      if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
      saved.push({ currency, total: Number(row.amount) || 0 })
    }
    return NextResponse.json({ ok: true, closed: saved })
  }

  if (action === 'award') {
    const events = (await listProcessEvents(companyId)).filter(event => event.metadata?.licitacion_id === licitacionId)
    const technical = events.find(event => event.action === 'technical_closed')
    if (!technical) {
      return NextResponse.json({ error: 'Falta cerrar la nota técnica antes de adjudicar.' }, { status: 409 })
    }
    const exception = String(payload.exception || '').trim()
    if (technical.performed_by === userId && exception.length < 12) {
      return NextResponse.json({
        error: 'Quien cerró la nota técnica no adjudica. Si eres la única persona, escribe la excepción.',
      }, { status: 409 })
    }
    const currency = String(payload.currency || 'CLP')
    const amount = Number(payload.amount) || 0
    const threshold = currency === 'CLP' || currency === 'UF' ? 20000000 : 20000
    const responsible = String(payload.responsible_user_id || '')
    if (amount >= threshold && responsible === userId && exception.length < 12) {
      return NextResponse.json({
        error: 'Sobre el umbral hace falta otra firma, o una excepción escrita.',
      }, { status: 409 })
    }
    if (!BASELINE_METHODS.has(String(payload.baseline_source || ''))) {
      return NextResponse.json({
        error: 'La adjudicación exige un método de línea base: promedio, último precio, presupuesto u oferta vigente.',
      }, { status: 409 })
    }
  }

  const result = await appendProcessEvent({
    companyId,
    actorId: userId,
    action,
    licitacionId,
    planId,
    payload,
  })
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
