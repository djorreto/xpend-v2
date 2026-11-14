// src/app/api/chat/route.ts
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const message = typeof body.message === 'string' ? body.message : ''
  if (message && detectPromptInjection(message)) {
    return new Response(
      'No puedo cambiar mis reglas ni revelar instrucciones internas.',
      { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    )
  }
  return new Response(
    JSON.stringify({ error: 'El modelo de ANA no está autorizado. Las consultas sobre datos y documentos usan /api/ana y no salen de Xpend.' }),
    { status: 409, headers: { 'Content-Type': 'application/json' } }
  )
}
