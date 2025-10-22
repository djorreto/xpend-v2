import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const maxDuration = 60

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
    const { upload_id, plan_name, plan_year } = await request.json()

    if (!upload_id) {
      return NextResponse.json({ error: 'upload_id requerido' }, { status: 400 })
    }

    // 3. Analizar datos de gasto por categoría
    const { data: lines } = await supabase
      .from('si_spend_lines')
      .select('*')
      .eq('upload_id', upload_id)
      .eq('company_id', profile.company_id)
      .not('category', 'is', null)

    if (!lines || lines.length === 0) {
      return NextResponse.json({
        error: 'No hay líneas clasificadas para generar el plan'
      }, { status: 400 })
    }

    // 4. Agrupar por categoría y analizar
    const categoryMap = new Map<string, {
      total_spend: number
      suppliers: Set<string>
      lines: typeof lines
    }>()

    lines.forEach(line => {
      const category = line.category!
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          total_spend: 0,
          suppliers: new Set(),
          lines: []
        })
      }

      const data = categoryMap.get(category)!
      data.total_spend += line.amount
      if (line.supplier_name) {
        data.suppliers.add(line.supplier_name)
      }
      data.lines.push(line)
    })

    // 5. Calcular métricas globales
    const total_spend = Array.from(categoryMap.values())
      .reduce((sum, cat) => sum + cat.total_spend, 0)

    const max_spend = Math.max(...Array.from(categoryMap.values()).map(c => c.total_spend))
    const max_lines = Math.max(...Array.from(categoryMap.values()).map(c => c.lines.length))
    const max_suppliers = Math.max(...Array.from(categoryMap.values()).map(c => c.suppliers.size))

    // 6. Crear plan de compras
    const { data: plan, error: planError } = await supabase
      .from('si_procurement_plans')
      .insert({
        upload_id,
        company_id: profile.company_id,
        name: plan_name || `Plan de Compras ${new Date().getFullYear()}`,
        plan_year: plan_year || new Date().getFullYear(),
        status: 'draft',
        total_spend,
        category_count: categoryMap.size,
        supplier_count: new Set(lines.map(l => l.supplier_name).filter(Boolean)).size,
        created_by: profile.id
      })
      .select()
      .single()

    if (planError) throw planError

    // 7. Crear items del plan con estrategias sugeridas
    const planItems = Array.from(categoryMap.entries()).map(([category, data]) => {
      const supplier_count = data.suppliers.size
      const suppliersBySpend = calculateSupplierConcentration(data.lines)
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
      const impact_score = (data.total_spend / max_spend) * 0.7 + (data.lines.length / max_lines) * 0.3
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

    const projected_savings_percentage = (total_projected_savings / total_spend) * 100

    await supabase
      .from('si_procurement_plans')
      .update({
        projected_savings_amount: total_projected_savings,
        projected_savings_percentage
      })
      .eq('id', plan.id)

    // 9. Actualizar status del upload
    await supabase
      .from('si_uploads')
      .update({ status: 'completed' })
      .eq('id', upload_id)

    return NextResponse.json({
      success: true,
      plan_id: plan.id,
      category_count: planItems.length,
      total_spend,
      projected_savings_amount: total_projected_savings,
      projected_savings_percentage: projected_savings_percentage.toFixed(2),
      message: `Plan de compras generado exitosamente con ${planItems.length} categorías.`
    })

  } catch (error: any) {
    console.error('Error in SI generate plan:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Función auxiliar para calcular concentración de proveedores
function calculateSupplierConcentration(lines: any[]) {
  const supplierSpend = new Map<string, number>()
  let total = 0

  lines.forEach(line => {
    if (line.supplier_name) {
      const current = supplierSpend.get(line.supplier_name) || 0
      supplierSpend.set(line.supplier_name, current + line.amount)
      total += line.amount
    }
  })

  return Array.from(supplierSpend.entries())
    .map(([supplier, spend]) => ({
      supplier,
      spend,
      percentage: (spend / total) * 100
    }))
    .sort((a, b) => b.spend - a.spend)
}

