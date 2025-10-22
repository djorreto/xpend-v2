import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

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

    // 2. Obtener datos de la corrección
    const { line_id, category, subcategory } = await request.json()

    if (!line_id || !category) {
      return NextResponse.json({
        error: 'line_id y category son requeridos'
      }, { status: 400 })
    }

    // 3. Obtener la línea original
    const { data: line, error: lineError } = await supabase
      .from('si_spend_lines')
      .select('*')
      .eq('id', line_id)
      .eq('company_id', profile.company_id)
      .single()

    if (lineError || !line) {
      return NextResponse.json({ error: 'Línea no encontrada' }, { status: 404 })
    }

    // 4. Actualizar la clasificación
    const { error: updateError } = await supabase
      .from('si_spend_lines')
      .update({
        category,
        subcategory,
        ai_confidence: 1.0, // Confianza máxima en corrección humana
        needs_review: false,
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', line_id)

    if (updateError) throw updateError

    // 5. Extraer keywords de la descripción para aprendizaje
    const keywords = extractKeywords(line.description)

    // 6. Crear o actualizar reglas de aprendizaje
    const learningRules = []

    // Regla basada en keywords (si encuentra keywords significativos)
    if (keywords.length > 0) {
      const keywordPattern = keywords[0].toLowerCase() // Usar el keyword más relevante

      // Verificar si ya existe una regla similar
      const { data: existingRule } = await supabase
        .from('si_learning_rules')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('rule_type', 'keyword')
        .eq('pattern', keywordPattern)
        .single()

      if (existingRule) {
        // Actualizar regla existente
        await supabase
          .from('si_learning_rules')
          .update({
            category,
            subcategory,
            usage_count: existingRule.usage_count + 1,
            success_rate: Math.min(existingRule.success_rate + 0.1, 1.0)
          })
          .eq('id', existingRule.id)
      } else {
        // Crear nueva regla
        learningRules.push({
          company_id: profile.company_id,
          rule_type: 'keyword',
          pattern: keywordPattern,
          category,
          subcategory,
          confidence_boost: 0.15,
          source: 'user_correction',
          usage_count: 1,
          success_rate: 0.8,
          created_by: profile.id
        })
      }
    }

    // Regla basada en proveedor (si existe)
    if (line.supplier_name) {
      const { data: existingSupplierRule } = await supabase
        .from('si_learning_rules')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('rule_type', 'supplier')
        .eq('pattern', line.supplier_name.toLowerCase())
        .single()

      if (existingSupplierRule) {
        await supabase
          .from('si_learning_rules')
          .update({
            category,
            subcategory,
            usage_count: existingSupplierRule.usage_count + 1,
            success_rate: Math.min(existingSupplierRule.success_rate + 0.1, 1.0)
          })
          .eq('id', existingSupplierRule.id)
      } else {
        learningRules.push({
          company_id: profile.company_id,
          rule_type: 'supplier',
          pattern: line.supplier_name.toLowerCase(),
          category,
          subcategory,
          confidence_boost: 0.2,
          source: 'user_correction',
          usage_count: 1,
          success_rate: 0.9,
          created_by: profile.id
        })
      }
    }

    // Regla de corrección específica (few-shot example)
    learningRules.push({
      company_id: profile.company_id,
      rule_type: 'correction',
      pattern: line.description.substring(0, 100), // Primeros 100 caracteres
      category,
      subcategory,
      confidence_boost: 0.1,
      source: 'user_correction',
      usage_count: 1,
      success_rate: 1.0,
      created_by: profile.id
    })

    // Insertar nuevas reglas
    if (learningRules.length > 0) {
      const { error: rulesError } = await supabase
        .from('si_learning_rules')
        .insert(learningRules)

      if (rulesError) {
        console.error('Error al crear reglas de aprendizaje:', rulesError)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Clasificación actualizada y reglas de aprendizaje creadas',
      rules_created: learningRules.length
    })

  } catch (error: any) {
    console.error('Error in SI update classification:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Función para extraer keywords relevantes
function extractKeywords(text: string): string[] {
  // Palabras comunes a ignorar (stop words)
  const stopWords = new Set([
    'de', 'la', 'el', 'los', 'las', 'un', 'una', 'en', 'y', 'a', 'o', 'por', 'para',
    'con', 'sin', 'sobre', 'entre', 'hasta', 'desde', 'the', 'of', 'and', 'or', 'to',
    'in', 'on', 'at', 'for', 'with', 'by', 'from', 'del', 'al'
  ])

  // Limpiar y dividir en palabras
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))

  // Contar frecuencia
  const frequency = new Map<string, number>()
  words.forEach(word => {
    frequency.set(word, (frequency.get(word) || 0) + 1)
  })

  // Ordenar por frecuencia y retornar top 3
  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word)
}

