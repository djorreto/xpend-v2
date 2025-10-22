import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

export const runtime = 'nodejs'
export const maxDuration = 60

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

    // 2. Obtener datos de la solicitud
    const { line_id, description, supplier_name, amount } = await request.json()

    if (!description) {
      return NextResponse.json({ error: 'Descripción requerida' }, { status: 400 })
    }

    // 3. Obtener reglas de aprendizaje existentes
    const { data: rules } = await supabase
      .from('si_learning_rules')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('success_rate', { ascending: false })
      .limit(10)

    // 4. Construir prompt para IA
    const rulesContext = rules && rules.length > 0
      ? `\n\nREGLAS APRENDIDAS (úsalas para mejorar la precisión):\n${rules.map(r => `- Si encuentra "${r.pattern}" → categoría "${r.category}" (confianza +${r.confidence_boost})`).join('\n')}`
      : ''

    const prompt = `Eres un experto en clasificación de gastos corporativos y Strategic Sourcing.

DATOS DE LA LÍNEA DE GASTO:
- Descripción: "${description}"
${supplier_name ? `- Proveedor: "${supplier_name}"` : ''}
${amount ? `- Monto: $${amount}` : ''}
${rulesContext}

INSTRUCCIONES:
1. Analiza la descripción y el proveedor para determinar la categoría de gasto más apropiada.
2. Asigna una categoría principal y una subcategoría si es posible.
3. Proporciona un nivel de confianza (0.0 a 1.0).
4. Justifica brevemente tu clasificación.
5. Sugiere una estrategia de sourcing si es evidente.

CATEGORÍAS COMUNES:
- Servicios de TI (Software, Hardware, Cloud, Soporte técnico, Licencias)
- Servicios Profesionales (Consultoría, Legal, Auditoría, Marketing, RRHH)
- Servicios Generales (Limpieza, Seguridad, Alimentación, Transporte, Mensajería)
- Suministros de Oficina (Papelería, Mobiliario, Equipamiento)
- Suministros Operacionales (Insumos, Materiales, Repuestos)
- Infraestructura (Obras civiles, Mantención, Construcción, Instalaciones)
- Energía y Servicios Básicos (Electricidad, Agua, Gas, Telecomunicaciones, Internet)
- Logística y Transporte (Fletes, Courier, Almacenamiento)
- Capacitación y Desarrollo (Cursos, Entrenamiento, Certificaciones)
- Equipos y Maquinaria (Compra, Arriendo, Mantención)
- Materias Primas (Producción, Manufactura)
- Marketing y Publicidad (Campañas, Eventos, Material promocional)

FORMATO DE RESPUESTA (JSON):
{
  "category": "Categoría principal",
  "subcategory": "Subcategoría (opcional)",
  "confidence": 0.85,
  "justification": "Breve explicación de la clasificación",
  "suggested_strategy": "licitar | consolidar | negociar_marco | monitorear | optimizar"
}

Responde SOLO con el JSON, sin texto adicional.`

    // 5. Llamar a la IA
    const { text } = await generateText({
      model,
      prompt,
      temperature: 0.3,
    })

    // 6. Parsear respuesta
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Respuesta de IA en formato inválido')
    }

    const classification = JSON.parse(jsonMatch[0])

    // Validar confianza
    if (classification.confidence > 1) classification.confidence = 1
    if (classification.confidence < 0) classification.confidence = 0

    // 7. Actualizar línea de gasto si se proporcionó line_id
    if (line_id) {
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
        .eq('id', line_id)
        .eq('company_id', profile.company_id)
    }

    return NextResponse.json({
      success: true,
      classification
    })

  } catch (error: any) {
    console.error('Error in SI classification:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

