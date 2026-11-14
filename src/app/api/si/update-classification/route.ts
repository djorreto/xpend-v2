import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { hasRole, type Profile } from '@/lib/auth-helpers'
import { SPEND_ROLE_DENIED } from '@/lib/spend-privacy'
import { sameSupplier } from '@/lib/spend-assessment'

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
      .select('id, company_id, role')
      .eq('id', session.user.id)
      .single()

    if (!profile?.company_id) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    if (!hasRole(profile as Profile, 'analyst')) {
      return NextResponse.json({ error: SPEND_ROLE_DENIED }, { status: 403 })
    }

    // 2. Obtener datos de la corrección
    const { line_id, category, subcategory, scope, multi_rubro } = await request.json()
    const appliesToSupplier = scope !== 'line'

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

    let ruleMessage = 'La línea quedó corregida. No se creó una palabra global.'
    if (appliesToSupplier && line.supplier_name) {
      const { data: supplierRules } = await supabase
        .from('si_learning_rules')
        .select('id, pattern, usage_count, success_rate')
        .eq('company_id', profile.company_id)
        .eq('rule_type', 'supplier')
      const existing = (supplierRules || []).find(rule => sameSupplier(rule.pattern, line.supplier_name))
      const source = multi_rubro ? 'supplier_multi' : 'supplier_always'
      if (existing) {
        await supabase
          .from('si_learning_rules')
          .update({
            category,
            subcategory,
            source,
            usage_count: (existing.usage_count || 0) + 1,
            success_rate: Math.min((existing.success_rate || 0.9) + 0.05, 1),
          })
          .eq('id', existing.id)
          .eq('company_id', profile.company_id)
      } else {
        await supabase.from('si_learning_rules').insert({
          company_id: profile.company_id,
          rule_type: 'supplier',
          pattern: line.supplier_name.toLowerCase(),
          category,
          subcategory,
          confidence_boost: 0.2,
          source,
          usage_count: 1,
          success_rate: 0.9,
          created_by: profile.id,
        })
      }
      ruleMessage = multi_rubro
        ? 'El proveedor queda como de varios rubros: la glosa puede cambiar la familia.'
        : 'El proveedor queda con esta familia. Una glosa distinta no la pisa.'
    } else {
      const pattern = String(line.description || '').slice(0, 100).toLowerCase()
      const { data: corrections } = await supabase
        .from('si_learning_rules')
        .select('id')
        .eq('company_id', profile.company_id)
        .eq('rule_type', 'correction')
        .eq('pattern', pattern)
        .limit(1)
      if (corrections?.length) {
        await supabase
          .from('si_learning_rules')
          .update({ category, subcategory, source: 'line_only' })
          .eq('id', corrections[0].id)
          .eq('company_id', profile.company_id)
      } else if (pattern.length >= 8) {
        await supabase.from('si_learning_rules').insert({
          company_id: profile.company_id,
          rule_type: 'correction',
          pattern,
          category,
          subcategory,
          confidence_boost: 0.1,
          source: 'line_only',
          usage_count: 1,
          success_rate: 1,
          created_by: profile.id,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: ruleMessage,
    })

  } catch {
    console.error('Error in SI update classification')
    return NextResponse.json({ error: 'No se pudo actualizar la clasificación' }, { status: 500 })
  }
}


