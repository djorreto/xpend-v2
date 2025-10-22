import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutos

// Configurar Groq
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

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // 1. Autenticación
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

    // 2. Obtener upload_id
    const { upload_id } = await request.json()

    if (!upload_id) {
      return NextResponse.json({ error: 'upload_id requerido' }, { status: 400 })
    }

    // 3. Obtener líneas sin clasificar o con baja confianza
    const { data: lines, error: linesError } = await supabase
      .from('si_spend_lines')
      .select('*')
      .eq('upload_id', upload_id)
      .eq('company_id', profile.company_id)
      .or('category.is.null,ai_confidence.lt.0.8')
      .limit(100) // Procesar máximo 100 líneas por batch

    if (linesError) throw linesError
    if (!lines || lines.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No hay líneas pendientes de clasificación',
        classified_count: 0
      })
    }

    // 4. Obtener reglas de aprendizaje
    const { data: rules } = await supabase
      .from('si_learning_rules')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('success_rate', { ascending: false })
      .limit(10)

    const rulesContext = rules && rules.length > 0
      ? `\n\nREGLAS APRENDIDAS:\n${rules.map(r => `- "${r.pattern}" → "${r.category}"`).join('\n')}`
      : ''

    // 5. Clasificar líneas en lotes de 10
    let classified_count = 0
    const batchSize = 10

    for (let i = 0; i < lines.length; i += batchSize) {
      const batch = lines.slice(i, i + batchSize)
      
      // Crear prompt para el lote
      const batchDescriptions = batch.map((line, idx) => 
        `${idx + 1}. Descripción: "${line.description}"${line.supplier_name ? `, Proveedor: "${line.supplier_name}"` : ''}`
      ).join('\n')

      const prompt = `Eres un experto en clasificación de gastos corporativos.

LÍNEAS A CLASIFICAR:
${batchDescriptions}
${rulesContext}

CATEGORÍAS COMUNES:
- Servicios de TI, Servicios Profesionales, Servicios Generales
- Suministros de Oficina, Suministros Operacionales
- Infraestructura, Energía y Servicios Básicos
- Logística y Transporte, Capacitación
- Equipos y Maquinaria, Materias Primas
- Marketing y Publicidad

FORMATO DE RESPUESTA (JSON array):
[
  {
    "category": "Categoría",
    "subcategory": "Subcategoría (opcional)",
    "confidence": 0.85,
    "justification": "Breve explicación"
  },
  ...
]

Responde SOLO con el JSON array, una clasificación por cada línea en el mismo orden.`

      try {
        const { text } = await generateText({
          model,
          prompt,
          temperature: 0.3,
        })

        // Parsear respuesta
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (!jsonMatch) continue

        const classifications = JSON.parse(jsonMatch[0])

        // Actualizar cada línea
        for (let j = 0; j < batch.length && j < classifications.length; j++) {
          const line = batch[j]
          const classification = classifications[j]

          if (classification.confidence > 1) classification.confidence = 1
          if (classification.confidence < 0) classification.confidence = 0

          const needs_review = classification.confidence < 0.8

          await supabase
            .from('si_spend_lines')
            .update({
              category: classification.category,
              subcategory: classification.subcategory,
              ai_confidence: classification.confidence,
              ai_justification: classification.justification,
              needs_review
            })
            .eq('id', line.id)

          classified_count++
        }

        // Pequeño delay para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (batchError) {
        console.error('Error en lote:', batchError)
        // Continuar con el siguiente lote
      }
    }

    // 6. Actualizar status del upload
    const { data: remainingLines } = await supabase
      .from('si_spend_lines')
      .select('id', { count: 'exact', head: true })
      .eq('upload_id', upload_id)
      .eq('needs_review', true)

    const allClassified = (remainingLines?.length || 0) === 0

    await supabase
      .from('si_uploads')
      .update({ 
        status: allClassified ? 'classified' : 'processing'
      })
      .eq('id', upload_id)

    return NextResponse.json({
      success: true,
      classified_count,
      remaining: remainingLines?.length || 0,
      all_classified: allClassified,
      message: `Se clasificaron ${classified_count} líneas correctamente.`
    })

  } catch (error: any) {
    console.error('Error in SI batch classification:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

