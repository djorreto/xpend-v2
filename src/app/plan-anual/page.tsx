'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading'
import { BlockCard, EmptyHint } from '@/components/workspace-blocks'
import { STATUS_STYLE, fmtDate } from '@/components/milestones-panel'
import { supabaseBrowser } from '@/lib/supabase'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { can } from '@/lib/navigation'
import { formatCurrency } from '@/lib/utils'
import { loadPortfolio, personName, type PortfolioData } from '@/lib/portfolio-data'
import { effectiveOwner, filterByScope, PORTFOLIO_LABELS, type PortfolioScope } from '@/lib/portfolio'
import { loadAnnualPlan, loadSchedules, type AnnualPlanBundle, type InitiativeSchedule } from '@/lib/annual-plan-data'
import { delaysByCause, diffAgainstCommitted, lineCoverage, todayISO, totalsByCurrency, CAUSE_LABEL, NO_CAUSE_LABEL, type RescheduleCause } from '@/lib/milestones'
import { loadProjectsFor, type PortfolioProjects } from '@/lib/project-data'
import { PlanDeliverables, PlanGantt, PlanTable, PlanTree, loadTree, type TreeData } from '@/components/plan-views'

const FIELD = 'h-9 rounded-xl border border-petrol-blue/15 bg-white/80 px-3 text-[13px] text-petrol-blue'
const TABS = [
  { id: 'tabla', label: 'Tabla' },
  { id: 'arbol', label: 'Árbol' },
  { id: 'gantt', label: 'Gantt' },
  { id: 'entregables', label: 'Entregables' },
  { id: 'categorias', label: 'Metas por categoría' },
  { id: 'cambios', label: 'Cambios del plan' },
] as const
type TabId = (typeof TABS)[number]['id']
const PREFS_KEY = 'xpend.plan-anual'
type Prefs = { tab: TabId; scope: PortfolioScope; person: string; team: string; category: string }

const PRIORITY = { 1: 'Alta', 2: 'Media', 3: 'Baja' } as Record<number, string>

