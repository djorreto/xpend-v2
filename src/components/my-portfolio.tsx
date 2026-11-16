'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { BlockCard, EmptyHint } from '@/components/workspace-blocks'
import { fmtDate } from '@/components/milestones-panel'
import { supabaseBrowser } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { loadManagement, type ManagementData } from '@/lib/management-data'
import { filterByScope } from '@/lib/portfolio'
import { currentStage, milestonesByStatus, planCompliance, STAGE_LABEL, upcomingMilestones } from '@/lib/management'
import { HEALTH_LABEL, todayISO } from '@/lib/milestones'
import { SAVINGS_TEXT, pendingDeclarations, summarizeSavings } from '@/lib/savings'
import { can } from '@/lib/navigation'

// "Mi portafolio": lo que la persona lleva como responsable, suplente o Category Manager. Mismas fuentes que el panel de gestión.
export function MyPortfolio({ userId, role, companyId }: { userId: string; role: string; companyId: string }) {
  const [data, setData] = useState<ManagementData | null>(null)
  const [failed, setFailed] = useState(false)
  const year = new Date().getFullYear()

  useEffect(() => {
    loadManagement(supabaseBrowser(), companyId, role, year).then(setData).catch(() => setFailed(true))
  }, [companyId, role, year])

  const mine = useMemo(() => {
    if (!data) return null
    const assignments = new Map(data.portfolio.assignments.map(item => [item.category_id, item]))
    const teamIds = data.portfolio.members.filter(member => member.user_id === userId).map(member => member.team_id)
    const schedules = filterByScope(data.schedules.map(item => ({ ...item.initiative, schedule: item })), 'mine', { userId, teamIds, assignments }).map(item => item.schedule)
    const myCategoryIds = data.portfolio.assignments.filter(item => item.manager_user_id === userId || item.backup_user_id === userId).map(item => item.category_id)
    const summary = summarizeSavings({ year, awards: data.savings.awards, validations: data.savings.validations, recognitions: data.savings.recognitions, targets: data.savings.targets, scope: { ownerId: userId } })
    const myAwards = data.savings.awards.filter(award => award.owner_user_id === userId || award.backup_user_id === userId)
    return { schedules, myCategoryIds, summary, toDeclare: pendingDeclarations(myAwards, data.savings.validations), toValidate: data.savings.validations.filter(item => item.status === 'declared' && item.owner_user_id === userId) }
  }, [data, userId, year])

  if (failed) return null
  if (!data || !mine) return <BlockCard title="Mi portafolio" description="Cargando tu cartera…"><EmptyHint>Cargando…</EmptyHint></BlockCard>

  const today = todayISO()
  const compliance = planCompliance(mine.schedules)
  const late = milestonesByStatus(mine.schedules, 'late')
  const blocked = milestonesByStatus(mine.schedules, 'blocked')
  const upcoming = upcomingMilestones(mine.schedules, today, 14)
  const categoryName = (id: string) => data.portfolio.categories.find(item => item.id === id)?.name || 'Categoría'
  const canDeclare = can(role, 'declareSavings')
  const hasPortfolio = mine.schedules.length > 0 || mine.myCategoryIds.length > 0

  return (
    <BlockCard title="Mi portafolio" description="Lo que llevas como responsable, suplente o Category Manager." action={{ label: 'Ver mi plan', href: '/plan-anual' }}>
      {!hasPortfolio ? (
        <EmptyHint>Todavía no tienes categorías ni iniciativas asignadas. Un gerente puede asignártelas desde Equipos y categorías.</EmptyHint>
      ) : (
        <div className="space-y-4" data-testid="mi-portafolio">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            {[
              { label: 'Mis iniciativas abiertas', value: compliance.total, href: '/sourcing-plan?alcance=mine' },
              { label: 'Atrasadas', value: compliance.late, href: '/plan-anual' },
              { label: 'Bloqueadas', value: compliance.blocked, href: '/plan-anual' },
              { label: 'Hitos en 14 días', value: upcoming.length, href: '/plan-anual' },
              { label: 'Ahorros por declarar', value: canDeclare ? mine.toDeclare.length : SAVINGS_TEXT.noInfo, href: '/ahorros' },
            ].map(tile => (
              <Link key={tile.label} href={tile.href} className="glass-chip block p-3 hover:bg-white/70">
                <p className="text-[12px] text-petrol-blue/75">{tile.label}</p>
                <p className="mt-1 text-[1.2rem] font-medium text-petrol-blue">{tile.value}</p>
              </Link>
            ))}
          </div>

          {mine.myCategoryIds.length > 0 && (
            <p className="text-[12.5px] text-petrol-blue/80" data-testid="mis-categorias">
              Mis categorías: {mine.myCategoryIds.map(categoryName).join(', ')}.
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-[13.5px] font-medium text-petrol-blue">Mis metas y resultados {year}</h3>
              {mine.summary.length === 0 ? (
                <p className="text-[12.5px] text-petrol-blue/75">{SAVINGS_TEXT.noInfo}: aún no hay metas ni adjudicaciones tuyas este año.</p>
              ) : (
                mine.summary.map(row => (
                  <p key={row.currency} className="mt-1 text-[12.5px] text-petrol-blue">
                    <strong>{row.currency}</strong> · meta {row.target == null ? SAVINGS_TEXT.noInfo : formatCurrency(row.target, row.currency)} · negociado {row.negotiated == null ? SAVINGS_TEXT.noInfo : formatCurrency(row.negotiated, row.currency)} · validado {row.validatedAnnualized == null ? SAVINGS_TEXT.pending : formatCurrency(row.validatedAnnualized, row.currency)} · realizado {row.realizedYear == null ? SAVINGS_TEXT.noInfo : formatCurrency(row.realizedYear, row.currency)}
                  </p>
                ))
              )}
              {mine.toValidate.length > 0 && <p className="mt-1 text-[12px] text-petrol-blue/75">{mine.toValidate.length} declaración(es) tuyas esperan validación de otra persona.</p>}
            </div>
            <div>
              <h3 className="text-[13.5px] font-medium text-petrol-blue">Próximas acciones</h3>
              <ul className="mt-1 space-y-1 text-[12.5px] text-petrol-blue">
                {blocked.slice(0, 2).map(({ item, view }) => (
                  <li key={`b-${view.id}`}>Bloqueado · {view.label} · <Link className="underline" href={`/sourcing-plan/${item.initiative.id}`}>{item.initiative.title}</Link></li>
                ))}
                {late.slice(0, 3).map(({ item, view }) => (
                  <li key={`l-${view.id}`}>{view.lateDays} días de atraso · {view.label} · <Link className="underline" href={`/sourcing-plan/${item.initiative.id}`}>{item.initiative.title}</Link></li>
                ))}
                {upcoming.slice(0, 3).map(({ item, view }) => (
                  <li key={`u-${view.id}`}>{fmtDate(view.committed_date)} · {view.label} · <Link className="underline" href={`/sourcing-plan/${item.initiative.id}`}>{item.initiative.title}</Link></li>
                ))}
                {canDeclare && mine.toDeclare.slice(0, 2).map(item => (
                  <li key={`d-${item.awardId}`}><Link className="underline" href={`/ahorros?award=${item.awardId}`}>Declarar ahorro de {formatCurrency(item.negotiated, item.currency)}</Link></li>
                ))}
                {blocked.length + late.length + upcoming.length === 0 && mine.toDeclare.length === 0 && <li className="text-petrol-blue/75">Nada urgente en tu portafolio.</li>}
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-[13.5px] font-medium text-petrol-blue">Mis iniciativas y su expediente</h3>
            <ul className="mt-1 divide-y divide-petrol-blue/[0.06]" data-testid="mis-iniciativas-portafolio">
              {mine.schedules.slice(0, 6).map(item => (
                <li key={item.initiative.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-[13px]">
                  <span><Link className="font-medium underline" href={`/sourcing-plan/${item.initiative.id}`}>{item.initiative.title}</Link> <span className="text-petrol-blue/75">· {STAGE_LABEL[currentStage(item)]} · {HEALTH_LABEL[item.health]}</span></span>
                </li>
              ))}
              {mine.schedules.length > 6 && <li className="pt-1 text-[12px] text-petrol-blue/75">Y {mine.schedules.length - 6} más en el plan.</li>}
            </ul>
          </div>
        </div>
      )}
    </BlockCard>
  )
}
