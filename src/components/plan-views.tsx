'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ChevronDown, ChevronRight, FileSignature, FolderKanban, Layers, Target, Workflow } from 'lucide-react'
import { EmptyHint } from '@/components/workspace-blocks'
import { Gantt } from '@/components/gantt'
import { DELIVERABLE_PILL } from '@/components/project/deliverables-panel'
import { HEALTH_LABEL, MILESTONE_LABEL, type InitiativeHealth } from '@/lib/milestones'
import type { InitiativeRow, InitiativeSchedule } from '@/lib/annual-plan-data'
import { METHODOLOGY_LABEL, type PortfolioProjects, type ProjectRow } from '@/lib/project-data'
import { DELIVERABLE_LABEL, portfolioGanttRows, summarize, viewTasks, type TaskView } from '@/lib/project'
import type { Category } from '@/lib/portfolio'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

// Vistas del Plan Anual. Las cuatro leen los mismos datos y filtros del portafolio; ninguna guarda una copia.

export const HEALTH_STYLE: Record<InitiativeHealth, string> = {
  completed: 'bg-accent-mint/40 text-petrol-blue',
  blocked: 'bg-amber-100 text-amber-900',
  late: 'bg-red-100 text-red-800',
  due_soon: 'bg-yellow-100 text-yellow-900',
  on_time: 'bg-white text-petrol-blue border border-petrol-blue/15',
  no_dates: 'bg-petrol-blue/[0.06] text-petrol-blue/80',
}
const LIC_STATUS: Record<string, string> = { planned: 'En preparación', bases_review: 'Bases en revisión', published: 'Publicada', evaluation: 'En evaluación', awarded: 'Adjudicada', contract_signed: 'Contrato firmado' }
const CONTRACT_STATUS: Record<string, string> = { draft: 'Borrador', in_review: 'En revisión', active: 'Vigente', expired: 'Vencido', terminated: 'Terminado' }

function fmt(date: string | null | undefined) {
  if (!date) return 'sin fecha'
  const [y, m, d] = date.slice(0, 10).split('-')
  return `${d}-${m}-${y}`
}

type Person = (id: string | null | undefined) => string
type OwnerOf = (initiative: InitiativeRow) => string | null

export type TreeData = {
  rfx: { id: string; name: string; type: string; status: string; sourcing_project_id: string | null; plan_id: string | null }[]
  links: { project_id: string; contract_id: string; role: string }[]
  contracts: { id: string; name: string; status: string; counterparty_name: string | null; ends_on: string | null; licitacion_id: string | null }[]
}

export async function loadTree(supabase: SupabaseClient, companyId: string, planIds: string[], projectIds: string[], readContracts: boolean): Promise<TreeData> {
  if (planIds.length === 0) return { rfx: [], links: [], contracts: [] }
  const [byProject, byPlan, links] = await Promise.all([
    projectIds.length ? supabase.from('licitaciones').select('id, name, type, status, sourcing_project_id').in('sourcing_project_id', projectIds) : Promise.resolve({ data: [] }),
    supabase.from('sourcing_plan_licitaciones').select('plan_id, licitacion_id').in('plan_id', planIds),
    projectIds.length && readContracts ? supabase.from('project_contracts').select('project_id, contract_id, role').in('project_id', projectIds) : Promise.resolve({ data: [] }),
  ])
  const planLinks = (byPlan.data || []) as { plan_id: string; licitacion_id: string }[]
  const known = new Set(((byProject.data || []) as { id: string }[]).map(item => item.id))
  const extraIds = planLinks.map(item => item.licitacion_id).filter(id => !known.has(id))
  const extra = extraIds.length ? (await supabase.from('licitaciones').select('id, name, type, status, sourcing_project_id').in('id', extraIds)).data || [] : []
  const planOf = new Map(planLinks.map(item => [item.licitacion_id, item.plan_id]))
  const rfx = [...((byProject.data || []) as TreeData['rfx']), ...(extra as TreeData['rfx'])].map(item => ({ ...item, plan_id: planOf.get(item.id) || null }))
  const contractIds = ((links.data || []) as TreeData['links']).map(item => item.contract_id)
  const licIds = rfx.map(item => item.id)
  const contracts = readContracts && (contractIds.length || licIds.length)
    ? ((await supabase.from('contracts').select('id, name, status, counterparty_name, ends_on, licitacion_id').eq('company_id', companyId).or([contractIds.length ? `id.in.(${contractIds.join(',')})` : '', licIds.length ? `licitacion_id.in.(${licIds.map(id => `"${id}"`).join(',')})` : ''].filter(Boolean).join(','))).data || []) as TreeData['contracts']
    : []
  return { rfx, links: (links.data || []) as TreeData['links'], contracts }
}

