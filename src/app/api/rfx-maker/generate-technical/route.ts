// API para generar Base Técnica usando la IA existente de XPEND
import { generateRfxTechnicalBaseContent } from '@/lib/ai'
import { NextRequest } from 'next/server'
import type { GenerateTechnicalBaseRequest } from '@/types/rfx-maker'
import { recordExternalAiCall, requireExternalAi } from '@/lib/spend-access'
import { redactOutboundText } from '@/lib/spend-redaction'

export const runtime = 'nodejs'

/**
 * Genera la Base Técnica usando la misma IA de XPEND (Groq + Llama 3.3)
 * Mantiene el mismo tono, estilo y narrativa profesional del resto de la plataforma
 */
export async function POST(req: NextRequest) {
  try {
    const access = await requireExternalAi('analyst')
    if (!access.ok) return access.response

    const body: GenerateTechnicalBaseRequest = await req.json()
    const {
      admin_parameters,
      project_context,
      follow_up_technical,
      follow_up_administrative,
      force_regenerate = false,
    } = body

    const technicalPrompt = buildTechnicalBasePrompt(admin_parameters, project_context, {
      follow_up_technical,
      follow_up_administrative,
    })
    const redacted = redactOutboundText(technicalPrompt)
    if (redacted.blocked) {
      await recordExternalAiCall(access.supabase, {
        company_id: access.profile.company_id,
        user_id: access.profile.id,
        outcome: 'blocked',
        block_reason: 'listado',
        model: 'qwen/qwen3.8-27b',
        payload_chars: technicalPrompt.length,
      })
      return new Response(JSON.stringify({ success: false, error: 'La base parece un listado de gasto. No se envió a la IA.' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const recorded = await recordExternalAiCall(access.supabase, {
      company_id: access.profile.company_id,
      user_id: access.profile.id,
      outcome: 'sent',
      model: 'qwen/qwen3.8-27b',
      payload_chars: redacted.text.length,
    })
    if (!recorded) {
      return new Response(JSON.stringify({ success: false, error: 'No se pudo registrar el envío. El texto no salió de Xpend.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const generatedContent = await generateRfxTechnicalBaseContent(redacted.text)

    // Retornar el contenido generado
    return new Response(
      JSON.stringify({
        success: true,
        content: generatedContent,
        tokens_used: null,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error generating technical base:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Error al generar base técnica',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

/**
 * Construye el prompt para la generación de Base Técnica
 * Mantiene el estilo y tono de XPEND
 */
function buildTechnicalBasePrompt(
  adminParameters: Record<string, any>,
  projectContext: Record<string, any>,
  extras?: {
    follow_up_technical?: Record<string, string>
    follow_up_administrative?: Record<string, string>
  }
): string {
  const {
    rfx_type = 'RFP',
    project_title,
    industry,
    project_budget,
    deadline,
    special_requirements = [],
  } = projectContext

  const {
    currency = 'CLP',
    performance_bond_percent,
    proposal_validity_days,
    payment_terms,
    delivery_timeline,
  } = adminParameters

  return `Actúa como experto en Strategic Sourcing y redacción de Bases Técnicas profesionales.

Necesito que generes una Base Técnica completa para un proceso de ${rfx_type} con las siguientes características:

**CONTEXTO DEL PROYECTO:**
- Título: ${project_title || 'Proyecto de Abastecimiento'}
- Industria: ${industry || 'No especificada'}
- Presupuesto estimado: ${project_budget ? `${currency} ${project_budget.toLocaleString()}` : 'Por definir'}
- Plazo de ejecución: ${delivery_timeline || deadline || 'Por definir'}

**PARÁMETROS ADMINISTRATIVOS (REFERENCIA):**
- Moneda: ${currency}
- Garantía de seriedad: ${performance_bond_percent || 'Por definir'}%
- Vigencia de propuesta: ${proposal_validity_days || 'Por definir'} días
- Condiciones de pago: ${payment_terms || 'Por definir'}
- Plazo de entrega: ${delivery_timeline || 'Por definir'}

${special_requirements.length > 0 ? `**REQUISITOS ESPECIALES:**\n${special_requirements.map((req: string) => `- ${req}`).join('\n')}` : ''}

${formatFollowUps('ACLARATORIOS TÉCNICOS (respuestas del usuario)', extras?.follow_up_technical)}

${formatFollowUps('ACLARATORIOS ADMINISTRATIVOS / COMERCIALES (respuestas del usuario)', extras?.follow_up_administrative)}

**INSTRUCCIONES:**

Genera una Base Técnica profesional y completa siguiendo esta estructura:

1. **INTRODUCCIÓN Y ANTECEDENTES**
   - Contexto general del proyecto
   - Objetivos estratégicos
   - Alcance general

2. **OBJETO DE LA CONTRATACIÓN**
   - Descripción detallada de los servicios/productos requeridos
   - Especificaciones técnicas mínimas
   - Estándares de calidad esperados

3. **ALCANCE DEL SERVICIO/PRODUCTO**
   - Actividades incluidas
   - Actividades excluidas
   - Entregables esperados

4. **REQUISITOS TÉCNICOS**
   - Especificaciones técnicas detalladas
   - Capacidades técnicas requeridas del proveedor
   - Experiencia y certificaciones necesarias
   - Personal clave requerido (si aplica)

5. **CRITERIOS DE EVALUACIÓN**
   - Evaluación técnica (ponderación y criterios)
   - Evaluación económica (ponderación)
   - Factores de desempate
   - Puntaje mínimo requerido

6. **REQUISITOS DE DOCUMENTACIÓN**
   - Documentos técnicos a presentar
   - Certificaciones requeridas
   - Referencias y casos de éxito
   - Propuesta económica (formato)

7. **CONDICIONES DE EJECUCIÓN**
   - Plazos y cronograma
   - Lugar de ejecución
   - Supervisión y seguimiento
   - Garantías técnicas post-entrega

8. **ANEXOS TÉCNICOS (si aplica)**
   - Formatos de propuesta
   - Especificaciones adicionales
   - Matrices de evaluación

**ESTILO Y TONO:**
- Profesional, claro y directo (estilo Xpend)
- Lenguaje técnico pero accesible
- Sin ambigüedades
- Orientado a la acción
- Formato Markdown con headers, bullets y numeración

**IMPORTANTE:**
- NO repitas información administrativa (eso va en la Base Administrativa)
- Enfócate en aspectos TÉCNICOS y de CALIDAD
- Sé específico en los requisitos técnicos
- Incluye criterios de evaluación cuantificables
- Mantén consistencia con los parámetros administrativos de referencia

Genera la Base Técnica ahora:`
}

function formatFollowUps(title: string, m?: Record<string, string>): string {
  if (!m || Object.keys(m).length === 0) return ''
  const lines = Object.entries(m)
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `- **${k}:** ${String(v).trim()}`)
  if (lines.length === 0) return ''
  return `**${title}:**\n${lines.join('\n')}\n`
}

