'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { LoadingSpinner } from '@/components/ui/loading'
import { EmptyHint } from '@/components/workspace-blocks'
import { CreateProject } from '@/components/project/create-project'
import { supabaseBrowser } from '@/lib/supabase'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { loadProjectsFor, METHODOLOGY_LABEL, PROJECT_STATUS_LABEL, type PortfolioProjects } from '@/lib/project-data'
import { summarize, todayISO, viewTasks } from '@/lib/project'
import { cn } from '@/lib/utils'

export default function ProjectsPage() {
  const router = useRouter()
  const [session, setSession] = useState<AppSession | null>(null)
  const [data, setData] = useState<PortfolioProjects | null>(null)
  const [people, setPeople] = useState<Map<string, string>>(new Map())
  const [plans, setPlans] = useState<Map<string, string>>(new Map())
  const [mine, setMine] = useState(false)
  const today = todayISO()

  const refresh = useCallback(async (appSession: AppSession) => {
    const supabase = supabaseBrowser()
    const companyId = appSession.companyId as string
    const [projects, team, initiatives] = await Promise.all([
      loadProjectsFor(supabase, companyId),
      supabase.from('profiles').select('id, full_name, email').eq('company_id', companyId).is('supplier_id', null),
      supabase.from('sourcing_plans').select('id, title').eq('company_id', companyId).limit(1000),
    ])
    setData(projects)
    setPeople(new Map(((team.data || []) as { id: string; full_name: string | null; email: string | null }[]).map(item => [item.id, item.full_name || item.email || 'Persona'])))
    setPlans(new Map(((initiatives.data || []) as { id: string; title: string }[]).map(item => [item.id, item.title])))
  }, [])

  useEffect(() => {
    loadAppSession().then(async appSession => {
      if (!appSession) return router.replace('/login')
      if (appSession.role === 'supplier') return router.replace('/sala')
      setSession(appSession)
      if (appSession.companyId) await refresh(appSession)
    })
  }, [router, refresh])

  const rows = useMemo(() => {
    if (!data) return []
    return data.projects.map(project => {
      const views = viewTasks(data.tasks.filter(task => task.project_id === project.id), data.facts.get(project.id) || [], today)
      return { project, summary: summarize(views, project.methodology_snapshot), team: new Set(views.flatMap(view => [view.assignee_id, ...view.collaborator_ids]).filter(Boolean)) }
    })
  }, [data, today])

  if (!session || !data) return <MainLayout><LoadingSpinner /></MainLayout>
  const visible = rows.filter(row => !mine || row.project.owner_id === session.userId || row.team.has(session.userId))

  return (
    <MainLayout user={{ name: session.name, email: session.email, role: session.role }} companyName={session.companyName}>
      <div className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1>Proyectos de sourcing</h1>
            <p className="mt-1 max-w-2xl text-[13px] text-petrol-blue/75">Cada iniciativa del plan se ejecuta en uno o más proyectos, con su metodología, plan de trabajo, entregables, procesos RFx y contratos.</p>
          </div>
          <label className="inline-flex items-center gap-1.5 text-[12.5px] text-petrol-blue"><input type="checkbox" checked={mine} onChange={event => setMine(event.target.checked)} />Solo donde participo</label>
        </header>

        {session.role !== 'viewer' && <CreateProject session={session} onCreated={id => router.push(`/proyectos/${id}`)} />}

        {visible.length === 0 ? <EmptyHint>No hay proyectos de sourcing {mine ? 'donde participes' : 'todavía'}.</EmptyHint> : (
          <div className="overflow-x-auto rounded-2xl border border-white/70 bg-white/65">
            <table className="w-full min-w-[960px] text-left text-[12.5px] text-petrol-blue" data-testid="tabla-proyectos">
              <thead><tr className="border-b border-petrol-blue/10 text-[12px] text-petrol-blue/70">{['Proyecto', 'Iniciativa', 'Responsable', 'Metodología', 'Avance', 'Etapa actual', 'Atrasadas · bloqueadas', 'Término comprometido', 'Estado'].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead>
              <tbody>
                {visible.map(({ project, summary }) => (
                  <tr key={project.id} className="border-b border-petrol-blue/[0.05] hover:bg-white" data-testid="fila-proyecto">
                    <td className="px-3 py-2"><Link href={`/proyectos/${project.id}`} className="font-medium hover:underline">{project.title}</Link></td>
                    <td className="px-3 py-2"><Link href={`/sourcing-plan/${project.sourcing_plan_id}`} className="hover:underline">{plans.get(project.sourcing_plan_id) || 'Iniciativa'}</Link></td>
                    <td className="px-3 py-2">{people.get(project.owner_id || '') || 'Sin responsable'}</td>
                    <td className="px-3 py-2">{METHODOLOGY_LABEL[project.methodology_kind || 'custom']} v{project.template_version}</td>
                    <td className="px-3 py-2"><span className="inline-flex items-center gap-2"><span className="h-1.5 w-16 overflow-hidden rounded-full bg-petrol-blue/10"><span className="block h-full bg-petrol-blue" style={{ width: `${summary.progress}%` }} /></span>{summary.progress}%</span></td>
                    <td className="px-3 py-2">{summary.currentStage || 'Completado'}</td>
                    <td className={cn('px-3 py-2', summary.late + summary.blocked > 0 && 'font-medium text-red-700')}>{summary.late} · {summary.blocked}</td>
                    <td className="px-3 py-2">{summary.slipDays > 0 ? <span className="text-red-700">+{summary.slipDays} d</span> : 'En plazo'}</td>
                    <td className="px-3 py-2">{PROJECT_STATUS_LABEL[project.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
