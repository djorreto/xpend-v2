'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading'
import { EmptyHint } from '@/components/workspace-blocks'
import { supabaseBrowser } from '@/lib/supabase'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { can } from '@/lib/navigation'
import { formatCurrency } from '@/lib/utils'

type Opportunity = {
  id: string
  category: string | null
  total_spend: number | null
  supplier_count: number | null
  strategy: string | null
  recommended_quarter: string | null
  projected_savings_amount: number | null
  kraljic_quadrant: string | null
  priority: number | null
  plan: { upload_id: string | null; name: string | null; plan_year: number | null; display_currency: string | null } | { upload_id: string | null; name: string | null; plan_year: number | null; display_currency: string | null }[] | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] || null : value || null
}

export default function OportunidadesPage() {
  const router = useRouter()
  const [session, setSession] = useState<AppSession | null>(null)
  const [items, setItems] = useState<Opportunity[]>([])
  const [inPlan, setInPlan] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAppSession().then(async appSession => {
      if (!appSession) {
        router.replace('/login')
        return
      }
      if (appSession.role === 'supplier') {
        router.replace('/sala')
        return
      }
      setSession(appSession)
      if (!appSession.companyId || !can(appSession.role, 'readSpend')) {
        setLoading(false)
        return
      }
      const supabase = supabaseBrowser()
      const [opportunities, plans] = await Promise.all([
        supabase.from('si_plan_items')
          .select('id, category, total_spend, supplier_count, strategy, recommended_quarter, projected_savings_amount, kraljic_quadrant, priority, plan:si_procurement_plans(upload_id, name, plan_year, display_currency)')
          .eq('company_id', appSession.companyId)
          .order('total_spend', { ascending: false })
          .limit(300),
        supabase.from('sourcing_plans').select('category, title').eq('company_id', appSession.companyId).limit(1000),
      ])
      setItems((opportunities.data || []) as Opportunity[])
      setInPlan(new Set((plans.data || []).map(row => String(row.category || row.title || '').trim().toLowerCase()).filter(Boolean)))
      setLoading(false)
    })
  }, [router])

  if (loading || !session) return <MainLayout><LoadingSpinner /></MainLayout>

  const layoutUser = { name: session.name, email: session.email, role: session.role }
  if (!can(session.role, 'readSpend')) {
    return (
      <MainLayout user={layoutUser} companyName={session.companyName}>
        <EmptyHint>Tu perfil no tiene acceso al gasto. Las oportunidades salen del análisis de gasto.</EmptyHint>
      </MainLayout>
    )
  }

  return (
    <MainLayout user={layoutUser} companyName={session.companyName}>
      <div className="space-y-5">
        <div>
          <h1>Oportunidades</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-petrol-blue/60">
            Categorías sugeridas por el análisis de gasto, de todas las cargas. El ahorro proyectado es una hipótesis para priorizar, no un resultado.
            Para llevar una categoría al plan, ábrela en su análisis.
          </p>
        </div>

        {items.length === 0 ? (
          <EmptyHint>
            Todavía no hay oportunidades. Se generan al analizar una carga de gasto en{' '}
            <Link href="/sourcing-intelligence" className="font-medium underline">Clasificación y categorías</Link>.
          </EmptyHint>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-petrol-blue/[0.06]">
                {items.map(item => {
                  const plan = one(item.plan)
                  const currency = plan?.display_currency || 'CLP'
                  const key = String(item.category || '').trim().toLowerCase()
                  const already = key && inPlan.has(key)
                  return (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-petrol-blue">{item.category || 'Categoría sin nombre'}</p>
                        <p className="text-[12px] text-petrol-blue/60">
                          Gasto {formatCurrency(Number(item.total_spend) || 0, currency)}
                          {item.supplier_count != null ? ` · ${item.supplier_count} proveedores` : ''}
                          {item.kraljic_quadrant ? ` · ${item.kraljic_quadrant}` : ''}
                          {item.recommended_quarter ? ` · sugerido ${item.recommended_quarter}` : ''}
                        </p>
                        <p className="text-[11.5px] text-petrol-blue/50">
                          Ahorro proyectado (hipótesis): {item.projected_savings_amount != null ? formatCurrency(Number(item.projected_savings_amount), currency) : 'Sin información'}
                          {plan?.name ? ` · ${plan.name}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {already && <span className="rounded-full bg-accent-mint/30 px-2 py-0.5 text-[11px] text-petrol-blue">Ya está en el plan</span>}
                        {plan?.upload_id && (
                          <Link href={`/sourcing-intelligence/${plan.upload_id}/plan`} className="rounded-full border border-petrol-blue/15 bg-white/70 px-3 py-1.5 text-[12px] font-medium text-petrol-blue hover:bg-white">
                            {already || !can(session.role, 'createInitiative') ? 'Ver análisis' : 'Ver y llevar al plan'}
                          </Link>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
