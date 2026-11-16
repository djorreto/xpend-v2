'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { LoadingSpinner } from '@/components/ui/loading'
import { BlockCard, EmptyHint } from '@/components/workspace-blocks'
import { fmtDate } from '@/components/milestones-panel'
import { supabaseBrowser } from '@/lib/supabase'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { can } from '@/lib/navigation'
import { formatCurrency } from '@/lib/utils'
import { personName } from '@/lib/portfolio-data'
import { assignmentGaps, effectiveOwner } from '@/lib/portfolio'
import { loadManagement, type ManagementData } from '@/lib/management-data'
import { STAGE_LABEL, STAGE_ORDER, currentStage, milestonesByStatus, personLoad, planCompliance, riskInitiatives, stageMatrix, upcomingMilestones, type StageKey } from '@/lib/management'
import { HEALTH_LABEL, CAUSE_LABEL, todayISO } from '@/lib/milestones'
import { SAVINGS_TEXT, pendingDeclarations, summarizeSavings } from '@/lib/savings'

const FIELD = 'h-8 rounded-xl border border-petrol-blue/15 bg-white/80 px-3 text-[13px] text-petrol-blue'

function Tile({ label, value, hint, href, testId }: { label: string; value: React.ReactNode; hint?: string; href?: string; testId?: string }) {
  const body = (
    <div className="glass-card h-full p-4" data-testid={testId}>
      <p className="text-[12px] font-medium tracking-wide text-petrol-blue/75">{label}</p>
      <div className="mt-2 text-[1.35rem] font-medium tracking-tight text-petrol-blue">{value}</div>
      {hint && <p className="mt-1 text-[12px] text-petrol-blue/75">{hint}</p>}
    </div>
  )
  return href ? <Link href={href} className="block hover:-translate-y-0.5">{body}</Link> : body
}

