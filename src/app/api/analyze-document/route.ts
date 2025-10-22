// src/app/api/analyze-document/route.ts
import { analyzeDocument } from '@/lib/ai'
import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'

export async function POST(req: NextRequest) {
  try {
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

    // Analizar el documento con Juan Xpendo
    const analysis = await analyzeDocument(extractedText, documentType)

    return NextResponse.json({
      success: true,
      analysis,
      fileName: file.name,
      fileSize: file.size,
      wordCount: extractedText.split(/\s+/).length,
    })
  } catch (error) {
    console.error('Error analyzing document:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Error al analizar el documento. Intenta de nuevo.',
      },
      { status: 500 }
    )
  }
}

