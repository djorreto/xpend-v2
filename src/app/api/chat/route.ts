// src/app/api/chat/route.ts
import { streamJuanResponse } from '@/lib/ai'
import { NextRequest } from 'next/server'

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
  const sourcingKeywords = /\b(procurement|sourcing|supplier|proveedor|rfp|rfq|rfi|category|categoría|contract|contrato|negotiat|negociac|compra|abastecimiento|licitación|tender)\b/i

  if (sourcingKeywords.test(message)) {
    return false
  }

  return outOfScopeKeywords.some(pattern => pattern.test(message))
}

export async function POST(req: NextRequest) {
  try {
    const { message, conversationHistory, userId } = await req.json()

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Detectar intentos de prompt injection
    if (detectPromptInjection(message)) {
      const safeResponse = "No puedo ayudarte con eso. ¿Tienes alguna consulta sobre sourcing o procurement?"
      return new Response(safeResponse, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    // Generar respuesta con streaming
    const result = await streamJuanResponse(message, conversationHistory)

    // Convertir el stream a respuesta HTTP (método correcto)
    return result.toTextStreamResponse()
  } catch (error) {
    console.error('Error in chat API:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Error al procesar el mensaje',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

// Función auxiliar para guardar historial (sin bloquear)
async function saveToHistory(userId: string, userMessage: string, assistantMessage: string) {
  try {
    const supabase = supabaseBrowser()
    await supabase.from('chat_history').insert({
      user_id: userId,
      user_message: userMessage,
      assistant_message: assistantMessage,
    })
  } catch (error) {
    console.error('Error saving chat history:', error)
  }
}