function useProjectViews(projects: PortfolioProjects | null, today: string) {
  return useMemo(() => {
    const map = new Map<string, { project: ProjectRow; views: TaskView[] }>()
    for (const project of projects?.projects || []) {
      map.set(project.id, { project, views: viewTasks((projects?.tasks || []).filter(task => task.project_id === project.id), projects?.facts.get(project.id) || [], today) })
    }
    return map
  }, [projects, today])
}

// ---------------------------------------------------------------- Tabla

export function PlanTable({ schedules, projects, today, categoryName, person, ownerOf }: { schedules: InitiativeSchedule[]; projects: PortfolioProjects | null; today: string; categoryName: (id: string | null) => string; person: Person; ownerOf: OwnerOf }) {
  const byProject = useProjectViews(projects, today)
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/70 bg-white/65" data-testid="lista-iniciativas">
      <table className="w-full min-w-[1040px] text-left text-[12.5px] text-petrol-blue" data-testid="vista-tabla">
        <thead><tr className="border-b border-petrol-blue/10 text-[12px] text-petrol-blue/70">{['Iniciativa / proyecto', 'Categoría', 'Responsable', 'Metodología', 'Avance', 'Próximo hito', 'Atrasos', 'Meta de ahorro', 'Estado'].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead>
        <tbody>
          {schedules.map(item => {
            const own = Array.from(byProject.values()).filter(entry => entry.project.sourcing_plan_id === item.initiative.id)
            const owner = ownerOf(item.initiative)
            const next = item.milestones.find(view => view.status !== 'completed' && view.committed_date)
            const late = item.milestones.filter(view => view.status === 'late').length
            return [
              <tr key={item.initiative.id} className="border-b border-petrol-blue/[0.05] bg-petrol-blue/[0.02]">
                <td className="px-3 py-2"><Link href={`/sourcing-plan/${item.initiative.id}`} className="font-medium hover:underline">{item.initiative.title}</Link><span className="block text-[11px] text-petrol-blue/60">Iniciativa · {own.length} proyecto{own.length === 1 ? '' : 's'}</span></td>
                <td className="px-3 py-2">{categoryName(item.initiative.category_id)}</td>
                <td className="px-3 py-2">{owner ? person(owner) : 'Sin responsable'}</td>
                <td className="px-3 py-2">—</td>
                <td className="px-3 py-2">—</td>
                <td className="px-3 py-2">{own.length ? '—' : next ? `${MILESTONE_LABEL[next.kind]} · ${fmt(next.committed_date)}` : 'Sin fecha'}</td>
                <td className={cn('px-3 py-2', !own.length && late > 0 && 'font-medium text-red-700')}>{own.length ? '—' : late}</td>
                <td className="px-3 py-2">{item.initiative.projected_savings_amount != null ? formatCurrency(item.initiative.projected_savings_amount, item.initiative.currency || 'CLP') : 'Sin meta'}</td>
                <td className="px-3 py-2"><span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', HEALTH_STYLE[item.health])}>{HEALTH_LABEL[item.health]}</span></td>
              </tr>,
              ...own.map(({ project, views }) => {
                const summary = summarize(views, project.methodology_snapshot)
                return (
                  <tr key={project.id} className="border-b border-petrol-blue/[0.05]" data-testid="fila-proyecto-plan">
                    <td className="py-2 pl-8 pr-3"><Link href={`/proyectos/${project.id}`} className="font-medium hover:underline">{project.title}</Link><span className="block text-[11px] text-petrol-blue/60">Proyecto de sourcing</span></td>
                    <td className="px-3 py-2">{categoryName(project.category_id)}</td>
                    <td className="px-3 py-2">{project.owner_id ? person(project.owner_id) : 'Sin responsable'}</td>
                    <td className="px-3 py-2">{METHODOLOGY_LABEL[project.methodology_kind || 'custom']}</td>
                    <td className="px-3 py-2"><span className="inline-flex items-center gap-2"><span className="h-1.5 w-14 overflow-hidden rounded-full bg-petrol-blue/10"><span className="block h-full bg-petrol-blue" style={{ width: `${summary.progress}%` }} /></span>{summary.progress}%</span></td>
                    <td className="px-3 py-2">{summary.nextMilestone ? `${summary.nextMilestone.title} · ${fmt(summary.nextMilestone.committed_end)}` : 'Sin hitos pendientes'}</td>
                    <td className={cn('px-3 py-2', summary.late + summary.blocked > 0 && 'font-medium text-red-700')}>{summary.late} atrasadas · {summary.blocked} bloq.</td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2">{summary.currentStage || 'Completado'}</td>
                  </tr>
                )
              }),
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------- Árbol

type Node = { id: string; icon: typeof Layers; label: string; detail?: string; href?: string; badge?: { text: string; className: string }; children: Node[] }

export function PlanTree({ schedules, categories, projects, tree, today, person, ownerOf }: { schedules: InitiativeSchedule[]; categories: Category[]; projects: PortfolioProjects | null; tree: TreeData; today: string; person: Person; ownerOf: OwnerOf }) {
  const byProject = useProjectViews(projects, today)
  const nodes = useMemo(() => {
    const initiativeNode = (item: InitiativeSchedule): Node => {
      const own = Array.from(byProject.values()).filter(entry => entry.project.sourcing_plan_id === item.initiative.id)
      const owner = ownerOf(item.initiative)
      const projectNodes: Node[] = own.map(({ project, views }) => {
        const summary = summarize(views, project.methodology_snapshot)
        const rfx = tree.rfx.filter(row => row.sourcing_project_id === project.id)
        const linked = tree.links.filter(link => link.project_id === project.id)
        const contractIds = new Set([...linked.map(link => link.contract_id), ...tree.contracts.filter(contract => rfx.some(row => row.id === contract.licitacion_id)).map(contract => contract.id)])
        return {
          id: project.id, icon: FolderKanban, label: project.title, href: `/proyectos/${project.id}`,
          detail: `${METHODOLOGY_LABEL[project.methodology_kind || 'custom']} · ${summary.progress}% · ${summary.currentStage || 'completado'}`,
          badge: summary.late + summary.blocked > 0 ? { text: `${summary.late + summary.blocked} con atraso o bloqueo`, className: 'bg-red-100 text-red-800' } : undefined,
          children: [
            ...rfx.map(row => ({ id: row.id, icon: Workflow, label: `${row.type} · ${row.name}`, detail: LIC_STATUS[row.status] || row.status, href: `/licitaciones/${row.id}`, children: [] })),
            ...Array.from(contractIds).map(id => tree.contracts.find(contract => contract.id === id)).filter(Boolean).map(contract => {
              const role = linked.find(link => link.contract_id === contract!.id)?.role
              return { id: contract!.id, icon: FileSignature, label: contract!.name, detail: `${role === 'affected' ? 'Contrato anterior' : role === 'successor' ? 'Contrato nuevo' : 'Contrato'} · ${CONTRACT_STATUS[contract!.status] || contract!.status}${contract!.ends_on ? ` · vence ${fmt(contract!.ends_on)}` : ''}`, href: `/contratos/${contract!.id}`, children: [] }
            }),
          ],
        }
      })
      const loose = tree.rfx.filter(row => row.plan_id === item.initiative.id && !row.sourcing_project_id)
      return {
        id: item.initiative.id, icon: Target, label: item.initiative.title, href: `/sourcing-plan/${item.initiative.id}`,
        detail: `${owner ? person(owner) : 'Sin responsable'} · ${own.length} proyecto${own.length === 1 ? '' : 's'}`,
        badge: { text: HEALTH_LABEL[item.health], className: HEALTH_STYLE[item.health] },
        children: [...projectNodes, ...loose.map(row => ({ id: row.id, icon: Workflow, label: `${row.type} · ${row.name}`, detail: `${LIC_STATUS[row.status] || row.status} · sin proyecto`, href: `/licitaciones/${row.id}`, children: [] }))],
      }
    }
    const topLevel = categories.filter(category => !category.parent_id)
    const result: Node[] = []
    for (const top of topLevel) {
      const subs = categories.filter(category => category.parent_id === top.id)
      const direct = schedules.filter(item => item.initiative.category_id === top.id).map(initiativeNode)
      const subNodes = subs.map(sub => ({ id: sub.id, icon: Layers, label: sub.name, detail: 'Subcategoría', children: schedules.filter(item => item.initiative.category_id === sub.id).map(initiativeNode) })).filter(node => node.children.length > 0)
      if (direct.length + subNodes.length === 0) continue
      result.push({ id: top.id, icon: Layers, label: top.name, detail: `${subNodes.length} subcategoría${subNodes.length === 1 ? '' : 's'} con iniciativas`, children: [...subNodes, ...direct] })
    }
    const orphan = schedules.filter(item => !item.initiative.category_id || !categories.some(category => category.id === item.initiative.category_id))
    if (orphan.length) result.push({ id: 'sin-categoria', icon: Layers, label: 'Sin categoría', children: orphan.map(initiativeNode) })
    return result
  }, [schedules, categories, byProject, tree, person, ownerOf])

  const [closed, setClosed] = useState<Set<string>>(new Set())
  if (nodes.length === 0) return <EmptyHint>No hay iniciativas con este filtro.</EmptyHint>
  const toggle = (id: string) => setClosed(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const render = (node: Node, depth: number): React.ReactNode => {
    const Icon = node.icon
    const open = !closed.has(node.id)
    return (
      <li key={`${depth}-${node.id}`} role="treeitem" aria-expanded={node.children.length ? open : undefined} aria-selected={false}>
        <div className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/70" style={{ paddingLeft: 8 + depth * 18 }}>
          {node.children.length ? <button type="button" onClick={() => toggle(node.id)} aria-label={open ? `Contraer ${node.label}` : `Expandir ${node.label}`} className="rounded p-0.5 text-petrol-blue/60 hover:bg-petrol-blue/10">{open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</button> : <span className="w-[18px]" />}
          <Icon className="h-3.5 w-3.5 shrink-0 text-petrol-blue/60" aria-hidden />
          {node.href ? <Link href={node.href} className="min-w-0 truncate text-[13px] font-medium text-petrol-blue hover:underline">{node.label}</Link> : <span className="min-w-0 truncate text-[13px] font-medium text-petrol-blue">{node.label}</span>}
          {node.detail && <span className="hidden truncate text-[11.5px] text-petrol-blue/65 sm:inline">{node.detail}</span>}
          {node.badge && <span className={cn('ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium', node.badge.className)}>{node.badge.text}</span>}
        </div>
        {open && node.children.length > 0 && <ul role="group">{node.children.map(child => render(child, depth + 1))}</ul>}
      </li>
    )
  }
  return (
    <div className="rounded-2xl border border-white/70 bg-white/55 p-2" data-testid="vista-arbol">
      <p className="px-2 pb-2 text-[12px] text-petrol-blue/70">Categoría → subcategoría → iniciativa → proyecto → procesos RFx y contratos. Cada nodo abre su registro.</p>
      <ul role="tree" aria-label="Árbol del plan">{nodes.map(node => render(node, 0))}</ul>
    </div>
  )
}

// ---------------------------------------------------------------- Gantt

export function PlanGantt({ schedules, projects, today, person, ownerOf, year }: { schedules: InitiativeSchedule[]; projects: PortfolioProjects | null; today: string; person: Person; ownerOf: OwnerOf; year: number }) {
  const byProject = useProjectViews(projects, today)
  const rows = useMemo(() => portfolioGanttRows(
    schedules.map(item => {
      const owner = ownerOf(item.initiative)
      return { id: item.initiative.id, title: item.initiative.title, owner: owner ? person(owner) : null, milestones: item.milestones.map(view => ({ id: view.id, label: view.label, committed_date: view.committed_date, original_date: view.original_date, actual: view.actual, status: view.status })) }
    }),
    Array.from(byProject.values()).map(({ project, views }) => ({ id: project.id, title: project.title, owner: project.owner_id ? person(project.owner_id) : null, initiativeId: project.sourcing_plan_id, definition: project.methodology_snapshot, views })),
  ), [schedules, byProject, person, ownerOf])
  const collapsed = rows.filter(row => row.level === 1 && row.summary).map(row => row.id)
  return (
    <div className="space-y-2">
      <Gantt rows={rows} today={today} storageKey={`portafolio-${year}`} defaultCollapsed={collapsed} onOpen={row => { if (row.href) window.location.assign(row.href) }} testId="gantt-portafolio"
        empty={`Ninguna iniciativa de ${year} tiene fechas comprometidas todavía.`} />
      <p className="text-[12px] text-petrol-blue/70">Con proyecto, las barras salen de su plan de trabajo (etapas y actividades). Sin proyecto, se muestran los hitos de la iniciativa. Un mismo dato, una sola fuente.</p>
    </div>
  )
}

// ---------------------------------------------------------------- Entregables

export function PlanDeliverables({ schedules, projects, today, person, userId }: { schedules: InitiativeSchedule[]; projects: PortfolioProjects | null; today: string; person: Person; userId: string }) {
  const [status, setStatus] = useState('')
  const planIds = new Set(schedules.map(item => item.initiative.id))
  const visibleProjects = (projects?.projects || []).filter(project => planIds.has(project.sourcing_plan_id))
  const projectById = new Map(visibleProjects.map(project => [project.id, project]))
  const pending = new Map((projects?.approvals || []).filter(row => row.subject_kind === 'deliverable').map(row => [row.subject_id, row.approver_id]))
  const items = (projects?.deliverables || [])
    .filter(item => projectById.has(item.project_id))
    .map(item => ({ ...item, overdue: !!item.due_date && item.due_date < today && !['approved', 'not_applicable'].includes(item.status), waitingMe: pending.get(item.id) === userId }))
    .filter(item => !status || (status === 'overdue' ? item.overdue : status === 'mine' ? item.waitingMe : item.status === status))
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))
  if (visibleProjects.length === 0) return <EmptyHint>Los entregables nacen de los proyectos de sourcing. Ninguna iniciativa con este filtro tiene proyecto todavía.</EmptyHint>
  const counts = { overdue: items.filter(item => item.overdue).length }
  return (
    <div className="space-y-2" data-testid="vista-entregables">
      <div className="flex flex-wrap items-center gap-1.5">
        {[['', 'Todos'], ['mine', 'Esperan mi aprobación'], ['overdue', `Vencidos${counts.overdue ? ` (${counts.overdue})` : ''}`], ['in_review', 'En aprobación'], ['approved', 'Aprobados'], ['pending', 'Sin documento'], ['rejected', 'Rechazados']].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={status === id} onClick={() => setStatus(id)} className={cn('rounded-full px-3 py-1 text-[12px] font-medium', status === id ? 'bg-petrol-blue text-white' : 'border border-petrol-blue/15 bg-white/70 text-petrol-blue')}>{label}</button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/70 bg-white/65">
        <table className="w-full min-w-[860px] text-left text-[12.5px] text-petrol-blue">
          <thead><tr className="border-b border-petrol-blue/10 text-[12px] text-petrol-blue/70">{['Entregable', 'Proyecto', 'Responsable', 'Vence', 'Versión', 'Aprobación', 'Estado'].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead>
          <tbody>
            {items.map(item => {
              const project = projectById.get(item.project_id)!
              return (
                <tr key={item.id} className="border-b border-petrol-blue/[0.05] hover:bg-white" data-testid="fila-entregable">
                  <td className="px-3 py-2"><Link href={`/proyectos/${project.id}?tab=entregables&entregable=${item.id}`} className="font-medium hover:underline">{item.title}</Link></td>
                  <td className="px-3 py-2">{project.title}</td>
                  <td className="px-3 py-2">{item.owner_id ? person(item.owner_id) : 'Sin responsable'}</td>
                  <td className={cn('px-3 py-2', item.overdue && 'font-medium text-red-700')}>{fmt(item.due_date)}</td>
                  <td className="px-3 py-2">{item.current_version ? `v${item.current_version}` : '—'}</td>
                  <td className="px-3 py-2">{item.requires_approval ? (item.approved_by ? `${person(item.approved_by)} · ${fmt(item.approved_at)}` : item.waitingMe ? <span className="font-medium">Te espera</span> : 'Requerida') : 'No requiere'}</td>
                  <td className="px-3 py-2"><span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', DELIVERABLE_PILL[item.status])}>{DELIVERABLE_LABEL[item.status]}</span></td>
                </tr>
              )
            })}
            {items.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-petrol-blue/70">No hay entregables con este filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

