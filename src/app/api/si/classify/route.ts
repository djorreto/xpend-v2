import { NextRequest, NextResponse } from 'next/server'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { assessmentPrompt, classifySpendLine, modelNeedsReview, parseAssessment } from '@/lib/spend-assessment'
import { BASE_TAXONOMY, knownFamily, taxonomyFromRules } from '@/lib/spend-taxonomy'
import { requireSpendAccess } from '@/lib/spend-access'
import { EXTERNAL_AI_DISABLED, externalAiAllowed } from '@/lib/spend-privacy'
import { REDACTION_MESSAGES, redactSpendDescription } from '@/lib/spend-redaction'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL_NAME = 'qwen/qwen3.8-27b'

function getGroq() {
  return createOpenAI({
    apiKey: process.env.GROQ_API_KEY || '',
    baseURL: 'https://api.groq.com/openai/v1',
  })
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireSpendAccess('analyst')
    if (!access.ok) return access.response
    const { supabase, profile, settings } = access

    const body = await request.json().catch(() => ({}))
    const lineId = body?.line_id
    if (!lineId || typeof lineId !== 'string') {
      return NextResponse.json({ error: 'line_id requerido' }, { status: 400 })
    }

    const { data: line, error: lineError } = await supabase
      .from('si_spend_lines')
      .select('id, description, supplier_name')
      .eq('id', lineId)
      .eq('company_id', profile.company_id)
      .single()

    if (lineError || !line) {
      return NextResponse.json({ error: 'Línea no encontrada' }, { status: 404 })
    }

    const { data: rules } = await supabase
      .from('si_learning_rules')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('success_rate', { ascending: false })
      .limit(80)

    const nodes = taxonomyFromRules(rules || [])
    const remembered = await classifySpendLine(line.description, line.supplier_name, rules || [], nodes)
    if (remembered) {
      const needs_review = remembered.source === 'modelo' && modelNeedsReview(remembered.confidence)
      await supabase
        .from('si_spend_lines')
        .update({
          category: remembered.category,
          subcategory: remembered.subcategory,
          ai_confidence: remembered.confidence,
          ai_justification: remembered.justification,
          needs_review,
        })
        .eq('id', line.id)
        .eq('company_id', profile.company_id)

      return NextResponse.json({
        success: true,
        external: false,
        classification: remembered,
      })
    }

    if (!externalAiAllowed(settings)) {
      return NextResponse.json({ error: EXTERNAL_AI_DISABLED, external: false }, { status: 403 })
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'La categorización externa no está configurada' }, { status: 503 })
    }

    const redacted = redactSpendDescription(line.description, line.supplier_name)
    const audit = {
      company_id: profile.company_id,
      line_id: line.id,
      user_id: profile.id,
      model: MODEL_NAME,
      payload_chars: redacted.text.length,
    }

    if (redacted.blocked) {
      await supabase.from('si_ai_calls').insert({
        ...audit,
        outcome: 'blocked',
        block_reason: redacted.reason,
      })
      return NextResponse.json({
        success: false,
        external: false,
        blocked: true,
        reason: redacted.reason,
        message: REDACTION_MESSAGES[redacted.reason],
      })
    }

    const { error: auditError } = await supabase.from('si_ai_calls').insert({
      ...audit,
      outcome: 'sent',
      block_reason: null,
    })
    if (auditError) {
      return NextResponse.json({ error: 'No se pudo registrar el envío. La línea no salió de Xpend.' }, { status: 503 })
    }

    const { text } = await generateText({
      model: getGroq()(MODEL_NAME),
      prompt: assessmentPrompt(redacted.text),
      temperature: 0.2,
    })

    const classification = parseAssessment(text, nodes)
    const familyKnown = knownFamily(nodes.length ? nodes : BASE_TAXONOMY, classification.category)
    if (!familyKnown) {
      return NextResponse.json({
        success: false,
        external: true,
        unclassified: true,
        message: 'La IA no encontró una categoría de la taxonomía. La línea queda para completarla a mano.',
      })
    }
    const needs_review = classification.confidence < 0.8
    await supabase
      .from('si_spend_lines')
      .update({
        category: classification.category,
        subcategory: classification.subcategory,
        ai_confidence: classification.confidence,
        ai_justification: `Modelo general. ${classification.justification}`,
        needs_review,
      })
      .eq('id', line.id)
      .eq('company_id', profile.company_id)

    return NextResponse.json({
      success: true,
      external: true,
      classification,
    })
  } catch {
    console.error('Error in SI classification')
    return NextResponse.json({ error: 'No se pudo categorizar la línea' }, { status: 500 })
  }
}
