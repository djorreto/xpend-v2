// src/app/api/analyze-document/route.ts
import { analyzeDocument } from '@/lib/ai'
import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { recordExternalAiCall, requireExternalAi } from '@/lib/spend-access'
import { redactOutboundText } from '@/lib/spend-redaction'
import { evaluateQuota, readGroqUsage } from '@/lib/groq-call'

export async function POST(req: NextRequest) {
  try {
    const access = await requireExternalAi('analyst')
    if (!access.ok) return access.response
    const quota = evaluateQuota(await readGroqUsage(access.supabase, access.profile.company_id, access.profile.id))
    if (!quota.ok) return NextResponse.json({ error: quota.reason }, { status: 429 })

    const formData = await req.formData()
    const file = formData.get('file') as File
    const documentType = (formData.get('documentType') as string) || 'Especificación Técnica'

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó un archivo' }, { status: 400 })
    }

    // Extraer texto según el tipo de archivo
    let extractedText = ''

    if (file.type === 'text/plain') {
      // Archivo de texto plano
      extractedText = await file.text()
    } else if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.endsWith('.docx')
    ) {
      // Archivo Word (.docx)
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const result = await mammoth.extractRawText({ buffer })
      extractedText = result.value
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      // PDF (requiere pdf-parse, pero es más complejo en edge runtime)
      // Por ahora, retornamos error y pedimos Word o TXT
      return NextResponse.json(
        {
          error:
            'Los archivos PDF aún no están soportados. Por favor, sube un archivo Word (.docx) o texto plano (.txt)',
        },
        { status: 400 }
      )
    } else {
      return NextResponse.json(
        {
          error:
            'Formato de archivo no soportado. Usa Word (.docx) o texto plano (.txt)',
        },
        { status: 400 }
      )
    }

    // Validar que se extrajo texto
    if (!extractedText || extractedText.trim().length < 50) {
      return NextResponse.json(
        {
          error:
            'El documento está vacío o tiene muy poco contenido. Revisa el archivo e intenta de nuevo.',
        },
        { status: 400 }
      )
    }

    const redacted = redactOutboundText(extractedText)
    if (redacted.blocked || redacted.text.trim().length < 50) {
      await recordExternalAiCall(access.supabase, {
        company_id: access.profile.company_id,
        user_id: access.profile.id,
        outcome: 'blocked',
        block_reason: redacted.blocked ? 'listado' : 'insuficiente',
        model: 'qwen/qwen3.8-27b',
        payload_chars: extractedText.length,
      })
      return NextResponse.json(
        { error: 'El documento parece un listado de gasto o quedó sin contenido útil. No se envió a la IA.' },
        { status: 422 }
      )
    }

    const recorded = await recordExternalAiCall(access.supabase, {
      company_id: access.profile.company_id,
      user_id: access.profile.id,
      outcome: 'sent',
      model: 'qwen/qwen3.8-27b',
      payload_chars: redacted.text.length,
    })
    if (!recorded) {
      return NextResponse.json({ error: 'No se pudo registrar el envío. El documento no salió de Xpend.' }, { status: 503 })
    }

    const analysis = await analyzeDocument(redacted.text, documentType)

    return NextResponse.json({
      success: true,
      analysis,
      fileName: file.name,
      fileSize: file.size,
      wordCount: extractedText.split(/\s+/).length,
    })
  } catch {
    console.error('Error analyzing document')
    return NextResponse.json(
      { error: 'Error al analizar el documento. Intenta de nuevo.' },
      { status: 500 }
    )
  }
}

