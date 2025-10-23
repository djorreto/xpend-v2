// src/lib/ai.ts
import { createOpenAI } from '@ai-sdk/openai'
import { generateText, streamText } from 'ai'

// Función para obtener la API key (compatible con Edge Runtime)
function getGroqApiKey() {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.GROQ_API_KEY || ''
  }
  return ''
}

// Groq es compatible con la API de OpenAI
const groq = createOpenAI({
  apiKey: getGroqApiKey(),
  baseURL: 'https://api.groq.com/openai/v1',
})

// Modelo recomendado: llama-3.3-70b-versatile (actualizado, rápido y potente)
const model = groq('llama-3.3-70b-versatile')

/**
 * Contexto y personalidad de ANA
 * ANA = Asistente de Negociaciones y Abastecimiento
 * Experta en Strategic Sourcing con enfoque ejecutivo y humano:
 * - Estrategia de categorías
 * - Análisis de líneas base (baseline)
 * - Especificaciones técnicas
 * - Negociación con proveedores
 * - RFP/RFQ/RFI
 * - Total Cost of Ownership (TCO)
 * - Savings tracking
 */
const ANA_SYSTEM_PROMPT = `Eres ANA (Asistente de Negociaciones y Abastecimiento), una experta consultora en Strategic Sourcing con más de 15 años de experiencia.

TU PERSONALIDAD:
- Eres cercana, simple y humana
- Hablas como una colega de confianza, no como un robot
- Prefieres respuestas ejecutivas: MENOS ES MÁS
- Vas directo al grano sin rodeos innecesarios
- Eres práctica y orientada a la acción

TU ENFOQUE:
- Respuestas cortas y puntuales (máximo 3-4 líneas cuando sea posible)
- Solo das el contexto necesario, nada más
- Priorizas la claridad sobre la exhaustividad
- Usas lenguaje simple, evitas jerga excesiva
- Cuando algo es complejo, lo simplificas sin perder precisión

TU EXPERIENCIA:
- Estrategia de categorías
- Negociación con proveedores
- RFP, RFQ, RFI
- TCO y análisis de costos
- Especificaciones técnicas

TU MISIÓN:
Ayudar a los usuarios de Xpend a tomar decisiones rápidas y acertadas en sourcing, sin complicaciones.

ESTILO DE RESPUESTAS:
✅ "Te sugiero X porque Y. ¿Necesitas más detalles?"
✅ "Dos opciones: 1) X  2) Y. ¿Cuál te hace más sentido?"
✅ "Lo clave aquí es X. El resto es secundario."
✅ "Ojo: X puede ser un riesgo. Prioriza Y."

❌ Evita respuestas largas o con demasiado contexto
❌ No des toda tu experiencia en una sola respuesta
❌ No uses formalidades excesivas

FORMATO:
- Usa bullet points solo si son 3 o menos
- Sé directa: primero la respuesta, luego (si es necesario) el porqué
- Si te preguntan algo complejo, ofrece un resumen ejecutivo y pregunta si necesitan detalles

IMPORTANTE:
- NO inventes datos
- Si no sabes algo, dilo simple: "No tengo esa info, pero podrías..."
- Adapta tu respuesta al nivel de urgencia del usuario`

/**
 * Genera una respuesta de ANA (sin streaming)
 */
export async function generateAnaResponse(userMessage: string, conversationHistory: string = '') {
  try {
    const { text } = await generateText({
      model,
      system: ANA_SYSTEM_PROMPT,
      prompt: `${conversationHistory}\n\nUsuario: ${userMessage}\n\nANA:`,
      temperature: 0.7,
      maxTokens: 800, // Reducido para respuestas más concisas
    })

    return text
  } catch (error) {
    console.error('Error generating ANA response:', error)
    throw new Error('No pude generar una respuesta. ¿Está configurada la API key de Groq?')
  }
}

/**
 * Genera una respuesta de ANA (con streaming para chat en tiempo real)
 */
export async function streamAnaResponse(userMessage: string, conversationHistory: string = '') {
  try {
    const result = await streamText({
      model,
      system: ANA_SYSTEM_PROMPT,
      prompt: `${conversationHistory}\n\nUsuario: ${userMessage}\n\nANA:`,
      temperature: 0.7,
      maxTokens: 800, // Reducido para respuestas más concisas
    })

    return result
  } catch (error) {
    console.error('Error streaming ANA response:', error)
    throw new Error('No pude generar una respuesta. ¿Está configurada la API key de Groq?')
  }
}

// Mantener compatibilidad con código legacy
export const generateJuanResponse = generateAnaResponse
export const streamJuanResponse = streamAnaResponse

/**
 * Analiza un documento técnico (spec, RFP, TDR, etc.)
 */
export async function analyzeDocument(documentText: string, documentType: string = 'Especificación Técnica') {
  try {
    const prompt = `Analiza el siguiente ${documentType} y determina si está completo o incompleto.

Revisa específicamente:
1. ✅ ALCANCE: ¿Está claro el objeto de la contratación?
2. ✅ REQUISITOS TÉCNICOS: ¿Están todos los requisitos técnicos detallados?
3. ✅ CRITERIOS DE EVALUACIÓN: ¿Están definidos los criterios de selección?
4. ✅ CONDICIONES COMERCIALES: ¿Plazo de entrega, garantías, pagos?
5. ✅ DOCUMENTACIÓN REQUERIDA: ¿Qué deben presentar los proveedores?
6. ✅ CLARIDAD: ¿Hay ambigüedades o falta información crítica?

DOCUMENTO:
---
${documentText.substring(0, 8000)} ${documentText.length > 8000 ? '...(truncado)' : ''}
---

RESPONDE EN ESTE FORMATO:

**ESTADO GENERAL:** [COMPLETO / INCOMPLETO / REQUIERE MEJORAS]

**PUNTOS FUERTES:**
- [Lista los aspectos bien definidos]

**PUNTOS DÉBILES / FALTANTES:**
- [Lista lo que falta o está mal definido]

**RECOMENDACIONES:**
- [Sugiere mejoras concretas]

**RIESGO:**
[Bajo / Medio / Alto] - Justifica el nivel de riesgo si se publica así`

    const { text } = await generateText({
      model,
      system: ANA_SYSTEM_PROMPT,
      prompt,
      temperature: 0.5, // Más determinístico para análisis
      maxTokens: 1200, // Más conciso
    })

    return text
  } catch (error) {
    console.error('Error analyzing document:', error)
    throw new Error('No pude analizar el documento. Intenta de nuevo.')
  }
}

