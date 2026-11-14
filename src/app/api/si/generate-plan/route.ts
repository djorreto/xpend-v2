import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { hasRole, type Profile } from '@/lib/auth-helpers'
import { SPEND_ROLE_DENIED } from '@/lib/spend-privacy'
import { assessLines } from '@/lib/spend-aggregate'
import { loadSpendFacts, viewFromRow } from '@/lib/spend-read'

export const runtime = 'nodejs'
export const maxDuration = 300

type CategoryAgg = {
  total_spend: number
  suppliers: Set<string>
  supplierSpend: Map<string, number>
  lineCount: number
}

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

    const { upload_id, group_id, plan_name, plan_year } = await request.json()
    if (!upload_id && !group_id) {
      return NextResponse.json({ error: 'Falta el análisis o el grupo.' }, { status: 400 })
    }

    let viewSource: {
      display_currency?: string | null
      fx_mode?: string | null
      fx_rates?: Record<string, number> | null
      fx_as_of?: string | null
      window_mode?: string | null
      window_year?: number | null
      window_end?: string | null
    } | null = null
    let members: Array<{ id: string; tax_basis?: string | null; group_id?: string | null; file_name?: string | null }> = []
    let scopeGroupId: string | null = group_id || null

    if (group_id && !upload_id) {
      const { data: group } = await supabase
        .from('si_spend_groups')
        .select('*')
        .eq('id', group_id)
        .eq('company_id', profile.company_id)
        .limit(1)
      viewSource = group?.[0] || null
      if (!viewSource) return NextResponse.json({ error: 'No se encontró el grupo.' }, { status: 404 })
      const { data: rows } = await supabase
        .from('si_uploads')
        .select('id, tax_basis, group_id, file_name')
        .eq('group_id', group_id)
        .eq('company_id', profile.company_id)
      members = rows || []
    } else {
      const { data: rows } = await supabase
        .from('si_uploads')
        .select('id, tax_basis, group_id, file_name, display_currency, fx_mode, fx_rates, fx_as_of, window_mode, window_year, window_end')
        .eq('id', upload_id)
        .eq('company_id', profile.company_id)
        .limit(1)
      const upload = rows?.[0]
      if (!upload) return NextResponse.json({ error: 'No se encontró el análisis.' }, { status: 404 })
      viewSource = upload
      scopeGroupId = upload.group_id || null
      members = [upload]
    }

    const facts = await loadSpendFacts(supabase, profile.company_id, members, true)
    const assessed = assessLines(facts, viewFromRow(viewSource || {}))
    if ('error' in assessed) {
      return NextResponse.json({ error: assessed.error }, { status: 409 })
    }

    const categoryMap = new Map<string, CategoryAgg>()
    const allSuppliers = new Set<string>()
    for (const line of assessed.kept) {
      const category = line.category || ''
      if (!category) continue
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { total_spend: 0, suppliers: new Set(), supplierSpend: new Map(), lineCount: 0 })
      }
      const data = categoryMap.get(category)!
      data.total_spend += line.amount
      data.lineCount += 1
      const supplier = line.supplier?.trim()
      if (supplier) {
        data.suppliers.add(supplier)
        allSuppliers.add(supplier)
        data.supplierSpend.set(supplier, (data.supplierSpend.get(supplier) || 0) + line.amount)
      }
    }

    if (categoryMap.size === 0) {
      return NextResponse.json(
        { error: 'No hay líneas clasificadas para generar el plan' },
        { status: 400 }
      )
    }

    // 5. Calcular métricas globales
    const total_spend = Array.from(categoryMap.values())
      .reduce((sum, cat) => sum + cat.total_spend, 0)

    const max_spend = Math.max(...Array.from(categoryMap.values()).map(c => c.total_spend))
    const max_lines = Math.max(...Array.from(categoryMap.values()).map(c => c.lineCount))
    const max_suppliers = Math.max(...Array.from(categoryMap.values()).map(c => c.suppliers.size), 1)

    const previous = supabase
      .from('si_procurement_plans')
      .select('id')
      .eq('company_id', profile.company_id)
    const { data: previousPlans } = upload_id && !group_id
      ? await previous.eq('upload_id', upload_id)
      : await previous.eq('group_id', scopeGroupId).is('upload_id', null)
    const previousIds = (previousPlans || []).map(plan => plan.id)
    if (previousIds.length) {
      await supabase.from('si_plan_items').delete().in('plan_id', previousIds)
      await supabase.from('si_procurement_plans').delete().in('id', previousIds).eq('company_id', profile.company_id)
    }

    const { data: plan, error: planError } = await supabase
      .from('si_procurement_plans')
      .insert({
        upload_id: upload_id && !group_id ? upload_id : null,
        group_id: scopeGroupId,
        company_id: profile.company_id,
        name: plan_name || `Plan de Compras ${plan_year || new Date().getFullYear()}`,
        plan_year: plan_year || viewSource?.window_year || new Date().getFullYear(),
        status: 'draft',
        total_spend,
        category_count: categoryMap.size,
        supplier_count: allSuppliers.size,
        created_by: profile.id,
        display_currency: assessed.display,
        fx_mode: viewSource?.fx_mode || 'native',
        fx_rates: viewSource?.fx_rates || {},
        fx_as_of: viewSource?.fx_as_of || null,
        stale: false,
      })
      .select()
      .single()

    if (planError) throw planError

    // 7. Crear items del plan con estrategias sugeridas
    const planItems = Array.from(categoryMap.entries()).map(([category, data]) => {
      const supplier_count = data.suppliers.size
      const suppliersBySpend = calculateSupplierConcentrationFromMap(data.supplierSpend)
      const main_supplier = suppliersBySpend[0]?.supplier
      const supplier_concentration = suppliersBySpend[0]?.percentage || 0

      // Determinar estrategia basada en heurísticas
      let strategy: string
      let projected_savings_percentage: number
      let ai_reasoning: string

      if (supplier_count >= 5 && supplier_concentration < 40) {
        strategy = 'licitar'
        projected_savings_percentage = 6.5
        ai_reasoning = `Alta competencia (${supplier_count} proveedores) y baja concentración (${supplier_concentration.toFixed(1)}%). Proceso de licitación puede lograr ahorros significativos.`
      } else if (supplier_count >= 3 && supplier_concentration < 60) {
        strategy = 'consolidar'
        projected_savings_percentage = 4
        ai_reasoning = `${supplier_count} proveedores con concentración media. Consolidar volumen puede mejorar términos y condiciones.`
      } else if (supplier_count <= 2 && supplier_concentration > 70) {
        strategy = 'dual_sourcing'
        projected_savings_percentage = 2.5
        ai_reasoning = `Alta dependencia (${supplier_concentration.toFixed(1)}% en proveedor principal). Diversificar para reducir riesgo.`
      } else if (data.total_spend > max_spend * 0.3) {
        strategy = 'negociar_marco'
        projected_savings_percentage = 5
        ai_reasoning = `Categoría estratégica (${((data.total_spend / total_spend) * 100).toFixed(1)}% del gasto total). Negociar acuerdo marco para mejores condiciones.`
      } else {
        strategy = 'monitorear'
        projected_savings_percentage = 1.5
        ai_reasoning = `Categoría no crítica. Monitorear mercado y evaluar oportunidades de mejora continua.`
      }

      // Calcular Kraljic scores
      const impact_score = (data.total_spend / max_spend) * 0.7 + (data.lineCount / max_lines) * 0.3
      const risk_score = (supplier_concentration / 100) * 0.6 + (1 - supplier_count / max_suppliers) * 0.4

      let kraljic_quadrant: string
      if (impact_score > 0.6 && risk_score > 0.6) {
        kraljic_quadrant = 'strategic'
      } else if (impact_score > 0.6 && risk_score <= 0.6) {
        kraljic_quadrant = 'leverage'
      } else if (impact_score <= 0.6 && risk_score > 0.6) {
        kraljic_quadrant = 'bottleneck'
      } else {
        kraljic_quadrant = 'non_critical'
      }

      // Determinar trimestre recomendado
      const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
      const recommendedQuarter = kraljic_quadrant === 'strategic' ? 'Q1' :
                                 kraljic_quadrant === 'leverage' ? 'Q2' :
                                 kraljic_quadrant === 'bottleneck' ? 'Q1' : 'Q3'

      const projected_savings_amount = (data.total_spend * projected_savings_percentage) / 100

      return {
        plan_id: plan.id,
        company_id: profile.company_id,
        category,
        total_spend: data.total_spend,
        supplier_count,
        main_supplier,
        supplier_concentration,
        strategy,
        recommended_quarter: recommendedQuarter,
        projected_savings_percentage,
        projected_savings_amount,
        ai_reasoning,
        impact_score: Math.min(impact_score, 1),
        risk_score: Math.min(risk_score, 1),
        kraljic_quadrant,
        status: 'pending',
        priority: kraljic_quadrant === 'strategic' || kraljic_quadrant === 'bottleneck' ? 1 :
                  kraljic_quadrant === 'leverage' ? 2 : 3
      }
    })

    const { error: itemsError } = await supabase
      .from('si_plan_items')
      .insert(planItems)

    if (itemsError) throw itemsError

    // 8. Calcular totales del plan
    const total_projected_savings = planItems.reduce((sum, item) =>
      sum + (item.projected_savings_amount || 0), 0)

    const projected_savings_percentage = total_spend > 0 ? (total_projected_savings / total_spend) * 100 : 0

    await supabase
      .from('si_procurement_plans')
      .update({
        projected_savings_amount: total_projected_savings,
        projected_savings_percentage
      })
      .eq('id', plan.id)

    if (upload_id && !group_id) {
      await supabase
        .from('si_uploads')
        .update({ status: 'completed' })
        .eq('id', upload_id)
        .eq('company_id', profile.company_id)
    }

    return NextResponse.json({
      success: true,
      plan_id: plan.id,
      category_count: planItems.length,
      total_spend,
      currency: assessed.display,
      excluded: assessed.excluded,
      projected_savings_amount: total_projected_savings,
      projected_savings_percentage: projected_savings_percentage.toFixed(2),
      message: `Plan generado en ${assessed.display}, con gasto neto.`
    })

  } catch {
    console.error('Error in SI generate plan')
    return NextResponse.json({ error: 'No se pudo generar el plan' }, { status: 500 })
  }
}

function calculateSupplierConcentrationFromMap(supplierSpend: Map<string, number>) {
  let total = 0
  supplierSpend.forEach(amt => {
    total += amt
  })
  if (total <= 0) return []
  return Array.from(supplierSpend.entries())
    .map(([supplier, spend]) => ({
      supplier,
      spend,
      percentage: (spend / total) * 100,
    }))
    .sort((a, b) => b.spend - a.spend)
}

