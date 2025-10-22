// src/app/api/chat/route.ts
import { streamJuanResponse } from '@/lib/ai'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs' // Cambiado de edge a nodejs para acceso a env vars

export async function POST(req: NextRequest) {
  try {
    const { message, conversationHistory, userId } = await req.json()

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
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

