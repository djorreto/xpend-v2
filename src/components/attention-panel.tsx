'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BlockCard, EmptyHint } from '@/components/workspace-blocks'
import { supabaseBrowser } from '@/lib/supabase'
import { can } from '@/lib/navigation'
import { loadProjectsFor } from '@/lib/project-data'
import { todayISO } from '@/lib/project'
import { buyerToday, managerAttention, RULE_LABEL, type AttentionInput, type AttentionRule, type TodayItem } from '@/lib/attention'
import { cn } from '@/lib/utils'

type Loaded = { input: AttentionInput; myLast: { project_id: string; summary: string; at: string } | null }

async function loadAttention(companyId: string, role: string, userId: string): Promise<Loaded> {
  const supabase = supabaseBrowser()
  const readContracts = can(role, 'readContracts')
  const [portfolio, baselines, activity, mine, contracts, relations, links, plans, savings, people] = await Promise.all([
    loadProjectsFor(supabase, companyId),
    supabase.from('economic_baselines').select('project_id, status').eq('company_id', companyId).limit(1000),
    supabase.from('project_activity').select('project_id, at').eq('company_id', companyId).order('at', { ascending: false }).limit(1500),
    supabase.from('project_activity').select('project_id, summary, at').eq('company_id', companyId).eq('actor_id', userId).order('at', { ascending: false }).limit(1),
    readContracts ? supabase.from('contracts').select('id, name, code, status, ends_on, owner_id').eq('company_id', companyId).eq('status', 'active').limit(1000) : Promise.resolve({ data: [] }),
    readContracts ? supabase.from('contract_relations').select('from_contract_id').eq('company_id', companyId).limit(2000) : Promise.resolve({ data: [] }),
    supabase.from('project_contracts').select('contract_id, project_id, role').eq('company_id', companyId).limit(2000),
    supabase.from('sourcing_plans').select('id, title, status, responsible_user_id, projected_savings_amount, currency, planned_end_date, is_spot').eq('company_id', companyId).in('status', ['planned', 'in_progress']).limit(1000),
    supabase.from('savings_validations').select('id, sourcing_plan_id, status, declared_at, validated_amount, currency').eq('company_id', companyId).in('status', ['declared', 'validated']).limit(2000),
    supabase.from('profiles').select('id, full_name, email').eq('company_id', companyId).limit(500),
  ])
  const lastActivity = new Map<string, string>()
  for (const row of (activity.data || []) as { project_id: string; at: string }[]) if (!lastActivity.has(row.project_id)) lastActivity.set(row.project_id, row.at)
  return {
    input: {
      today: todayISO(),
      projects: portfolio.projects,
      tasks: portfolio.tasks,
      deliverables: portfolio.deliverables,
      facts: portfolio.facts,
      approvals: portfolio.approvals,
      baselines: (baselines.data || []) as AttentionInput['baselines'],
      lastActivity,
      contracts: (contracts.data || []) as AttentionInput['contracts'],
      relations: (relations.data || []) as AttentionInput['relations'],
      projectContracts: (links.data || []) as AttentionInput['projectContracts'],
      initiatives: (plans.data || []) as AttentionInput['initiatives'],
      savings: (savings.data || []) as AttentionInput['savings'],
      names: new Map(((people.data || []) as { id: string; full_name: string | null; email: string }[]).map(item => [item.id, item.full_name || item.email])),
    },
    myLast: ((mine.data || [])[0] as Loaded['myLast']) || null,
  }
}

function useAttention(companyId: string, role: string, userId: string) {
  const [data, setData] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    loadAttention(companyId, role, userId).then(result => { if (alive) setData(result) }).catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [companyId, role, userId])
  return { data, failed }
}

