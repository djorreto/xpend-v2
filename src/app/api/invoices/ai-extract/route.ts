import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import mammoth from 'mammoth'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

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

const model = groq('llama-3.3-70b-versatile')

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
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, company_id')
      .eq('id', session.user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    }

    const rawText = await extractTextFromFile(file)
    if (!rawText || rawText.trim().length < 20) {
      return NextResponse.json({ error: 'El archivo no tiene contenido suficiente' }, { status: 400 })
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
${rawText.slice(0, 8000)}
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
  } catch (error: any) {
    console.error('AI invoice extract error:', error)
    return NextResponse.json(
      { error: error?.message || 'Error al procesar la factura con IA' },
      { status: 500 }
    )
  }
}

