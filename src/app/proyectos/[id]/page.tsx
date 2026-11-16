'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Columns, FileText, Flag, LayoutList, Plus, Users } from 'lucide-react'
import { MainLayout } from '@/components/layout/main-layout'
import { LoadingSpinner } from '@/components/ui/loading'
import { Button } from '@/components/ui/button'
import { EmptyHint } from '@/components/workspace-blocks'
import { Gantt, STATE_PILL } from '@/components/gantt'
import { TaskDrawer } from '@/components/project/task-drawer'
import { DeliverablesPanel, DELIVERABLE_PILL } from '@/components/project/deliverables-panel'
import { ContractsPanel } from '@/components/project/contracts-panel'
import { BaselinePanel } from '@/components/project/baseline-panel'
import { RfxPanel, type RfxRow } from '@/components/project/rfx-panel'
import { Comments, type PersonOption } from '@/components/project/comments'
import { supabaseBrowser } from '@/lib/supabase'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { loadProject, METHODOLOGY_LABEL, PROJECT_STATUS_LABEL, type ProjectBundle } from '@/lib/project-data'
import { DELIVERABLE_LABEL, STATE_LABEL, nextAction, projectGanttRows, summarize, todayISO, viewDeliverables, viewTasks, type EffectiveState, type TaskView } from '@/lib/project'
import { ROLE_LABEL, type TaskRole } from '@/lib/methodology'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'tablero', label: 'Tablero' },
  { id: 'gantt', label: 'Gantt' },
  { id: 'entregables', label: 'Entregables' },
  { id: 'rfx', label: 'Procesos RFx' },
  { id: 'contratos', label: 'Contratos' },
  { id: 'ahorro', label: 'Línea base y ahorro' },
  { id: 'actividad', label: 'Equipo y actividad' },
] as const
type TabId = (typeof TABS)[number]['id']
const COLUMNS: EffectiveState[] = ['pending', 'at_risk', 'in_progress', 'late', 'blocked', 'done']
const FIELD = 'h-9 rounded-xl border border-petrol-blue/15 bg-white/80 px-3 text-[13px] text-petrol-blue'

type Activity = { id: string; kind: string; summary: string; actor_id: string | null; at: string }

