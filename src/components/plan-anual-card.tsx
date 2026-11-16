'use client'

import { useEffect, useState } from 'react'
import { BlockCard, EmptyHint } from '@/components/workspace-blocks'
import { supabaseBrowser } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

type Line = { currency: string; target_amount: number | null; historical_spend: number | null; category_id: string }

// Resumen del Plan Anual de la empresa activa: estado, categorías con meta y totales por moneda (sin conversión).
export function PlanAnualCard({ companyId, year }: { companyId: string; year: number }) {
  const [state, setState] = useState<{ status: string; committedAt: string | null; lines: Line[] } | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    const supabase = supabaseBrowser()
    supabase.from('annual_plans').select('id, status, committed_at').eq('company_id', companyId).eq('plan_year', year).maybeSingle().then(async ({ data: plan }) => {
      if (!alive) return
      if (!plan) return setState(null)
      const { data: lines } = await supabase.from('annual_plan_lines').select('currency, target_amount, historical_spend, category_id').eq('annual_plan_id', plan.id)
      if (alive) setState({ status: plan.status as string, committedAt: plan.committed_at as string | null, lines: (lines || []) as Line[] })
    })
    return () => { alive = false }
  }, [companyId, year])

  const totals = new Map<string, { target: number; spend: number }>()
  for (const line of state?.lines || []) {
    const current = totals.get(line.currency) || { target: 0, spend: 0 }
    current.target += Number(line.target_amount || 0)
    current.spend += Number(line.historical_spend || 0)
    totals.set(line.currency, current)
  }

  return (
    <BlockCard title={`Plan anual de abastecimiento ${year}`} description="Metas por categoría y moneda. Un plan comprometido conserva la foto original y cada revisión queda registrada." action={{ label: 'Abrir plan anual', href: '/plan-anual' }}>
      {state === undefined ? <EmptyHint>Cargando…</EmptyHint> : state === null ? <EmptyHint>No hay un plan anual {year} para esta empresa.</EmptyHint> : (
        <div data-testid="plan-anual-card" className="space-y-2 text-[13px]">
          <p><strong>{state.status === 'committed' ? 'Comprometido' : 'Borrador'}</strong>{state.committedAt ? ` el ${new Date(state.committedAt).toLocaleDateString('es-CL')}` : ''} · {state.lines.length} líneas de categoría</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from(totals.entries()).map(([currency, value]) => (
              <div key={currency} className="glass-chip p-3">
                <p className="text-[12px] text-petrol-blue/75">{currency}</p>
                <p>Gasto base <strong>{formatCurrency(value.spend, currency)}</strong></p>
                <p>Meta de ahorro <strong>{formatCurrency(value.target, currency)}</strong></p>
              </div>
            ))}
          </div>
        </div>
      )}
    </BlockCard>
  )
}