export default function GestionPage() {
  const router = useRouter()
  const [session, setSession] = useState<AppSession | null>(null)
  const [data, setData] = useState<ManagementData | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [personFilter, setPersonFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [by, setBy] = useState<'category' | 'owner'>('category')

  const load = async (appSession: AppSession, selectedYear: number) => {
    try {
      setData(await loadManagement(supabaseBrowser(), appSession.companyId as string, appSession.role, selectedYear))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el panel.')
    }
  }

  useEffect(() => {
    loadAppSession().then(async appSession => {
      if (!appSession) return router.replace('/login')
      if (appSession.role === 'supplier') return router.replace('/sala')
      if (!can(appSession.role, 'manageTeams')) return router.replace('/dashboard')
      setSession(appSession)
      if (appSession.companyId) await load(appSession, year)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const assignments = useMemo(() => new Map((data?.portfolio.assignments || []).map(item => [item.category_id, item])), [data])

  const schedules = useMemo(() => {
    if (!data) return []
    return data.schedules.filter(item => {
      const owner = effectiveOwner(item.initiative, assignments).userId
      const team = item.initiative.team_id || assignments.get(item.initiative.category_id || '')?.team_id || null
      return (!personFilter || owner === personFilter || item.initiative.backup_user_id === personFilter) && (!teamFilter || team === teamFilter) && (!categoryFilter || item.initiative.category_id === categoryFilter)
    })
  }, [data, assignments, personFilter, teamFilter, categoryFilter])

  const scope = useMemo(() => ({ categoryId: categoryFilter || undefined, ownerId: personFilter || undefined, teamId: teamFilter || undefined }), [categoryFilter, personFilter, teamFilter])
  const savingsRows = useMemo(
    () => (data ? summarizeSavings({ year, awards: data.savings.awards, validations: data.savings.validations, recognitions: data.savings.recognitions, targets: data.savings.targets, scope }) : []),
    [data, year, scope]
  )

  if (loading || !session) return <MainLayout><LoadingSpinner /></MainLayout>
  const layoutUser = { name: session.name, email: session.email, role: session.role }
  if (error || !data) return <MainLayout user={layoutUser} companyName={session.companyName}><EmptyHint>{error || 'Sin datos para mostrar.'}</EmptyHint></MainLayout>

  const today = todayISO()
  const { portfolio } = data
  const person = (id: string | null | undefined) => personName(portfolio.people.find(item => item.id === id))
  const category = (id: string | null | undefined) => portfolio.categories.find(item => item.id === id)?.name || 'Sin categoría'
  const compliance = planCompliance(schedules)
  const risk = riskInitiatives(schedules)
  const matrix = stageMatrix(schedules, assignments, by)
  const stagesUsed = STAGE_ORDER.filter(stage => matrix.some(row => row.counts[stage]))
  const loads = personLoad(schedules, assignments)
  const upcoming = upcomingMilestones(schedules, today, 30)
  const lateEntries = milestonesByStatus(schedules, 'late')
  const blockedEntries = milestonesByStatus(schedules, 'blocked')
  const gaps = assignmentGaps(schedules.map(item => item.initiative), assignments)
  const toValidate = data.savings.validations.filter(item => item.status === 'declared' && (!categoryFilter || item.category_id === categoryFilter) && (!personFilter || item.owner_user_id === personFilter) && (!teamFilter || item.team_id === teamFilter))
  const toDeclare = pendingDeclarations(data.savings.awards.filter(award => (!categoryFilter || award.category_id === categoryFilter) && (!personFilter || award.owner_user_id === personFilter) && (!teamFilter || award.team_id === teamFilter)), data.savings.validations)
  const detail = (id: string) => `/sourcing-plan/${id}`

  return (
    <MainLayout user={layoutUser} companyName={session.companyName}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1>Panel de gestión</h1>
            <p className="mt-1 max-w-3xl text-[13px] text-petrol-blue/75">
              Cumplimiento del plan, carga del equipo, riesgos y ahorros. Cada número se abre hasta las iniciativas o registros que lo componen; lo que no se ha medido figura como “{SAVINGS_TEXT.noInfo}”, nunca como cero.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[12px] font-medium text-petrol-blue/80" htmlFor="anio-gestion">Año</label>
            <select id="anio-gestion" className={FIELD} value={year} onChange={async event => { const next = Number(event.target.value); setYear(next); await load(session, next) }}>
              {Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - 2 + index).map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <select aria-label="Persona" className={FIELD} value={personFilter} onChange={event => setPersonFilter(event.target.value)}>
            <option value="">Todas las personas</option>
            {portfolio.people.map(item => <option key={item.id} value={item.id}>{personName(item)}</option>)}
          </select>
          <select aria-label="Equipo" className={FIELD} value={teamFilter} onChange={event => setTeamFilter(event.target.value)}>
            <option value="">Todos los equipos</option>
            {portfolio.teams.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select aria-label="Categoría" className={FIELD} value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
            <option value="">Todas las categorías</option>
            {portfolio.categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Tile testId="tile-cumplimiento" label="Cumplimiento del plan" value={compliance.pct == null ? SAVINGS_TEXT.noInfo : `${compliance.pct}%`} hint={`${compliance.measured} de ${compliance.total} iniciativas con fechas${compliance.noDates ? `; ${compliance.noDates} sin fechas` : ''}`} href="/plan-anual" />
          <Tile testId="tile-atrasados" label="Hitos atrasados" value={lateEntries.length} hint={`${compliance.late} iniciativas`} href="/plan-anual" />
          <Tile testId="tile-bloqueados" label="Hitos bloqueados" value={blockedEntries.length} hint={`${compliance.blocked} iniciativas`} href="/plan-anual" />
          <Tile testId="tile-sin-responsable" label="Sin responsable" value={gaps.withoutOwner.length} hint={`${gaps.withoutCategory.length} sin categoría`} href="/sourcing-plan" />
          <Tile testId="tile-por-validar" label="Ahorros por validar" value={toValidate.length} hint={`${toDeclare.length} adjudicaciones sin declarar`} href="/ahorros" />
          <Tile label="Próximos hitos (30 días)" value={upcoming.length} hint="Con fecha comprometida" href="/plan-anual" />
        </div>

        <BlockCard title={`Metas y ahorro ${year}`} description="Por moneda y sin conversión. Meta del plan, negociado, validado y realizado se mantienen como conceptos distintos." action={{ label: 'Control de ahorros', href: '/ahorros' }}>
          {savingsRows.length === 0 ? (
            <EmptyHint>{SAVINGS_TEXT.noInfo}: no hay metas ni adjudicaciones comparables para estos filtros.</EmptyHint>
          ) : (
            <div className="overflow-x-auto" data-testid="gestion-ahorros">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[12px] text-petrol-blue/75">
                    <th className="py-1.5 pr-3 font-medium">Moneda</th>
                    <th className="px-3 font-medium">Meta</th>
                    <th className="px-3 font-medium">Negociado</th>
                    <th className="px-3 font-medium">Por validar</th>
                    <th className="px-3 font-medium">Validado (anualizado)</th>
                    <th className="px-3 font-medium">Realizado en el año</th>
                  </tr>
                </thead>
                <tbody>
                  {savingsRows.map(row => (
                    <tr key={row.currency} className="border-t border-petrol-blue/[0.06]">
                      <td className="py-2 pr-3 font-medium">{row.currency}</td>
                      <td className="px-3">{row.target == null ? SAVINGS_TEXT.noInfo : formatCurrency(row.target, row.currency)}</td>
                      <td className="px-3">{row.negotiated == null ? SAVINGS_TEXT.noInfo : formatCurrency(row.negotiated, row.currency)}</td>
                      <td className="px-3">{row.pendingValidation == null ? 'Ninguno' : formatCurrency(row.pendingValidation, row.currency)}</td>
                      <td className="px-3">{row.validatedAnnualized == null ? SAVINGS_TEXT.pending : formatCurrency(row.validatedAnnualized, row.currency)}</td>
                      <td className="px-3 font-medium">{row.realizedYear == null ? SAVINGS_TEXT.noInfo : formatCurrency(row.realizedYear, row.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </BlockCard>

        <BlockCard
          title="Procesos por etapa"
          description="Etapa actual de cada iniciativa abierta: el primer hito aún sin fecha real. Abre una fila para ver las iniciativas."
          action={undefined}
        >
          <div className="mb-3 flex gap-1.5" role="group" aria-label="Agrupar por">
            {(['category', 'owner'] as const).map(item => (
              <button key={item} type="button" aria-pressed={by === item} onClick={() => setBy(item)} className={`rounded-full px-3 py-1 text-[12.5px] font-medium ${by === item ? 'bg-petrol-blue text-white' : 'border border-petrol-blue/15 bg-white/70 text-petrol-blue hover:bg-white'}`}>
                {item === 'category' ? 'Por categoría' : 'Por responsable'}
              </button>
            ))}
          </div>
          {matrix.length === 0 ? (
            <EmptyHint>No hay iniciativas abiertas para estos filtros.</EmptyHint>
          ) : (
            <div className="overflow-x-auto" data-testid="matriz-etapas">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[12px] text-petrol-blue/75">
                    <th className="py-1.5 pr-3 font-medium">{by === 'category' ? 'Categoría' : 'Responsable'}</th>
                    {stagesUsed.map(stage => <th key={stage} className="px-2 text-center font-medium">{STAGE_LABEL[stage as StageKey]}</th>)}
                    <th className="px-2 text-center font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map(row => (
                    <tr key={row.key} className="border-t border-petrol-blue/[0.06] align-top">
                      <td className="py-2 pr-3">
                        <details>
                          <summary className="cursor-pointer font-medium">{by === 'category' ? (row.categoryId ? category(row.categoryId) : 'Sin categoría') : row.ownerId ? person(row.ownerId) : 'Sin responsable'}</summary>
                          <ul className="mt-1 space-y-0.5 text-[12.5px]">
                            {row.items.map(item => (
                              <li key={item.initiative.id}><Link className="underline" href={detail(item.initiative.id)}>{item.initiative.title}</Link> <span className="text-petrol-blue/75">· {STAGE_LABEL[currentStage(item)]}</span></li>
                            ))}
                          </ul>
                        </details>
                      </td>
                      {stagesUsed.map(stage => <td key={stage} className="px-2 text-center">{row.counts[stage as StageKey] || ''}</td>)}
                      <td className="px-2 text-center font-medium">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </BlockCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <BlockCard title={`Iniciativas en riesgo (${risk.length})`} description="Atrasadas o bloqueadas. Un atraso sin causa registrada no se atribuye a nadie.">
            {risk.length === 0 ? (
              <EmptyHint>Ninguna iniciativa atrasada o bloqueada.</EmptyHint>
            ) : (
              <ul className="divide-y divide-petrol-blue/[0.06]" data-testid="en-riesgo">
                {risk.slice(0, 8).map(item => {
                  const blocked = item.milestones.find(view => view.status === 'blocked')
                  const late = item.milestones.find(view => view.status === 'late')
                  const view = late || blocked
                  return (
                    <li key={item.initiative.id} className="py-2.5">
                      <Link href={detail(item.initiative.id)} className="text-[14px] font-medium text-petrol-blue hover:underline">{item.initiative.title}</Link>
                      <p className="text-[12.5px] text-petrol-blue/75">
                        {HEALTH_LABEL[item.health]} · {category(item.initiative.category_id)} · {person(effectiveOwner(item.initiative, assignments).userId)}
                        {view ? ` · ${view.label}${view.lateDays ? `, ${view.lateDays} días de atraso` : ''}` : ''}
                        {blocked?.blockedBy ? ` · espera a: ${CAUSE_LABEL[blocked.blockedBy.cause]}` : ''}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </BlockCard>

          <BlockCard title="Carga por persona" description="Iniciativas abiertas como responsable (directo o por categoría) y como suplente.">
            {loads.length === 0 ? (
              <EmptyHint>No hay iniciativas abiertas.</EmptyHint>
            ) : (
              <table className="w-full text-[13px]" data-testid="carga-personas">
                <thead>
                  <tr className="text-left text-[12px] text-petrol-blue/75"><th className="py-1 font-medium">Persona</th><th className="font-medium">Responsable</th><th className="font-medium">Suplente</th><th className="font-medium">Atrasadas</th><th className="font-medium">Bloqueadas</th></tr>
                </thead>
                <tbody>
                  {loads.map(row => (
                    <tr key={row.userId || 'sin'} className="border-t border-petrol-blue/[0.06]">
                      <td className="py-1.5 font-medium">{row.userId ? person(row.userId) : 'Sin responsable'}</td>
                      <td>{row.owner}</td><td>{row.backup}</td><td>{row.late}</td><td>{row.blocked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </BlockCard>

          <BlockCard title={`Próximos hitos (${upcoming.length})`} description="Fechas comprometidas dentro de 30 días.">
            {upcoming.length === 0 ? (
              <EmptyHint>No hay hitos con fecha en los próximos 30 días.</EmptyHint>
            ) : (
              <ul className="divide-y divide-petrol-blue/[0.06]">
                {upcoming.slice(0, 8).map(({ item, view }) => (
                  <li key={view.id} className="py-2 text-[13px]">
                    <span className="font-medium">{fmtDate(view.committed_date)}</span> · {view.label} · <Link className="underline" href={detail(item.initiative.id)}>{item.initiative.title}</Link>
                    <span className="text-petrol-blue/75"> · {person(effectiveOwner(item.initiative, assignments).userId)}</span>
                  </li>
                ))}
              </ul>
            )}
          </BlockCard>

          <BlockCard title="Huecos de asignación" description="Iniciativas abiertas a las que les falta responsable, categoría o suplente." action={{ label: 'Asignar', href: '/equipos' }}>
            <ul className="space-y-1 text-[13px]" data-testid="huecos">
              <li>Sin responsable: <strong>{gaps.withoutOwner.length}</strong></li>
              <li>Sin categoría: <strong>{gaps.withoutCategory.length}</strong></li>
              <li>Sin suplente: <strong>{gaps.withoutBackup.length}</strong></li>
            </ul>
            {gaps.withoutOwner.length > 0 && (
              <ul className="mt-2 divide-y divide-petrol-blue/[0.06] text-[13px]">
                {gaps.withoutOwner.slice(0, 5).map(item => <li key={item.id} className="py-1.5"><Link className="underline" href={detail(item.id)}>{item.title}</Link></li>)}
              </ul>
            )}
          </BlockCard>

          <BlockCard title={`Ahorros por validar (${toValidate.length})`} description="Declarados por el responsable y esperando a otra persona." action={{ label: 'Validar', href: '/ahorros' }} className="lg:col-span-2">
            {toValidate.length === 0 ? (
              <EmptyHint>No hay declaraciones pendientes de validación.</EmptyHint>
            ) : (
              <ul className="divide-y divide-petrol-blue/[0.06]" data-testid="gestion-por-validar">
                {toValidate.slice(0, 8).map(item => (
                  <li key={item.id} className="py-2 text-[13px]">
                    <Link className="font-medium underline" href="/ahorros">{item.licitacion_name || 'Ahorro'}</Link> · {formatCurrency(item.declared_amount, item.currency)} declarado por {person(item.declared_by)} · {category(item.category_id)}
                  </li>
                ))}
              </ul>
            )}
          </BlockCard>
        </div>
      </div>
    </MainLayout>
  )
}