export default function PlanAnualPage() {
  const router = useRouter()
  const [session, setSession] = useState<AppSession | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [bundle, setBundle] = useState<AnnualPlanBundle | null>(null)
  const [schedules, setSchedules] = useState<InitiativeSchedule[]>([])
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTabState] = useState<TabId>('tabla')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [scope, setScopeState] = useState<PortfolioScope>('all')
  const [personFilter, setPersonState] = useState('')
  const [teamFilter, setTeamState] = useState('')
  const [categoryFilter, setCategoryState] = useState('')
  const [projects, setProjects] = useState<PortfolioProjects | null>(null)
  const [tree, setTree] = useState<TreeData>({ rfx: [], links: [], contracts: [] })

  // La vista y los filtros se recuerdan en este navegador; la URL (?vista=) manda si viene.
  const persist = (next: Partial<Prefs>) => {
    try {
      const current = JSON.parse(window.localStorage.getItem(PREFS_KEY) || '{}')
      window.localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...next }))
    } catch { /* sin almacenamiento: vale para esta visita */ }
  }
  const setTab = (next: TabId) => {
    setTabState(next)
    persist({ tab: next })
    const url = new URL(window.location.href)
    url.searchParams.set('vista', next)
    window.history.replaceState(null, '', url.toString())
  }
  const setScope = (value: PortfolioScope) => { setScopeState(value); persist({ scope: value }) }
  const setPersonFilter = (value: string) => { setPersonState(value); persist({ person: value }) }
  const setTeamFilter = (value: string) => { setTeamState(value); persist({ team: value }) }
  const setCategoryFilter = (value: string) => { setCategoryState(value); persist({ category: value }) }

  const refresh = useCallback(async (appSession: AppSession, selectedYear: number) => {
    const supabase = supabaseBrowser()
    const companyId = appSession.companyId as string
    const [plan, items, portfolioData] = await Promise.all([
      loadAnnualPlan(supabase, companyId, selectedYear),
      loadSchedules(supabase, companyId, selectedYear, appSession.role),
      loadPortfolio(supabase, companyId),
    ])
    setBundle(plan)
    setSchedules(items)
    setPortfolio(portfolioData)
    const planIds = items.map(item => item.initiative.id)
    const projectData = await loadProjectsFor(supabase, companyId, planIds)
    setProjects(projectData)
    setTree(await loadTree(supabase, companyId, planIds, projectData.projects.map(item => item.id), can(appSession.role, 'readContracts')))
  }, [])

  useEffect(() => {
    loadAppSession().then(async appSession => {
      if (!appSession) return router.replace('/login')
      if (appSession.role === 'supplier') return router.replace('/sala')
      setSession(appSession)
      try {
        const stored = JSON.parse(window.localStorage.getItem(PREFS_KEY) || '{}') as Partial<Prefs>
        const fromUrl = new URLSearchParams(window.location.search).get('vista') as TabId | null
        const initial = fromUrl && TABS.some(item => item.id === fromUrl) ? fromUrl : stored.tab && TABS.some(item => item.id === stored.tab) ? stored.tab : 'tabla'
        setTabState(initial)
        if (stored.scope) setScopeState(stored.scope)
        if (stored.person) setPersonState(stored.person)
        if (stored.team) setTeamState(stored.team)
        if (stored.category) setCategoryState(stored.category)
      } catch { /* preferencias ilegibles: se usan las de por defecto */ }
      const urlYear = Number(new URLSearchParams(window.location.search).get('anio'))
      const initialYear = Number.isInteger(urlYear) && urlYear >= 2000 && urlYear <= 2100 ? urlYear : year
      if (initialYear !== year) setYear(initialYear)
      if (appSession.companyId) await refresh(appSession, initialYear)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const assignments = useMemo(() => new Map((portfolio?.assignments || []).map(item => [item.category_id, item])), [portfolio])

  const visible = useMemo(() => {
    if (!session || !portfolio) return schedules
    const scoped = filterByScope(
      schedules.map(item => ({ ...item.initiative, schedule: item })),
      scope,
      { userId: session.userId, teamIds: portfolio.members.filter(member => member.user_id === session.userId).map(member => member.team_id), areaId: null, assignments }
    )
    return scoped
      .map(item => item.schedule)
      .filter(item => {
        const owner = effectiveOwner(item.initiative, assignments).userId
        const team = item.initiative.team_id || assignments.get(item.initiative.category_id || '')?.team_id || null
        return (!personFilter || owner === personFilter || item.initiative.backup_user_id === personFilter) &&
          (!teamFilter || team === teamFilter) &&
          (!categoryFilter || item.initiative.category_id === categoryFilter)
      })
  }, [schedules, scope, personFilter, teamFilter, categoryFilter, session, portfolio, assignments])

  if (loading || !session || !portfolio) return <MainLayout><LoadingSpinner /></MainLayout>
  const layoutUser = { name: session.name, email: session.email, role: session.role }
  const companyId = session.companyId as string
  const supabase = supabaseBrowser()
  const writable = can(session.role, 'manageTeams')
  const plan = bundle?.plan || null
  const categoryName = (id: string | null) => portfolio.categories.find(category => category.id === id)?.name || 'Sin categoría'
  const person = (id: string | null | undefined) => personName(portfolio.people.find(item => item.id === id))

  const run = async (action: PromiseLike<{ error: { message: string } | null }>, success: string) => {
    const { error } = await action
    if (error) setMessage({ kind: 'error', text: error.message })
    else {
      setMessage({ kind: 'ok', text: success })
      await refresh(session, year)
    }
    return !error
  }

  const lineSummary = (bundle?.lines || []).filter(line => !categoryFilter || line.category_id === categoryFilter)
  const totals = totalsByCurrency(lineSummary)
  const today = todayISO()
  const late = visible.flatMap(item => item.milestones.filter(view => view.status === 'late').map(view => ({ view, lastCause: item.lastCause[view.id] })))
  const blocked = visible.flatMap(item => item.milestones.filter(view => view.status === 'blocked').map(view => ({ view, lastCause: item.lastCause[view.id] })))
  const causes = delaysByCause([...late, ...blocked])

  return (
    <MainLayout user={layoutUser} companyName={session.companyName}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1>Plan anual {year}</h1>
            <p className="mt-1 max-w-2xl text-[13px] text-petrol-blue/75">
              Metas de ahorro por categoría, año y moneda, y el seguimiento de los siete hitos de cada iniciativa. Al comprometer el plan se guarda una foto del original.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[12px] font-medium text-petrol-blue/80" htmlFor="anio">Año</label>
            <select id="anio" className={FIELD} value={year} onChange={async event => {
              const next = Number(event.target.value)
              setYear(next)
              await refresh(session, next)
            }}>
              {Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - 1 + index).map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <span className={`rounded-full px-3 py-1 text-[12.5px] font-medium ${plan?.status === 'committed' ? 'bg-accent-mint/40 text-petrol-blue' : 'bg-petrol-blue/[0.06] text-petrol-blue/80'}`} data-testid="estado-plan">
              {plan ? (plan.status === 'committed' ? `Comprometido el ${fmtDate(plan.committed_at)}` : 'Borrador') : 'Sin plan'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Alcance">
          {(['all', 'mine', 'team'] as PortfolioScope[]).map(item => (
            <button key={item} type="button" aria-pressed={scope === item} onClick={() => setScope(item)} className={`rounded-full px-3 py-1 text-[12.5px] font-medium ${scope === item ? 'bg-petrol-blue text-white' : 'border border-petrol-blue/15 bg-white/70 text-petrol-blue hover:bg-white'}`}>{PORTFOLIO_LABELS[item]}</button>
          ))}
          <select aria-label="Persona" className={`${FIELD} h-8`} value={personFilter} onChange={event => setPersonFilter(event.target.value)}>
            <option value="">Todas las personas</option>
            {portfolio.people.map(item => <option key={item.id} value={item.id}>{personName(item)}</option>)}
          </select>
          <select aria-label="Equipo" className={`${FIELD} h-8`} value={teamFilter} onChange={event => setTeamFilter(event.target.value)}>
            <option value="">Todos los equipos</option>
            {portfolio.teams.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select aria-label="Categoría" className={`${FIELD} h-8`} value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
            <option value="">Todas las categorías</option>
            {portfolio.categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Meta de ahorro (por moneda)">
            {totals.filter(row => row.target != null).length === 0 ? 'Sin información' : totals.filter(row => row.target != null).map(row => <div key={row.currency}>{formatCurrency(row.target as number, row.currency)}</div>)}
          </Tile>
          <Tile label="Gasto histórico (por moneda)">
            {totals.filter(row => row.spend != null).length === 0 ? 'Sin información' : totals.filter(row => row.spend != null).map(row => <div key={row.currency}>{formatCurrency(row.spend as number, row.currency)}</div>)}
          </Tile>
          <Tile label="Hitos atrasados">{late.length}</Tile>
          <Tile label="Hitos bloqueados">{blocked.length}</Tile>
        </div>
        {(late.length > 0 || blocked.length > 0) && (
          <p className="text-[12.5px] text-petrol-blue/80" data-testid="causas-atraso">
            Causa de los atrasos y bloqueos:{' '}
            {Object.entries(causes).map(([cause, count]) => `${cause === 'sin_causa' ? NO_CAUSE_LABEL : CAUSE_LABEL[cause as RescheduleCause]}: ${count}`).join(' · ')}.
            Un atraso sin causa registrada no se atribuye a nadie.
          </p>
        )}

        {message && <p role="status" className={`rounded-xl px-3 py-2 text-[13px] ${message.kind === 'ok' ? 'bg-accent-mint/30 text-petrol-blue' : 'bg-red-50 text-red-800'}`}>{message.text}</p>}

        {!plan && (
          <EmptyHint>
            Todavía no hay plan anual {year}.{' '}
            {writable ? (
              <Button size="sm" className="ml-2" onClick={() => run(supabase.from('annual_plans').insert({ company_id: companyId, plan_year: year, name: `Plan anual ${year}`, created_by: session.userId }), 'Plan creado en borrador.')}>Crear plan {year}</Button>
            ) : 'Un gerente o administrador puede crearlo.'}
          </EmptyHint>
        )}

        <div role="tablist" className="flex flex-wrap gap-1.5">
          {TABS.map(item => (
            <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${tab === item.id ? 'bg-petrol-blue text-white' : 'border border-petrol-blue/15 bg-white/70 text-petrol-blue hover:bg-white'}`}>{item.label}</button>
          ))}
        </div>

        {tab === 'categorias' && plan && (
          <LinesTab
            bundle={bundle!}
            plan={plan}
            portfolio={portfolio}
            schedules={visible}
            allSchedules={schedules}
            writable={writable}
            categoryFilter={categoryFilter}
            categoryName={categoryName}
            person={person}
            run={run}
            onCommit={() => run(supabase.rpc('commit_annual_plan', { p_plan: plan.id }), 'Plan comprometido. Se guardó la foto del original.')}
          />
        )}

        {tab === 'tabla' && (
          visible.length === 0 ? <EmptyHint>No hay iniciativas de {year} con este filtro.</EmptyHint> : (
            <PlanTable schedules={visible} projects={projects} today={today} categoryName={categoryName} person={person} ownerOf={item => effectiveOwner(item, assignments).userId} />
          )
        )}

        {tab === 'arbol' && <PlanTree schedules={visible} categories={portfolio.categories} projects={projects} tree={tree} today={today} person={person} ownerOf={item => effectiveOwner(item, assignments).userId} />}

        {tab === 'gantt' && <PlanGantt schedules={visible} projects={projects} today={today} person={person} ownerOf={item => effectiveOwner(item, assignments).userId} year={year} />}

        {tab === 'entregables' && <PlanDeliverables schedules={visible} projects={projects} today={today} person={person} userId={session.userId} />}

        {tab === 'cambios' && (
          <BlockCard title="Revisiones del plan comprometido" description="Cada cambio posterior al compromiso, con su motivo. El original está guardado aparte.">
            {!bundle || bundle.changes.length === 0 ? <EmptyHint>El plan no tiene revisiones.</EmptyHint> : (
              <ul className="divide-y divide-petrol-blue/[0.06] text-[13px] text-petrol-blue" data-testid="cambios-plan">
                {bundle.changes.map(change => {
                  const line = bundle.lines.find(item => item.id === change.line_id)
                  const nv = change.new_values as Record<string, number | null>
                  const ov = (change.old_values || {}) as Record<string, number | null>
                  return (
                    <li key={change.id} className="py-2">
                      <p className="font-medium">{change.change_kind === 'line_added' ? 'Línea agregada' : 'Línea revisada'}: {categoryName(line?.category_id || (change.new_values as { category_id?: string }).category_id || null)} {line ? `(${line.currency})` : ''}</p>
                      <p className="text-petrol-blue/80">
                        Meta {change.change_kind === 'line_revised' ? `${ov.target_amount ?? 'sin información'} → ` : ''}{nv.target_amount ?? 'sin información'}
                        {' · '}{change.reason}
                      </p>
                      <p className="text-[12px] text-petrol-blue/70">{new Date(change.changed_at).toLocaleString('es-CL')}</p>
                    </li>
                  )
                })}
              </ul>
            )}
          </BlockCard>
        )}
      </div>
    </MainLayout>
  )
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-4">
      <p className="text-[12px] font-medium tracking-wide text-petrol-blue/75">{label}</p>
      <div className="mt-2 text-[1.15rem] font-medium tracking-tight text-petrol-blue">{children}</div>
    </div>
  )
}

type RunFn = (action: PromiseLike<{ error: { message: string } | null }>, success: string) => Promise<boolean>

function LinesTab({ bundle, plan, portfolio, schedules, allSchedules, writable, categoryFilter, categoryName, person, run, onCommit }: {
  bundle: AnnualPlanBundle
  plan: NonNullable<AnnualPlanBundle['plan']>
  portfolio: PortfolioData
  schedules: InitiativeSchedule[]
  allSchedules: InitiativeSchedule[]
  writable: boolean
  categoryFilter: string
  categoryName: (id: string | null) => string
  person: (id: string | null | undefined) => string
  run: RunFn
  onCommit: () => void
}) {
  const supabase = supabaseBrowser()
  const committed = plan.status === 'committed'
  const [draft, setDraft] = useState({ category: '', currency: 'CLP', spend: '', target: '', owner: '', priority: '2', reason: '' })
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const initiatives = allSchedules.map(item => item.initiative)
  const diffs = bundle.snapshot ? diffAgainstCommitted(bundle.snapshot.lines, bundle.lines) : []
  const lines = bundle.lines.filter(line => !categoryFilter || line.category_id === categoryFilter)

  const save = async () => {
    const ok = await run(
      supabase.rpc('upsert_annual_line', {
        p_plan: plan.id,
        p_category: draft.category,
        p_currency: draft.currency,
        p_spend: draft.spend === '' ? null : Number(draft.spend),
        p_target: draft.target === '' ? null : Number(draft.target),
        p_owner: draft.owner || null,
        p_priority: Number(draft.priority),
        p_reason: draft.reason || null,
      }),
      committed ? 'Línea revisada. El original se conserva.' : 'Línea guardada.'
    )
    if (ok) {
      setEditingKey(null)
      setDraft({ category: '', currency: 'CLP', spend: '', target: '', owner: '', priority: '2', reason: '' })
    }
  }

  return (
    <div className="space-y-4">
      {writable && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-[13px] font-medium text-petrol-blue">{editingKey ? 'Editar línea' : 'Agregar o actualizar una categoría'}{committed && ' (el plan está comprometido: se exige un motivo)'}</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="text-[12px] font-medium text-petrol-blue/80">Categoría
                <select className={`${FIELD} mt-1 block w-full`} value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} disabled={!!editingKey}>
                  <option value="">Elegir…</option>
                  {portfolio.categories.filter(item => item.is_active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="text-[12px] font-medium text-petrol-blue/80">Moneda
                <input className={`${FIELD} mt-1 block w-full uppercase`} maxLength={3} value={draft.currency} onChange={event => setDraft({ ...draft, currency: event.target.value.toUpperCase() })} disabled={!!editingKey} />
              </label>
              <label className="text-[12px] font-medium text-petrol-blue/80">Gasto histórico
                <input type="number" min="0" className={`${FIELD} mt-1 block w-full`} value={draft.spend} onChange={event => setDraft({ ...draft, spend: event.target.value })} placeholder="Sin información" />
              </label>
              <label className="text-[12px] font-medium text-petrol-blue/80">Meta de ahorro
                <input type="number" min="0" className={`${FIELD} mt-1 block w-full`} value={draft.target} onChange={event => setDraft({ ...draft, target: event.target.value })} placeholder="Sin información" />
              </label>
              <label className="text-[12px] font-medium text-petrol-blue/80">Responsable
                <select className={`${FIELD} mt-1 block w-full`} value={draft.owner} onChange={event => setDraft({ ...draft, owner: event.target.value })}>
                  <option value="">Category Manager de la categoría</option>
                  {portfolio.people.map(item => <option key={item.id} value={item.id}>{personName(item)}</option>)}
                </select>
              </label>
              <label className="text-[12px] font-medium text-petrol-blue/80">Prioridad
                <select className={`${FIELD} mt-1 block w-full`} value={draft.priority} onChange={event => setDraft({ ...draft, priority: event.target.value })}>
                  <option value="1">Alta</option><option value="2">Media</option><option value="3">Baja</option>
                </select>
              </label>
              <label className="text-[12px] font-medium text-petrol-blue/80 sm:col-span-2">Motivo {committed ? '(obligatorio)' : '(opcional)'}
                <input className={`${FIELD} mt-1 block w-full`} value={draft.reason} onChange={event => setDraft({ ...draft, reason: event.target.value })} />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={!draft.category || draft.currency.length !== 3} onClick={save}>Guardar línea</Button>
              {editingKey && <Button size="sm" variant="ghost" onClick={() => { setEditingKey(null); setDraft({ category: '', currency: 'CLP', spend: '', target: '', owner: '', priority: '2', reason: '' }) }}>Cancelar</Button>}
              {!committed && bundle.lines.length > 0 && (
                <Button size="sm" variant="secondary" onClick={() => { if (window.confirm('Al comprometer el plan se guarda una foto del original y los cambios posteriores exigirán un motivo. ¿Continuar?')) onCommit() }}>Comprometer plan</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {lines.length === 0 ? (
        <EmptyHint>El plan aún no tiene categorías con meta. {writable ? 'Agrega la primera arriba.' : ''}</EmptyHint>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[900px] text-left text-[12.5px] text-petrol-blue" data-testid="tabla-lineas">
              <thead>
                <tr className="border-b border-petrol-blue/10 text-[12px] text-petrol-blue/75">
                  {['Categoría', 'Responsable', 'Prioridad', 'Gasto histórico', 'Meta', 'Objetivo de iniciativas', 'Cobertura', 'Hitos atrasados', ''].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {lines.map(line => {
                  const coverage = lineCoverage({ ...line, priority: line.priority }, initiatives)
                  const owner = line.owner_user_id || portfolio.assignments.find(item => item.category_id === line.category_id)?.manager_user_id || null
                  const lateCount = schedules.filter(item => item.initiative.category_id === line.category_id && String(item.initiative.currency || '').toUpperCase() === line.currency).reduce((total, item) => total + item.milestones.filter(view => view.status === 'late').length, 0)
                  const diff = diffs.find(item => item.category_id === line.category_id && item.currency === line.currency)
                  return (
                    <tr key={line.id} className="border-b border-petrol-blue/[0.06]" data-testid="linea-plan">
                      <td className="px-3 py-2 font-medium">{categoryName(line.category_id)} <span className="text-petrol-blue/70">({line.currency})</span></td>
                      <td className="px-3 py-2">{owner ? person(owner) : 'Sin responsable'}</td>
                      <td className="px-3 py-2">{PRIORITY[line.priority]}</td>
                      <td className="px-3 py-2">{line.historical_spend != null ? formatCurrency(line.historical_spend, line.currency) : 'Sin información'}</td>
                      <td className="px-3 py-2">
                        {line.target_amount != null ? formatCurrency(line.target_amount, line.currency) : 'Sin información'}
                        {diff?.kind === 'revised' && <span className="block text-[11.5px] text-petrol-blue/70">Original: {diff.targetOriginal != null ? formatCurrency(diff.targetOriginal, line.currency) : 'sin información'}</span>}
                        {diff?.kind === 'added' && <span className="block text-[11.5px] text-petrol-blue/70">Agregada después del compromiso</span>}
                      </td>
                      <td className="px-3 py-2">{coverage.initiativeTarget != null ? formatCurrency(coverage.initiativeTarget, line.currency) : 'Sin información'}<span className="block text-[11.5px] text-petrol-blue/70">{coverage.initiatives} iniciativas</span></td>
                      <td className="px-3 py-2">{coverage.coverage != null ? `${Math.round(coverage.coverage * 100)}%` : 'Sin información'}</td>
                      <td className="px-3 py-2">{lateCount}</td>
                      <td className="px-3 py-2">
                        {writable && <Button size="sm" variant="outline" onClick={() => {
                          setEditingKey(line.id)
                          setDraft({ category: line.category_id, currency: line.currency, spend: line.historical_spend != null ? String(line.historical_spend) : '', target: line.target_amount != null ? String(line.target_amount) : '', owner: line.owner_user_id || '', priority: String(line.priority), reason: '' })
                        }}>Editar</Button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      {committed && bundle.snapshot && <p className="text-[12px] text-petrol-blue/75">Foto del plan original guardada el {fmtDate(bundle.snapshot.taken_at)}: {bundle.snapshot.lines.length} líneas. No se puede modificar.</p>}
    </div>
  )
}
