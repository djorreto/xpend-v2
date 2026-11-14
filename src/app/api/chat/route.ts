import { NextRequest } from 'next/server'
import { generateAnaResponse } from '@/lib/ai'
import { evaluateQuota, GroqCallError, readGroqUsage } from '@/lib/groq-call'
import { recordExternalAiCall, requireExternalAi } from '@/lib/spend-access'
import { redactOutboundText } from '@/lib/spend-redaction'

export const runtime = 'nodejs'

function detectPromptInjection(message: string): boolean {
  const suspiciousPatterns = [
    /ignore\s+(previous|all|above|prior)\s+instructions?/i,
    /ignora\s+(las\s+)?instrucciones/i,
    /you\s+are\s+now/i,
    /reveal\s+your\s+(prompt|instructions?)/i,
    /\[SYSTEM\]/i,
    /\[INST\]/i,
  ]
  return suspiciousPatterns.some(pattern => pattern.test(message))
}

export async function POST(req: NextRequest) {
  const access = await requireExternalAi('analyst')
  if (!access.ok) return access.response
  const body = await req.json().catch(() => ({}))
  const message = typeof body.message === 'string' ? body.message : ''
  const history = typeof body.conversationHistory === 'string' ? body.conversationHistory.slice(0, 2000) : ''
  if (!message) return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 })
  if (detectPromptInjection(message)) {
    return new Response('No puedo cambiar mis reglas ni revelar instrucciones internas.', { status: 200 })
  }
  const usage = await readGroqUsage(access.supabase, access.profile.company_id, access.profile.id)
  const quota = evaluateQuota(usage)
  if (!quota.ok) return new Response(quota.reason, { status: 429 })
  const redacted = redactOutboundText(message)
  if (redacted.blocked) {
    await recordExternalAiCall(access.supabase, {
      company_id: access.profile.company_id,
      user_id: access.profile.id,
      outcome: 'blocked',
      block_reason: 'listado',
      model: 'qwen/qwen3.8-27b',
      payload_chars: message.length,
    })
    return new Response('Ese mensaje parece un listado de gasto. No se envió a Groq.', { status: 200 })
  }
  const recorded = await recordExternalAiCall(access.supabase, {
    company_id: access.profile.company_id,
    user_id: access.profile.id,
    outcome: 'sent',
    model: 'qwen/qwen3.8-27b',
    payload_chars: redacted.text.length,
  })
  if (!recorded) return new Response(JSON.stringify({ error: 'No se pudo registrar el envío. El mensaje no salió de Xpend.' }), { status: 503 })
  try {
    const text = await generateAnaResponse(redacted.text, history)
    return new Response(text, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  } catch (error) {
    const status = error instanceof GroqCallError ? error.status : 502
    const messageText = error instanceof Error ? error.message : 'Groq no completó la respuesta. No reintenté.'
    return new Response(messageText, { status })
  }
}