export function ManagerAttention({ companyId, role, userId }: { companyId: string; role: string; userId: string }) {
  const { data, failed } = useAttention(companyId, role, userId)
  const [rule, setRule] = useState<AttentionRule | null>(null)
  const items = useMemo(() => (data ? managerAttention(data.input) : []), [data])
  const counts = useMemo(() => {
    const map = new Map<AttentionRule, number>()
    for (const item of items) map.set(item.rule, (map.get(item.rule) || 0) + 1)
    return map
  }, [items])
  const shown = items.filter(item => !rule || item.rule === rule)
  return (
    <BlockCard title="Lo que requiere tu atención" description="Reglas fijas sobre los registros de la empresa: cada alerta explica por qué aparece y lleva a donde se resuelve.">
      <div data-testid="atencion-gerencia">
        {failed ? <EmptyHint>No se pudo calcular la atención. Recarga la página.</EmptyHint> : !data ? <p className="text-[12.5px] text-petrol-blue/70">Revisando proyectos, aprobaciones, contratos y ahorros…</p> : items.length === 0 ? (
          <EmptyHint>Nada requiere atención: no hay atrasos, aprobaciones detenidas, contratos por vencer sin renovación ni ahorros pendientes.</EmptyHint>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo de alerta">
              <button type="button" onClick={() => setRule(null)} className={cn('rounded-full px-2.5 py-1 text-[11.5px]', !rule ? 'bg-petrol-blue text-white' : 'bg-petrol-blue/[0.06] text-petrol-blue')}>Todas ({items.length})</button>
              {Array.from(counts.entries()).map(([key, count]) => (
                <button key={key} type="button" onClick={() => setRule(rule === key ? null : key)} className={cn('rounded-full px-2.5 py-1 text-[11.5px]', rule === key ? 'bg-petrol-blue text-white' : 'bg-petrol-blue/[0.06] text-petrol-blue')}>{RULE_LABEL[key]} ({count})</button>
              ))}
            </div>
            <ul className="divide-y divide-petrol-blue/[0.06]">
              {shown.slice(0, 12).map(item => (
                <li key={item.id} className="flex items-start justify-between gap-3 py-2.5" data-testid="alerta" data-regla={item.rule}>
                  <div className="flex min-w-0 gap-2.5">
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.severity === 'alta' ? 'bg-red-500' : 'bg-amber-400')} aria-label={item.severity === 'alta' ? 'Prioridad alta' : 'Prioridad media'} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-petrol-blue/55">{RULE_LABEL[item.rule]}</p>
                      <p className="truncate text-[13.5px] font-medium text-petrol-blue">{item.title}</p>
                      <p className="text-[12.5px] text-petrol-blue/80">{item.why}</p>
                    </div>
                  </div>
                  <Link href={item.action.href} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-petrol-blue/[0.06] px-3 py-1.5 text-[12px] font-medium text-petrol-blue hover:bg-petrol-blue/10">{item.action.label}<ArrowRight className="h-3 w-3" aria-hidden /></Link>
                </li>
              ))}
            </ul>
            {shown.length > 12 && <p className="mt-2 text-[12px] text-petrol-blue/65">Y {shown.length - 12} más. Filtra por tipo para verlas.</p>}
          </>
        )}
      </div>
    </BlockCard>
  )
}

function Group({ title, hint, items, empty }: { title: string; hint: string; items: TodayItem[]; empty?: string }) {
  if (!items.length && !empty) return null
  return (
    <section>
      <h3 className="text-[13px] font-medium text-petrol-blue">{title} {items.length > 0 && <span className="font-normal text-petrol-blue/65">({items.length})</span>}</h3>
      <p className="text-[11.5px] text-petrol-blue/65">{hint}</p>
      {items.length === 0 ? <p className="mt-1 text-[12px] text-petrol-blue/60">{empty}</p> : (
        <ul className="mt-1.5 space-y-1">
          {items.slice(0, 5).map(item => (
            <li key={item.id}><Link href={item.href} className="block rounded-xl px-2 py-1.5 hover:bg-white/70"><span className="block truncate text-[12.5px] font-medium text-petrol-blue">{item.title}</span><span className="block truncate text-[11.5px] text-petrol-blue/70">{item.detail}</span></Link></li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function BuyerToday({ companyId, role, userId }: { companyId: string; role: string; userId: string }) {
  const { data } = useAttention(companyId, role, userId)
  const today = useMemo(() => (data ? buyerToday(data.input, userId, data.myLast) : null), [data, userId])
  if (!today) return null
  const involved = today.today.length + today.late.length + today.dependsOnMe.length + today.waiting.length + today.missingDeliverables.length + today.toApprove.length > 0 || today.nextMilestone || today.continueWith
  if (!involved) return null
  return (
    <BlockCard title="Qué hago hoy" description="Tus actividades de proyecto, en orden de urgencia. Cada una abre su ficha.">
      <div className="space-y-4" data-testid="hoy-comprador">
        {today.continueWith && (
          <Link href={today.continueWith.href} className="glass-chip flex items-center justify-between gap-2 p-3 hover:bg-white/70">
            <span className="min-w-0"><span className="block text-[11px] font-medium uppercase tracking-wider text-petrol-blue/60">Continuar</span><span className="block truncate text-[13px] font-medium text-petrol-blue">{today.continueWith.title}</span><span className="block truncate text-[12px] text-petrol-blue/70">Lo último que hiciste: {today.continueWith.detail}</span></span>
            <ArrowRight className="h-4 w-4 shrink-0 text-petrol-blue" aria-hidden />
          </Link>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Group title="Atrasado" hint="Venció su fecha comprometida. Ciérralo o reprograma con causa." items={today.late} empty="Nada atrasado." />
          <Group title="Para hoy" hint="En curso, en riesgo o que ya debía comenzar." items={today.today} empty="Nada que comience hoy." />
          <Group title="Depende de mí" hint="Otras personas esperan que termines esto." items={today.dependsOnMe} />
          <Group title="Esperando a otros" hint="Tus actividades detenidas por otra persona o por una aprobación." items={today.waiting} />
          <Group title="Entregables por subir" hint="Sin documento vigente cerca de su fecha." items={today.missingDeliverables} />
          <Group title="Documentos por aprobar" hint="Te designaron como aprobador." items={today.toApprove} />
        </div>
        {today.nextMilestone && <p className="text-[12.5px] text-petrol-blue">Próximo hito: <Link href={today.nextMilestone.href} className="font-medium underline">{today.nextMilestone.title}</Link> · {today.nextMilestone.detail}</p>}
      </div>
    </BlockCard>
  )
}
