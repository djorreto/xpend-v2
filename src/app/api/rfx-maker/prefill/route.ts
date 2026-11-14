import { NextRequest, NextResponse } from 'next/server'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { RFX_FIELDS } from '@/lib/rfx-sections'
import { recordExternalAiCall, requireExternalAi } from '@/lib/spend-access'
import { redactOutboundText } from '@/lib/spend-redaction'

export const runtime = 'nodejs'

const groq = createOpenAI({
  apiKey: process.env.GROQ_API_KEY || '',
  baseURL: 'https://api.groq.com/openai/v1',
})

export async function POST(request: NextRequest) {
  const access = await requireExternalAi('analyst')
  if (!access.ok) return access.response
  if (!process.env.GROQ_API_KEY) return NextResponse.json({ error: 'ANA no está configurada' }, { status: 503 })

  const body = await request.json()
  const title = String(body.title || '').trim()
  const type = String(body.rfx_type || 'RFP')
  const description = String(body.description || '')
  const alcance = String(body.alcance || description || '').trim()
  const plan = body.plan || {}
  if (title.length < 3) return NextResponse.json({ error: 'Escribe el título primero' }, { status: 400 })
  if (alcance.length < 8) return NextResponse.json({ error: 'Escribe el alcance antes de pedirle el texto a ANA.' }, { status: 400 })
  if (plan.id && !plan.responsible_user_id) {
    return NextResponse.json({ error: 'La iniciativa no tiene dueño. ANA no redacta el vacío.' }, { status: 400 })
  }
  if (plan.id && !plan.estimated_spend) {
    return NextResponse.json({ error: 'Falta el gasto estimado de la iniciativa. ANA no inventa la línea base.' }, { status: 400 })
  }

  const safeTitle = redactOutboundText(title)
  const safeDescription = redactOutboundText(description)
  const safePlanTitle = redactOutboundText(String(plan.title || ''))
  if (safeTitle.blocked || safeDescription.blocked || safePlanTitle.blocked) {
    await recordExternalAiCall(access.supabase, {
      company_id: access.profile.company_id,
      user_id: access.profile.id,
      outcome: 'blocked',
      block_reason: 'listado',
      model: 'qwen/qwen3.8-27b',
      payload_chars: description.length,
    })
    return NextResponse.json({ error: 'El texto parece un listado de gasto. No se envió a la IA.' }, { status: 422 })
  }
  const recorded = await recordExternalAiCall(access.supabase, {
    company_id: access.profile.company_id,
    user_id: access.profile.id,
    outcome: 'sent',
    model: 'qwen/qwen3.8-27b',
    payload_chars: safeDescription.text.length,
  })
  if (!recorded) {
    return NextResponse.json({ error: 'No se pudo registrar el envío. El texto no salió de Xpend.' }, { status: 503 })
  }

  const fields = RFX_FIELDS.map(field => `${field.key}: ${field.label}`).join('\n')
  try {
    const { text } = await generateText({
      model: groq('qwen/qwen3.8-27b'),
      temperature: 0.3,
      maxOutputTokens: 700,
      prompt: `Eres ANA, de compras. Prellena las bases de un ${type} en español, listas para que una persona las corrija. Cada campo: una o dos frases.
Título: ${safeTitle.text}
Descripción: ${safeDescription.text}
Iniciativa: ${safePlanTitle.text || 'sin iniciativa'}
Categoría: ${plan.category || 'sin categoría'}

Campos, responde solo JSON con estas claves:
${fields}`,
    })
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'ANA no devolvió los campos' }, { status: 502 })
    const raw = JSON.parse(match[0]) as Record<string, unknown>
    const values: Record<string, string> = {}
    for (const field of RFX_FIELDS) values[field.key] = String(raw[field.key] ?? '')
    return NextResponse.json({ values })
  } catch {
    return NextResponse.json({ error: 'ANA no pudo preparar las bases. Inténtalo de nuevo.' }, { status: 502 })
  }
}
