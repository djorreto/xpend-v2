import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { recordExternalAiCall, requireExternalAi } from '@/lib/spend-access'
import { stripContactData } from '@/lib/spend-redaction'

export const runtime = 'nodejs'
export const maxDuration = 60

function getGroqApiKey() {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.GROQ_API_KEY || ''
  }
  return ''
}

const groq = createOpenAI({
  apiKey: getGroqApiKey(),
  baseURL: 'https://api.groq.com/openai/v1',
})

const model = groq('qwen/qwen3.8-27b')

async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === 'text/plain') {
    return await file.text()
  }

  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.endsWith('.docx')
  ) {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  // PDFs e imágenes requieren OCR; por ahora no soportados en esta ruta.
  throw new Error('Formato no soportado. Usa .docx o .txt')
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireExternalAi('analyst')
    if (!access.ok) return access.response

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    }

    const sourceText = stripContactData(await extractTextFromFile(file))
    if (!sourceText || sourceText.trim().length < 20) {
      return NextResponse.json({ error: 'El archivo no tiene contenido suficiente' }, { status: 400 })
    }
    const recorded = await recordExternalAiCall(access.supabase, {
      company_id: access.profile.company_id,
      user_id: access.profile.id,
      outcome: 'sent',
      model: 'qwen/qwen3.8-27b',
      payload_chars: sourceText.length,
    })
    if (!recorded) {
      return NextResponse.json({ error: 'No se pudo registrar el envío. La factura no salió de Xpend.' }, { status: 503 })
    }

    const prompt = `
Eres un asistente que extrae datos de facturas/boletas en español.
Devuelve SOLO un JSON con estos campos:
- amount: número (monto total de la factura)
- currency: código o símbolo detectado (CLP, USD, $)
- provider: nombre del proveedor
- invoice_date: fecha en formato YYYY-MM-DD
- category: categoría del gasto (texto corto)
- description: resumen breve del concepto de la factura

Si no encuentras un dato, deja cadena vacía. No inventes montos.

TEXTO A ANALIZAR:
${sourceText.slice(0, 8000)}
`

    const { text } = await generateText({
      model,
      prompt,
      temperature: 0.2,
    })

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'No se pudo extraer la factura' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      success: true,
      data: {
        amount: parsed.amount ?? '',
        currency: parsed.currency ?? '',
        provider: parsed.provider ?? '',
        invoice_date: parsed.invoice_date ?? '',
        category: parsed.category ?? '',
        description: parsed.description ?? ''
      }
    })
  } catch {
    console.error('AI invoice extract error')
    return NextResponse.json({ error: 'Error al procesar la factura con IA' }, { status: 500 })
  }
}


