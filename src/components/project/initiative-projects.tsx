'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { BlockCard, EmptyHint } from '@/components/workspace-blocks'
import { CreateProject } from '@/components/project/create-project'
import { supabaseBrowser } from '@/lib/supabase'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { loadProjectsFor, METHODOLOGY_LABEL, PROJECT_STATUS_LABEL, projectHref, type PortfolioProjects } from '@/lib/project-data'
import { summarize, todayISO, viewTasks } from '@/lib/project'

// Proyectos de sourcing de una iniciativa: la iniciativa define qué y cuánto; el proyecto, cómo se ejecuta.
export function InitiativeProjects({ initiativeId, canCreate }: { initiativeId: string; canCreate: boolean }) {
  const router = useRouter()
  const [session, setSession] = useState<AppSession | null>(null)
  const [data, setData] = useState<PortfolioProjects | null>(null)

  const refresh = useCallback(async (companyId: string) => {
    setData(await loadProjectsFor(supabaseBrowser(), companyId, [initiativeId]))
  }, [initiativeId])

  useEffect(() => {
    loadAppSession().then(appSession => {
      if (!appSession?.companyId) return
      setSession(appSession)
      refresh(appSession.companyId)
    })
  }, [refresh])

  if (!session || !data) return null
  const today = todayISO()
  return (
    <BlockCard title="Proyectos de sourcing" description="Cada proyecto lleva el plan de trabajo, los entregables, los procesos RFx y los contratos de esta iniciativa, con la metodología con la que nació." action={{ label: 'Todos los proyectos', href: '/proyectos' }}>
      <div className="space-y-3" data-testid="proyectos-iniciativa">
        {data.projects.length === 0 ? <EmptyHint>La iniciativa aún no tiene un proyecto de sourcing.</EmptyHint> : (
          <ul className="divide-y divide-petrol-blue/[0.06]">
            {data.projects.map(project => {
              const summary = summarize(viewTasks(data.tasks.filter(task => task.project_id === project.id), data.facts.get(project.id) || [], today), project.methodology_snapshot)
              return (
                <li key={project.id}>
                  <Link href={projectHref(project.id)} className="flex items-center justify-between gap-3 py-2.5 hover:bg-white/50">
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium text-petrol-blue">{project.title}</span>
                      <span className="block text-[12px] text-petrol-blue/70">
                        {PROJECT_STATUS_LABEL[project.status]} · {METHODOLOGY_LABEL[project.methodology_kind || ''] || 'Metodología'} v{project.template_version} · {summary.progress}% · {summary.currentStage || 'Plan completo'}
                        {summary.late > 0 && <span className="text-red-700"> · {summary.late} atrasadas</span>}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-petrol-blue/60" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
        {canCreate && <CreateProject session={session} initiativeId={initiativeId} compact onCreated={id => router.push(projectHref(id))} />}
      </div>
    </BlockCard>
  )
}