function fmt(date: string | null | undefined) {
  if (!date) return 'sin fecha'
  const [y, m, d] = date.slice(0, 10).split('-')
  return `${d}-${m}-${y}`
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [session, setSession] = useState<AppSession | null>(null)
  const [bundle, setBundle] = useState<ProjectBundle | null>(null)
  const [people, setPeople] = useState<(PersonOption & { email: string | null })[]>([])
  const [rfx, setRfx] = useState<RfxRow[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [categoryName, setCategoryName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [tab, setTabState] = useState<TabId>('resumen')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [deliverableFocus, setDeliverableFocus] = useState<string | null>(null)
  const [boardMode, setBoardMode] = useState<'kanban' | 'tabla'>('kanban')
  const [stageFilter, setStageFilter] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)
  const [newTask, setNewTask] = useState({ stage: '', title: '', start: '', end: '' })
  const [notice, setNotice] = useState<string | null>(null)
  const today = todayISO()

  const setTab = (next: TabId, extra?: Record<string, string>) => {
    setTabState(next)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', next)
    url.searchParams.delete('tarea')
    url.searchParams.delete('entregable')
    for (const [key, value] of Object.entries(extra || {})) url.searchParams.set(key, value)
    window.history.replaceState(null, '', url.toString())
  }

  const refresh = useCallback(async () => {
    const supabase = supabaseBrowser()
    const data = await loadProject(supabase, params.id)
    if (!data) { setMissing(true); return }
    setBundle(data)
    const [lics, feed, category] = await Promise.all([
      supabase.from('licitaciones').select('id, name, type, status, publication_date, proposal_closing_date, award_date').eq('sourcing_project_id', params.id).order('created_at'),
      supabase.from('project_activity').select('id, kind, summary, actor_id, at').eq('project_id', params.id).order('at', { ascending: false }).limit(80),
      data.project.category_id ? supabase.from('procurement_categories').select('name, parent_id').eq('id', data.project.category_id).maybeSingle() : Promise.resolve({ data: null }),
    ])
    setRfx((lics.data || []) as RfxRow[])
    setActivity((feed.data || []) as Activity[])
    let label = (category.data as { name: string; parent_id: string | null } | null)?.name || null
    const parent = (category.data as { parent_id: string | null } | null)?.parent_id
    if (label && parent) {
      const { data: top } = await supabase.from('procurement_categories').select('name').eq('id', parent).maybeSingle()
      if (top?.name) label = `${top.name} › ${label}`
    }
    setCategoryName(label)
  }, [params.id])

  useEffect(() => {
    loadAppSession().then(async appSession => {
      if (!appSession) return router.replace('/login')
      if (appSession.role === 'supplier') return router.replace('/sala')
      setSession(appSession)
      const supabase = supabaseBrowser()
      const { data: team } = await supabase.from('profiles').select('id, full_name, email, role').eq('company_id', appSession.companyId).is('supplier_id', null).in('role', ['super_admin', 'admin', 'manager', 'analyst']).order('full_name')
      setPeople(((team || []) as { id: string; full_name: string | null; email: string | null; role: string }[]).map(item => ({ id: item.id, name: item.full_name || item.email || 'Persona', email: item.email, role: item.role })))
      await refresh()
      const search = new URLSearchParams(window.location.search)
      const initial = search.get('tab') as TabId | null
      if (initial && TABS.some(item => item.id === initial)) setTabState(initial)
      if (search.get('tarea')) setTaskId(search.get('tarea'))
      if (search.get('entregable')) setDeliverableFocus(search.get('entregable'))
      setLoading(false)
    })
  }, [router, refresh])

  const views = useMemo(() => bundle ? viewTasks(bundle.tasks, bundle.facts, today) : [], [bundle, today])
  const definition = bundle?.project.methodology_snapshot
  const pendingApprover = useMemo(() => new Map((bundle?.approvals || []).filter(row => row.status === 'pending').map(row => [row.subject_id, row.approver_id])), [bundle])
  const deliverables = useMemo(() => bundle ? viewDeliverables(bundle.deliverables, today, pendingApprover, session?.userId || null) : [], [bundle, today, pendingApprover, session])

  if (missing) {
    return (
      <MainLayout user={session ? { name: session.name, email: session.email, role: session.role } : undefined} companyName={session?.companyName}>
        <EmptyHint>El proyecto no existe o no tienes acceso a él. <Link href="/proyectos" className="font-medium underline">Ver proyectos</Link></EmptyHint>
      </MainLayout>
    )
  }
  if (loading || !session || !bundle || !definition) return <MainLayout><LoadingSpinner /></MainLayout>

  const { project } = bundle
  const role = session.role
  const readOnly = role === 'viewer'
  const canManage = !readOnly && (['super_admin', 'admin', 'manager'].includes(role) || (role === 'analyst' && [project.owner_id, project.backup_id].includes(session.userId)))
  const name = (id: string | null | undefined) => people.find(person => person.id === id)?.name || 'Sin responsable'
  const summary = summarize(views, definition)
  const action = nextAction(views, bundle.deliverables, session.userId)
  const main = views.filter(view => !view.parent_id)
  const stageName = (key: string) => definition.stages.find(stage => stage.key === key)?.name || key
  const approvers = people.filter(person => ['super_admin', 'admin', 'manager'].includes(person.role))
  const selected = taskId ? views.find(view => view.id === taskId) || null : null
  const openTask = (id: string) => { setTaskId(id); const url = new URL(window.location.href); url.searchParams.set('tarea', id); window.history.replaceState(null, '', url.toString()) }
  const closeTask = () => { setTaskId(null); const url = new URL(window.location.href); url.searchParams.delete('tarea'); window.history.replaceState(null, '', url.toString()) }
  const filtered = main.filter(view => (!stageFilter || view.stage_key === stageFilter) && (!onlyMine || view.assignee_id === session.userId || view.collaborator_ids.includes(session.userId)))
  const upcoming = main.filter(view => !view.done && view.state !== 'na').sort((a, b) => (a.committed_end || '9999').localeCompare(b.committed_end || '9999')).slice(0, 6)
  const team = Array.from(new Set([project.owner_id, project.backup_id, ...main.map(view => view.assignee_id), ...main.flatMap(view => view.collaborator_ids)].filter(Boolean) as string[]))
  const rows = projectGanttRows(views, definition, id => (id ? name(id) : ''), `/proyectos/${project.id}`)

  const goAction = () => {
    if (!action) return
    if (action.taskId && action.tab === 'tablero') { setTab('tablero'); openTask(action.taskId) }
    else if (action.deliverableId) { setDeliverableFocus(action.deliverableId); setTab('entregables', { entregable: action.deliverableId }) }
    else setTab(action.tab as TabId)
  }

  return (
    <MainLayout user={{ name: session.name, email: session.email, role }} companyName={session.companyName}>
      <div className="space-y-5" data-testid="proyecto">
        <header className="space-y-3">
          <p className="text-[12px] text-petrol-blue/70">
            <Link href="/proyectos" className="hover:underline">Proyectos</Link>
            {bundle.initiative && <> · <Link href={`/sourcing-plan/${bundle.initiative.id}`} className="hover:underline">Iniciativa: {bundle.initiative.title}</Link></>}
            {categoryName && <> · {categoryName}</>}
          </p>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-balance">{project.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
                <span className="rounded-full bg-petrol-blue px-2.5 py-0.5 font-medium text-white" data-testid="metodologia-proyecto">{METHODOLOGY_LABEL[project.methodology_kind || 'custom']}{project.template_version ? ` · v${project.template_version}` : ''}</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-petrol-blue shadow-sm">{PROJECT_STATUS_LABEL[project.status]}</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-petrol-blue shadow-sm">Responsable: {name(project.owner_id)}</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-petrol-blue shadow-sm">{fmt(project.start_date)} → {fmt(main.map(view => view.committed_end).filter(Boolean).sort().pop() || project.target_end_date)}</span>
              </div>
            </div>
            {action && !readOnly && (
              <button type="button" onClick={goAction} className="group flex max-w-md items-center gap-3 rounded-2xl bg-petrol-blue px-4 py-3 text-left text-white shadow-[0_20px_40px_-24px_rgba(45,62,61,0.9)] transition-transform hover:-translate-y-0.5" data-testid="siguiente-accion">
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-accent-mint">Siguiente acción</span>
                  <span className="block truncate text-[14px] font-medium">{action.title}</span>
                  <span className="block text-[12px] text-white/75">{action.reason}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="resumen-proyecto">
          <div className="glass-card flex items-center gap-3 p-4">
            <Ring value={summary.progress} />
            <div><p className="text-[12px] text-petrol-blue/70">Avance</p><p className="text-[13px] font-medium text-petrol-blue">{summary.done} de {summary.total} actividades</p></div>
          </div>
          <Stat icon={Flag} label="Etapa actual" value={summary.currentStage || 'Completado'} />
          <Stat icon={CalendarDays} label="Próximo hito" value={summary.nextMilestone ? `${summary.nextMilestone.title}` : 'Sin hitos pendientes'} hint={summary.nextMilestone ? fmt(summary.nextMilestone.committed_end) : undefined} />
          <Stat icon={AlertTriangle} label="Atrasadas · bloqueadas · en riesgo" value={`${summary.late} · ${summary.blocked} · ${summary.atRisk}`} tone={summary.late + summary.blocked > 0 ? 'warn' : undefined} />
          <Stat icon={CheckCircle2} label="Desvío del término" value={summary.slipDays > 0 ? `+${summary.slipDays} días vs. original` : 'En la fecha original'} tone={summary.slipDays > 0 ? 'warn' : undefined} />
        </div>

        <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Etapas">
          {definition.stages.map(stage => {
            const stageTasks = main.filter(view => view.stage_key === stage.key && view.state !== 'na')
            const doneCount = stageTasks.filter(view => view.done).length
            const late = stageTasks.some(view => view.state === 'late' || view.state === 'blocked')
            const complete = stageTasks.length > 0 && doneCount === stageTasks.length
            return (
              <li key={stage.key} className="min-w-[132px] flex-1">
                <button type="button" onClick={() => { setStageFilter(stage.key); setTab('tablero') }} className={cn('w-full rounded-xl px-3 py-2 text-left transition-colors', complete ? 'bg-accent-mint/40' : late ? 'bg-red-50' : 'bg-white/60 hover:bg-white')}>
                  <span className="block text-[10.5px] font-medium uppercase tracking-wider text-petrol-blue/60">{stage.key}</span>
                  <span className="block truncate text-[12px] font-medium text-petrol-blue" title={stage.name}>{stage.name}</span>
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-petrol-blue/10"><span className="block h-full bg-petrol-blue" style={{ width: `${stageTasks.length ? (doneCount / stageTasks.length) * 100 : 0}%` }} /></span>
                </button>
              </li>
            )
          })}
        </ol>

        <div role="tablist" aria-label="Secciones del proyecto" className="flex gap-1 overflow-x-auto border-b border-petrol-blue/10 pb-px">
          {TABS.map(item => (
            <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
              className={cn('-mb-px shrink-0 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors', tab === item.id ? 'border-petrol-blue text-petrol-blue' : 'border-transparent text-petrol-blue/65 hover:text-petrol-blue')}>
              {item.label}
              {item.id === 'entregables' && deliverables.some(item => item.waitingMe) && <span className="ml-1.5 rounded-full bg-petrol-blue px-1.5 text-[10px] text-white">!</span>}
            </button>
          ))}
        </div>
        {notice && <p role="status" className="rounded-xl bg-accent-mint/30 px-3 py-2 text-[12.5px] text-petrol-blue">{notice}</p>}

        {tab === 'resumen' && (
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="glass-card space-y-2 p-4 lg:col-span-2">
              <h2 className="text-[14px] font-medium text-petrol-blue">Lo que viene</h2>
              {upcoming.length === 0 ? <p className="text-[12.5px] text-petrol-blue/70">No hay actividades pendientes.</p> : (
                <ul className="divide-y divide-petrol-blue/[0.06]">
                  {upcoming.map(view => (
                    <li key={view.id} className="flex items-center justify-between gap-3 py-2">
                      <button type="button" onClick={() => { setTab('tablero'); openTask(view.id) }} className="min-w-0 text-left">
                        <span className="block truncate text-[13px] font-medium text-petrol-blue hover:underline">{view.code ? `${view.code}. ` : ''}{view.title}</span>
                        <span className="block text-[11.5px] text-petrol-blue/70">{stageName(view.stage_key)} · {view.assignee_id ? name(view.assignee_id) : view.role ? ROLE_LABEL[view.role as TaskRole] || view.role : 'Sin responsable'} · vence {fmt(view.committed_end)}</span>
                      </button>
                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', STATE_PILL[view.state])}>{STATE_LABEL[view.state]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="glass-card space-y-2 p-4">
              <h2 className="text-[14px] font-medium text-petrol-blue">Entregables</h2>
              <ul className="space-y-1.5">
                {deliverables.slice(0, 11).map(item => (
                  <li key={item.id}><button type="button" onClick={() => { setDeliverableFocus(item.id); setTab('entregables', { entregable: item.id }) }} className="flex w-full items-center justify-between gap-2 text-left text-[12.5px] text-petrol-blue hover:underline">
                    <span className="truncate">{item.title}</span>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium', DELIVERABLE_PILL[item.status])}>{DELIVERABLE_LABEL[item.status]}</span>
                  </button></li>
                ))}
              </ul>
            </section>
            {project.description && <section className="glass-card p-4 text-[13px] text-petrol-blue lg:col-span-3"><h2 className="mb-1 text-[14px] font-medium">Descripción</h2>{project.description}</section>}
          </div>
        )}

        {tab === 'tablero' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1" role="group" aria-label="Vista del tablero">
                <button type="button" aria-pressed={boardMode === 'kanban'} onClick={() => setBoardMode('kanban')} className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium', boardMode === 'kanban' ? 'bg-petrol-blue text-white' : 'border border-petrol-blue/15 bg-white/70 text-petrol-blue')}><Columns className="h-3.5 w-3.5" />Tablero</button>
                <button type="button" aria-pressed={boardMode === 'tabla'} onClick={() => setBoardMode('tabla')} className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium', boardMode === 'tabla' ? 'bg-petrol-blue text-white' : 'border border-petrol-blue/15 bg-white/70 text-petrol-blue')}><LayoutList className="h-3.5 w-3.5" />Lista</button>
              </div>
              <select className={`${FIELD} h-8`} value={stageFilter} onChange={event => setStageFilter(event.target.value)} aria-label="Etapa">
                <option value="">Todas las etapas</option>
                {definition.stages.map(stage => <option key={stage.key} value={stage.key}>{stage.key} · {stage.name}</option>)}
              </select>
              <label className="inline-flex items-center gap-1.5 text-[12.5px] text-petrol-blue"><input type="checkbox" checked={onlyMine} onChange={event => setOnlyMine(event.target.checked)} />Solo mis tareas</label>
            </div>

            {boardMode === 'kanban' ? (
              <div className="grid gap-3 overflow-x-auto pb-2 md:grid-cols-3 xl:grid-cols-6" data-testid="tablero">
                {COLUMNS.map(column => {
                  const cards = filtered.filter(view => view.state === column)
                  return (
                    <section key={column} className="min-w-[220px] space-y-2 rounded-2xl bg-white/40 p-2" aria-label={STATE_LABEL[column]}>
                      <p className="flex items-center justify-between px-1 text-[12px] font-medium text-petrol-blue"><span className="inline-flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', column === 'done' ? 'bg-accent-turquoise' : column === 'late' ? 'bg-red-500' : column === 'blocked' ? 'bg-amber-500' : column === 'at_risk' ? 'bg-yellow-400' : column === 'in_progress' ? 'bg-petrol-blue' : 'bg-petrol-blue/30')} />{STATE_LABEL[column]}</span><span className="text-petrol-blue/60">{cards.length}</span></p>
                      {cards.map(view => <TaskCard key={view.id} view={view} stage={stageName(view.stage_key)} owner={view.assignee_id ? name(view.assignee_id) : null} subtasks={views.filter(sub => sub.parent_id === view.id)} onOpen={() => openTask(view.id)} />)}
                    </section>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-3" data-testid="lista-tareas">
                {definition.stages.filter(stage => !stageFilter || stage.key === stageFilter).map(stage => {
                  const stageTasks = filtered.filter(view => view.stage_key === stage.key)
                  if (stageTasks.length === 0) return null
                  return (
                    <section key={stage.key} className="overflow-x-auto rounded-2xl border border-white/70 bg-white/65">
                      <p className="border-b border-petrol-blue/[0.07] px-3 py-2 text-[12.5px] font-medium text-petrol-blue">{stage.key} · {stage.name}</p>
                      <table className="w-full min-w-[760px] text-left text-[12.5px] text-petrol-blue">
                        <tbody>
                          {stageTasks.map(view => (
                            <tr key={view.id} className="cursor-pointer border-b border-petrol-blue/[0.05] hover:bg-white" onClick={() => openTask(view.id)}>
                              <td className="w-[44%] px-3 py-2 font-medium">{view.code ? `${view.code}. ` : ''}{view.title}{view.eventLabel && <span className="ml-1.5 rounded bg-accent-mint/40 px-1 text-[10.5px] font-normal">automático</span>}</td>
                              <td className="px-3 py-2">{view.assignee_id ? name(view.assignee_id) : <span className="text-petrol-blue/55">{view.role ? ROLE_LABEL[view.role as TaskRole] : 'Sin responsable'}</span>}</td>
                              <td className="px-3 py-2">{fmt(view.committed_start)} → {fmt(view.committed_end)}{view.slipDays > 0 && <span className="ml-1 text-[11px] text-red-700">+{view.slipDays} d</span>}</td>
                              <td className="px-3 py-2"><span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATE_PILL[view.state])}>{STATE_LABEL[view.state]}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  )
                })}
              </div>
            )}

            {canManage && (
              <details className="rounded-2xl border border-white/70 bg-white/55 p-3">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-petrol-blue"><Plus className="h-3.5 w-3.5" />Agregar una tarea al proyecto</summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-5">
                  <select className={FIELD} value={newTask.stage} onChange={event => setNewTask({ ...newTask, stage: event.target.value })} aria-label="Etapa de la tarea">
                    <option value="">Etapa…</option>
                    {definition.stages.map(stage => <option key={stage.key} value={stage.key}>{stage.key} · {stage.name}</option>)}
                  </select>
                  <input className={`${FIELD} sm:col-span-2`} placeholder="Nombre de la tarea" value={newTask.title} onChange={event => setNewTask({ ...newTask, title: event.target.value })} aria-label="Nombre de la tarea" />
                  <input type="date" className={FIELD} value={newTask.start} onChange={event => setNewTask({ ...newTask, start: event.target.value })} aria-label="Inicio" />
                  <input type="date" className={FIELD} value={newTask.end} min={newTask.start} onChange={event => setNewTask({ ...newTask, end: event.target.value })} aria-label="Término" />
                </div>
                <Button size="sm" className="mt-2" disabled={!newTask.stage || !newTask.title.trim()} onClick={async () => {
                  const { error } = await supabaseBrowser().rpc('add_project_task', { p_project: project.id, p_stage_key: newTask.stage, p_title: newTask.title.trim(), p_start: newTask.start || null, p_end: newTask.end || null })
                  setNotice(error ? error.message : 'Tarea agregada. La plantilla de la empresa no cambia.')
                  if (!error) { setNewTask({ stage: '', title: '', start: '', end: '' }); refresh() }
                }}>Agregar</Button>
              </details>
            )}
          </div>
        )}

        {tab === 'gantt' && <Gantt rows={rows} today={today} storageKey={`proyecto-${project.id}`} onOpen={row => { if (!row.id.startsWith('stage-')) openTask(row.id) }} testId="gantt-proyecto" />}

        {tab === 'entregables' && (
          <DeliverablesPanel deliverables={deliverables} stages={definition.stages} tasks={views} approvals={bundle.approvals} people={people} approvers={approvers}
            companyId={project.company_id} projectId={project.id} userId={session.userId} canManage={canManage} readOnly={readOnly} focusId={deliverableFocus} onChanged={refresh} />
        )}

        {tab === 'rfx' && <RfxPanel companyId={project.company_id} projectId={project.id} initiativeId={project.sourcing_plan_id} rfx={rfx} facts={bundle.facts} canManage={canManage} readOnly={readOnly} onChanged={refresh} />}

        {tab === 'contratos' && <ContractsPanel companyId={project.company_id} projectId={project.id} projectTitle={project.title} rfx={rfx} today={today} canManage={canManage} readOnly={readOnly} />}

        {tab === 'ahorro' && (
          <BaselinePanel companyId={project.company_id} projectId={project.id} initiativeId={project.sourcing_plan_id} rules={definition.rules} approvals={bundle.approvals}
            people={people} approvers={approvers} userId={session.userId} canManage={canManage} readOnly={readOnly} onChanged={refresh} />
        )}

        {tab === 'actividad' && (
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="glass-card space-y-3 p-4 lg:col-span-2">
              <h2 className="text-[14px] font-medium text-petrol-blue">Conversación del proyecto</h2>
              <Comments companyId={project.company_id} projectId={project.id} people={people} canWrite={!readOnly} />
              <h2 className="pt-2 text-[14px] font-medium text-petrol-blue">Actividad</h2>
              <ul className="space-y-1.5" data-testid="actividad-proyecto">
                {activity.map(item => (
                  <li key={item.id} className="flex gap-2 text-[12.5px] text-petrol-blue">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-turquoise" />
                    <span><span className="font-medium">{item.actor_id ? name(item.actor_id) : 'XPEND'}</span> · {item.summary}<span className="block text-[11px] text-petrol-blue/60">{new Date(item.at).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}</span></span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="glass-card space-y-2 p-4">
              <h2 className="flex items-center gap-1.5 text-[14px] font-medium text-petrol-blue"><Users className="h-4 w-4" />Equipo</h2>
              <ul className="space-y-2">
                {team.map(id => {
                  const assigned = main.filter(view => view.assignee_id === id && !view.done && view.state !== 'na')
                  return (
                    <li key={id} className="flex items-center justify-between gap-2 text-[12.5px] text-petrol-blue">
                      <span><span className="font-medium">{name(id)}</span>{id === project.owner_id ? ' · responsable' : id === project.backup_id ? ' · respaldo' : ''}</span>
                      <span className="text-petrol-blue/65">{assigned.length} abiertas{assigned.some(view => view.state === 'late') ? ` · ${assigned.filter(view => view.state === 'late').length} atrasadas` : ''}</span>
                    </li>
                  )
                })}
              </ul>
              <p className="flex items-center gap-1.5 pt-2 text-[11.5px] text-petrol-blue/65"><FileText className="h-3.5 w-3.5" />Metodología {METHODOLOGY_LABEL[project.methodology_kind || 'custom']} v{project.template_version}. El proyecto conserva la versión con la que se creó.</p>
            </section>
          </div>
        )}
      </div>

      {selected && (
        <TaskDrawer task={selected} subtasks={views.filter(view => view.parent_id === selected.id)} allTasks={main} stageName={stageName(selected.stage_key)} people={people}
          companyId={project.company_id} projectId={project.id} userId={session.userId} canManage={canManage} readOnly={readOnly} onClose={closeTask} onChanged={refresh} />
      )}
    </MainLayout>
  )
}

function TaskCard({ view, stage, owner, subtasks, onOpen }: { view: TaskView; stage: string; owner: string | null; subtasks: TaskView[]; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-xl border border-white/80 bg-white/85 p-2.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md" data-testid="tarjeta-tarea">
      <p className="text-[10.5px] font-medium uppercase tracking-wider text-petrol-blue/55">{stage}</p>
      <p className="mt-0.5 text-[12.5px] font-medium leading-snug text-petrol-blue">{view.code ? `${view.code}. ` : ''}{view.title}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10.5px]">
        {view.kind !== 'task' && <span className="rounded bg-accent-mint/40 px-1 text-petrol-blue">{view.kind === 'milestone' ? 'Hito' : 'Aprobación'}</span>}
        {view.deliverable_key && <span className="rounded bg-petrol-blue/[0.07] px-1 text-petrol-blue">Entregable</span>}
        {subtasks.length > 0 && <span className="rounded bg-petrol-blue/[0.07] px-1 text-petrol-blue">{subtasks.filter(sub => sub.done).length}/{subtasks.length}</span>}
        {view.eventProgress && <span className="rounded bg-petrol-blue/[0.07] px-1 text-petrol-blue">{view.eventProgress}</span>}
      </div>
      <p className="mt-1.5 flex items-center justify-between text-[11px] text-petrol-blue/70"><span className="truncate">{owner || 'Sin responsable'}</span><span className={view.state === 'late' ? 'font-medium text-red-700' : ''}>{view.committed_end ? view.committed_end.slice(5).split('-').reverse().join('-') : ''}</span></p>
    </button>
  )
}

function Ring({ value }: { value: number }) {
  const r = 18
  const c = 2 * Math.PI * r
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" role="img" aria-label={`${value}% de avance`}>
      <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(45,62,61,0.1)" strokeWidth="5" />
      <circle cx="24" cy="24" r={r} fill="none" stroke="#2d3e3d" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 24 24)" />
      <text x="24" y="28" textAnchor="middle" fontSize="11" fontWeight="600" fill="#2d3e3d">{value}%</text>
    </svg>
  )
}

function Stat({ icon: Icon, label, value, hint, tone }: { icon: typeof Flag; label: string; value: string; hint?: string; tone?: 'warn' }) {
  return (
    <div className="glass-card p-4">
      <p className="flex items-center gap-1.5 text-[12px] text-petrol-blue/70"><Icon className="h-3.5 w-3.5" />{label}</p>
      <p className={cn('mt-1 line-clamp-2 text-[13.5px] font-medium', tone === 'warn' ? 'text-red-700' : 'text-petrol-blue')}>{value}</p>
      {hint && <p className="text-[11.5px] text-petrol-blue/65">{hint}</p>}
    </div>
  )
}
