// src/app/api/chat/route.ts
import { streamJuanResponse } from '@/lib/ai'
import { NextRequest } from 'next/server'
import { recordExternalAiCall, requireExternalAi } from '@/lib/spend-access'
import { redactOutboundText } from '@/lib/spend-redaction'

export const runtime = 'nodejs' // Cambiado de edge a nodejs para acceso a env vars

/**
 * Detecta intentos de prompt injection y manipulación
 */
function detectPromptInjection(message: string): boolean {
  const suspiciousPatterns = [
    /ignore\s+(previous|all|above|prior)\s+instructions?/i,
    /disregard\s+(previous|all|above|prior)\s+instructions?/i,
    /forget\s+(previous|all|above|prior)\s+instructions?/i,
    /new\s+instructions?:/i,
    /you\s+are\s+now/i,
    /act\s+as\s+(a|an)\s+/i,
    /pretend\s+to\s+be/i,
    /roleplay\s+as/i,
    /simulate\s+(a|an)\s+/i,
    /\[SYSTEM\]/i,
    /\[INST\]/i,
    /\<\|system\|\>/i,
    /reveal\s+your\s+(prompt|instructions?|system|configuration)/i,
    /what\s+(is|are)\s+your\s+(prompt|instructions?|system\s+prompt)/i,
    /show\s+me\s+your\s+(prompt|instructions?)/i,
    /tell\s+me\s+your\s+(prompt|instructions?)/i,
  ]

  return suspiciousPatterns.some(pattern => pattern.test(message))
}

/**
 * Verifica si el mensaje es sobre temas fuera del alcance de ANA
 */
function isOutOfScope(message: string): boolean {
  // Lista de palabras clave que claramente indican temas fuera de procurement/sourcing
  const outOfScopeKeywords = [
    // Programación/tecnología (que no sea sourcing de TI)
    /\b(python|javascript|java|c\+\+|html|css|sql|database|código|program|script)\b/i,
    // Medicina
    /\b(medical|doctor|medicine|disease|symptom|treatment|diagnos)\b/i,
    // Política/religión
    /\b(political|election|president|religious|bible|quran)\b/i,
  ]

  // No aplicar si el mensaje contiene palabras relacionadas con sourcing
  const sourcingKeywords =
    /\b(procurement|sourcing|supplier|proveedor|rfp|rfq|rfi|category|categoría|contract|contrato|negotiat|negociac|compra|abastecimiento|licitación|tender)\b/i

  if (sourcingKeywords.test(message)) {
    return false
  }

  return outOfScopeKeywords.some(pattern => pattern.test(message))
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireExternalAi('analyst')
    if (!access.ok) return access.response

    const body = await req.json()
    const message = typeof body.message === 'string' ? body.message : ''
    const history = typeof body.conversationHistory === 'string'
      ? body.conversationHistory
      : ''

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (detectPromptInjection(message)) {
      return new Response(
        'No puedo ayudarte con eso. ¿Tienes alguna consulta sobre sourcing o procurement?',
        { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      )
    }

    const redactedMessage = redactOutboundText(message)
    const redactedHistory = redactOutboundText(history)
    if (redactedMessage.blocked || redactedHistory.blocked) {
      await recordExternalAiCall(access.supabase, {
        company_id: access.profile.company_id,
        user_id: access.profile.id,
        outcome: 'blocked',
        block_reason: 'listado',
        model: 'qwen/qwen3.8-27b',
        payload_chars: message.length,
      })
      return new Response(
        'Ese mensaje parece un listado de gasto. No se envió a la IA. Clasifícalo en Sourcing Intelligence.',
        { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      )
    }

    const recorded = await recordExternalAiCall(access.supabase, {
      company_id: access.profile.company_id,
      user_id: access.profile.id,
      outcome: 'sent',
      model: 'qwen/qwen3.8-27b',
      payload_chars: redactedMessage.text.length,
    })
    if (!recorded) {
      return new Response(JSON.stringify({ error: 'No se pudo registrar el envío. El mensaje no salió de Xpend.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const result = await streamJuanResponse(redactedMessage.text, redactedHistory.text)
    return result.toTextStreamResponse()
  } catch {
    console.error('Error in chat API')
    return new Response(
      JSON.stringify({ error: 'Error al procesar el mensaje' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
