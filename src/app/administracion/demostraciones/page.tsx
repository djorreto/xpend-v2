'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, CheckCircle2, Compass, XCircle } from 'lucide-react'
import { MainLayout } from '@/components/layout/main-layout'
import { LoadingSpinner } from '@/components/ui/loading'
import { Button } from '@/components/ui/button'
import { BlockCard, EmptyHint } from '@/components/workspace-blocks'
import { startTour } from '@/components/guided-tour'
import { supabaseBrowser } from '@/lib/supabase'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { canConfigureTours, canStartTour, parseSteps, type TourRow, type TourStep } from '@/lib/guided-tour'
import { cn } from '@/lib/utils'

const FIELD = 'w-full rounded-lg border border-petrol-blue/15 bg-white/85 px-2 py-1.5 text-[12.5px] text-petrol-blue'
type Check = Record<string, 'ok' | 'missing' | 'checking'>

export default function DemonstrationsPage() {
  const router = useRouter()
  const [session, setSession] = useState<AppSession | null>(null)
  const [isDemo, setIsDemo] = useState<boolean | null>(null)
  const [tours, setTours] = useState<TourRow[]>([])
  const [checks, setChecks] = useState<Record<string, Check>>({})
  const [drafts, setDrafts] = useState<Record<string, TourStep[]>>({})
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const refresh = useCallback(async (companyId: string) => {
    const supabase = supabaseBrowser()
    const { data: company } = await supabase.from('companies').select('settings').eq('id', companyId).maybeSingle()
    const demo = (company?.settings as { demo?: boolean } | null)?.demo === true
    setIsDemo(demo)
    if (!demo) return
    const { data } = await supabase.from('demo_tours').select('id, tour_key, name, description, audience, enabled, steps').eq('company_id', companyId).order('tour_key')
    setTours((data || []) as TourRow[])
    setDrafts({})
  }, [])

  useEffect(() => {
    loadAppSession().then(async appSession => {
      if (!appSession) return router.replace('/login')
      if (appSession.role === 'supplier') return router.replace('/sala')
      setSession(appSession)
      if (appSession.companyId) await refresh(appSession.companyId)
    })
  }, [router, refresh])

  if (!session || isDemo === null) return <MainLayout><LoadingSpinner /></MainLayout>
  const supabase = supabaseBrowser()
  const configure = canConfigureTours(session.role, isDemo)

  const verify = async (tour: TourRow) => {
    const { steps } = parseSteps(tour.steps)
    setChecks(current => ({ ...current, [tour.id]: Object.fromEntries(steps.map(step => [step.key, 'checking'])) }))
    const results = await Promise.all(steps.map(async step => {
      if (!step.record) return [step.key, 'ok'] as const
      const { data, error } = await supabase.from(step.record.table).select('id').eq('id', step.record.id).maybeSingle()
      return [step.key, data && !error ? 'ok' : 'missing'] as const
    }))
    setChecks(current => ({ ...current, [tour.id]: Object.fromEntries(results) }))
  }

  const save = async (tour: TourRow, patch: Partial<Pick<TourRow, 'enabled' | 'steps'>>, ok: string) => {
    if (patch.steps) {
      const { errors } = parseSteps(patch.steps)
      if (errors.length) return setMessage({ kind: 'error', text: errors.join(' ') })
    }
    const { error } = await supabase.from('demo_tours').update(patch).eq('id', tour.id)
    if (error) return setMessage({ kind: 'error', text: error.message })
    setMessage({ kind: 'ok', text: ok })
    await refresh(session.companyId as string)
  }

  return (
    <MainLayout user={{ name: session.name, email: session.email, role: session.role }} companyName={session.companyName}>
      <div className="space-y-5" data-testid="demostraciones">
        <header>
          <h1>Demostraciones</h1>
          <p className="mt-1 max-w-3xl text-[13px] text-petrol-blue/75">
            Recorridos guiados sobre registros reales de la empresa demo. Solo navegan y leen: no crean, cambian ni borran datos, y no llaman a modelos de IA. Nunca se inician solos.
          </p>
        </header>
        {message && <p role="status" className={cn('rounded-xl px-3 py-2 text-[12.5px]', message.kind === 'ok' ? 'bg-accent-mint/30 text-petrol-blue' : 'bg-red-50 text-red-800')}>{message.text}</p>}
        {!isDemo ? (
          <EmptyHint>Esta empresa no es de demostración: aquí no hay recorridos guiados. Los recorridos existen solo en empresas marcadas como DEMO.</EmptyHint>
        ) : tours.length === 0 ? (
          <EmptyHint>La empresa demo todavía no tiene recorridos cargados.</EmptyHint>
        ) : tours.map(tour => {
          const parsed = parseSteps(tour.steps)
          const steps = drafts[tour.id] || parsed.steps
          const check = checks[tour.id]
          const missing = check ? Object.values(check).filter(value => value === 'missing').length : null
          const startable = tour.enabled && canStartTour(session.role, tour.audience, isDemo) && parsed.errors.length === 0
          const edit = (index: number, patch: Partial<TourStep>) => setDrafts(current => ({ ...current, [tour.id]: steps.map((step, position) => position === index ? { ...step, ...patch } : step) }))
          const move = (index: number, delta: number) => { const next = [...steps]; const [item] = next.splice(index, 1); next.splice(index + delta, 0, item); setDrafts(current => ({ ...current, [tour.id]: next })) }
          return (
            <BlockCard key={tour.id} title={tour.name} description={`${tour.description || ''} ${tour.audience === 'supplier' ? 'Para proveedores, en su portal.' : 'Para el equipo interno.'}`.trim()}>
              <div className="space-y-3" data-testid="recorrido-config" data-recorrido={tour.tour_key}>
                <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-petrol-blue">
                  <span className={cn('rounded-full px-2 py-0.5 text-[11.5px] font-medium', tour.enabled ? 'bg-accent-mint/40' : 'bg-petrol-blue/[0.06]')}>{tour.enabled ? 'Disponible' : 'No disponible'}</span>
                  <span>{steps.length} pasos</span>
                  {missing !== null && <span data-testid="registros-verificados" className={missing ? 'text-red-700' : 'text-petrol-blue'}>{missing ? `${missing} paso${missing === 1 ? '' : 's'} sin registro accesible` : 'Todos los registros existen y tu perfil puede verlos'}</span>}
                  <span className="ml-auto flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => verify(tour)} data-testid="verificar-registros">Verificar registros</Button>
                    {configure && <Button size="sm" variant="outline" onClick={() => save(tour, { enabled: !tour.enabled }, tour.enabled ? 'Recorrido desactivado.' : 'Recorrido disponible.')}>{tour.enabled ? 'Desactivar' : 'Activar'}</Button>}
                    {startable && <Button size="sm" onClick={() => startTour(tour.id)}><Compass className="mr-1 h-3.5 w-3.5" />Iniciar</Button>}
                  </span>
                </div>
                {parsed.errors.length > 0 && <p className="rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-800">{parsed.errors.join(' ')}</p>}
                <ol className="space-y-2">
                  {steps.map((step, index) => (
                    <li key={step.key} className="rounded-2xl bg-white/70 p-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-1 w-5 text-[12px] font-medium text-petrol-blue/55">{index + 1}</span>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          {configure ? (
                            <>
                              <input className={FIELD} value={step.title} onChange={event => edit(index, { title: event.target.value })} aria-label={`Título del paso ${index + 1}`} />
                              <textarea className={FIELD} rows={2} value={step.body} onChange={event => edit(index, { body: event.target.value })} aria-label={`Explicación del paso ${index + 1}`} />
                            </>
                          ) : (
                            <><p className="text-[13px] font-medium text-petrol-blue">{step.title}</p><p className="text-[12.5px] text-petrol-blue/80">{step.body}</p></>
                          )}
                          <p className="text-[11.5px] text-petrol-blue/65">
                            Pantalla: <Link href={step.href} className="underline">{step.href.split('?')[0]}</Link>
                            {step.record && <> · Registro: {step.record.label || step.record.table}</>}
                            {check?.[step.key] === 'ok' && <CheckCircle2 className="ml-1 inline h-3.5 w-3.5 text-emerald-600" aria-label="Registro disponible" />}
                            {check?.[step.key] === 'missing' && <XCircle className="ml-1 inline h-3.5 w-3.5 text-red-600" aria-label="Registro no disponible" />}
                          </p>
                        </div>
                        {configure && (
                          <div className="flex flex-col">
                            {index > 0 && <button type="button" aria-label="Subir paso" onClick={() => move(index, -1)}><ArrowUp className="h-3.5 w-3.5" /></button>}
                            {index < steps.length - 1 && <button type="button" aria-label="Bajar paso" onClick={() => move(index, 1)}><ArrowDown className="h-3.5 w-3.5" /></button>}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                {configure && drafts[tour.id] && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => save(tour, { steps: drafts[tour.id] }, 'Recorrido actualizado.')}>Guardar cambios</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDrafts(current => { const next = { ...current }; delete next[tour.id]; return next })}>Descartar</Button>
                  </div>
                )}
                {!configure && <p className="text-[11.5px] text-petrol-blue/65">Solo un administrador de la empresa demo o Super Admin configura los recorridos.</p>}
              </div>
            </BlockCard>
          )
        })}
      </div>
    </MainLayout>
  )
}
