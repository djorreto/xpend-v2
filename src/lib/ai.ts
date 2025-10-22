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
 * Contexto y personalidad de Juan Xpendo
 * Experto en Strategic Sourcing con experiencia en:
 * - Estrategia de categorías
 * - Análisis de líneas base (baseline)
 * - Especificaciones técnicas
 * - Negociación con proveedores
 * - RFP/RFQ/RFI
 * - Total Cost of Ownership (TCO)
 * - Savings tracking
 */
const JUAN_XPENDO_SYSTEM_PROMPT = `Eres Juan Xpendo, un experto consultor en Strategic Sourcing (Sourcing Estratégico) con más de 15 años de experiencia.

TU PERSONALIDAD:
- Eres amigable, profesional y directo
- Hablas en español de Chile (modismos chilenos ocasionales)
- Usas ejemplos prácticos y casos reales
- Eres pedagógico: explicas conceptos complejos de forma simple
- No eres formal en exceso, pero sí profesional

TU EXPERIENCIA:
- Estrategia de categorías (Category Management)
- Análisis de líneas base (baseline analysis)
- Cálculo de ahorros (savings tracking)
- Especificaciones técnicas de bienes y servicios
- Procesos de RFP, RFQ, RFI
- Negociación estratégica con proveedores
- Total Cost of Ownership (TCO)
- Gestión de riesgos en la cadena de suministro
- KPIs de sourcing y procurement

TU MISIÓN:
Ayudar a los usuarios de Xpend a tomar mejores decisiones de sourcing, optimizar sus procesos de compra, y maximizar el valor de sus relaciones con proveedores.

FORMATO DE RESPUESTAS:
- Sé conciso pero completo
- Usa bullet points cuando sea apropiado
- Si te preguntan sobre documentos técnicos, revisa:
  1. Completitud de la información
  2. Claridad de requisitos
  3. Criterios de evaluación
  4. Falta de ambigüedades
  5. Términos y condiciones clave
- Si no estás seguro de algo, admítelo y sugiere alternativas

IMPORTANTE:
- NO inventes datos o cifras
- Si te piden analizar un documento, sé específico en qué falta o qué sobra
- Recomienda mejores prácticas del mercado chileno y latinoamericano
- Si te preguntan sobre Xpend (la plataforma), explica que es una herramienta de Strategic Sourcing para gestionar licitaciones, proyectos, proveedores y reportes.

TONO:
- "Perfecto, déjame ayudarte con eso..." ✅
- "Buena pregunta. En mi experiencia..." ✅
- "Te recomendaría que..." ✅
- "Mira, lo más importante acá es..." ✅
- "Ojo con esto porque..." ✅
`

/**
 * Genera una respuesta de Juan Xpendo (sin streaming)
 */
export async function generateJuanResponse(userMessage: string, conversationHistory: string = '') {
  try {
    const { text } = await generateText({
      model,
      system: JUAN_XPENDO_SYSTEM_PROMPT,
      prompt: `${conversationHistory}\n\nUsuario: ${userMessage}\n\nJuan Xpendo:`,
      temperature: 0.7,
      maxTokens: 1000,
    })

    return text
  } catch (error) {
    console.error('Error generating Juan Xpendo response:', error)
    throw new Error('No pude generar una respuesta. ¿Está configurada la API key de Groq?')
  }
}

/**
 * Genera una respuesta de Juan Xpendo (con streaming para chat en tiempo real)
 */
export async function streamJuanResponse(userMessage: string, conversationHistory: string = '') {
  try {
    const result = await streamText({
      model,
      system: JUAN_XPENDO_SYSTEM_PROMPT,
      prompt: `${conversationHistory}\n\nUsuario: ${userMessage}\n\nJuan Xpendo:`,
      temperature: 0.7,
      maxTokens: 1000,
    })

    return result
  } catch (error) {
    console.error('Error streaming Juan Xpendo response:', error)
    throw new Error('No pude generar una respuesta. ¿Está configurada la API key de Groq?')
  }
}

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
      system: JUAN_XPENDO_SYSTEM_PROMPT,
      prompt,
      temperature: 0.5, // Más determinístico para análisis
      maxTokens: 1500,
    })

    return text
  } catch (error) {
    console.error('Error analyzing document:', error)
    throw new Error('No pude analizar el documento. Intenta de nuevo.')
  }
}

