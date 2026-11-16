'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AlertTriangle, ChevronLeft, ChevronRight, Compass, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabaseBrowser } from '@/lib/supabase'
import { canStartTour, parseSteps, readTourState, samePage, TOUR_START_EVENT, TOUR_STATE_KEY, type TourRow, type TourState, type TourStep } from '@/lib/guided-tour'

export type AvailableTours = { role: string; isDemo: boolean; tours: TourRow[] }
let cache: Promise<AvailableTours | null> | null = null

async function fetchTours(): Promise<AvailableTours | null> {
  const supabase = supabaseBrowser()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).maybeSingle()
  if (!profile?.company_id) return null
  const { data: company } = await supabase.from('companies').select('settings').eq('id', profile.company_id).maybeSingle()
  const isDemo = (company?.settings as { demo?: boolean } | null)?.demo === true
  if (!isDemo) return { role: profile.role, isDemo, tours: [] }
  const { data } = await supabase.from('demo_tours').select('id, tour_key, name, description, audience, enabled, steps').eq('company_id', profile.company_id).order('tour_key')
  return { role: profile.role, isDemo, tours: (data || []) as TourRow[] }
}

export function useDemoTours(refreshKey = 0) {
  const [value, setValue] = useState<AvailableTours | null>(null)
  useEffect(() => {
    if (refreshKey) cache = null
    cache = cache || fetchTours().catch(() => null)
    let alive = true
    cache.then(result => { if (alive) setValue(result) })
    return () => { alive = false }
  }, [refreshKey])
  const startable = (value?.tours || []).filter(tour => tour.enabled && canStartTour(value?.role, tour.audience, !!value?.isDemo) && parseSteps(tour.steps).errors.length === 0)
  return { ...value, startable }
}

export function startTour(tourId: string) {
  window.dispatchEvent(new CustomEvent(TOUR_START_EVENT, { detail: { tourId } }))
}

type RecordCheck = 'checking' | 'ok' | 'missing'

export function GuidedTour() {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState<TourState | null>(null)
  const [tour, setTour] = useState<{ id: string; name: string; steps: TourStep[] } | null>(null)
  const [record, setRecord] = useState<RecordCheck>('checking')
  const [targetMissing, setTargetMissing] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)

  const persist = useCallback((next: TourState | null) => {
    setState(next)
    if (next) sessionStorage.setItem(TOUR_STATE_KEY, JSON.stringify(next))
    else sessionStorage.removeItem(TOUR_STATE_KEY)
  }, [])

  useEffect(() => {
    const saved = readTourState(sessionStorage)
    if (saved) setState(saved)
    const onStart = (event: Event) => {
      const tourId = (event as CustomEvent<{ tourId: string }>).detail?.tourId
      if (tourId) persist({ tourId, index: 0 })
    }
    window.addEventListener(TOUR_START_EVENT, onStart)
    return () => window.removeEventListener(TOUR_START_EVENT, onStart)
  }, [persist])

  useEffect(() => {
    if (!state) { setTour(null); return }
    if (tour?.id === state.tourId) return
    const supabase = supabaseBrowser()
    supabase.from('demo_tours').select('id, name, enabled, steps').eq('id', state.tourId).maybeSingle().then(({ data }) => {
      const steps = data?.enabled ? parseSteps(data.steps) : null
      if (!data || !steps || steps.errors.length) { persist(null); return }
      setTour({ id: data.id, name: data.name, steps: steps.steps })
    })
  }, [state, tour?.id, persist])

  const step = tour && state ? tour.steps[Math.min(state.index, tour.steps.length - 1)] : null

  useEffect(() => {
    if (!step) return
    if (!samePage(step.href, window.location.pathname, window.location.search)) router.push(step.href)
  }, [step, router])

  useEffect(() => {
    if (!step) return
    setRecord('checking')
    if (!step.record) { setRecord('ok'); return }
    supabaseBrowser().from(step.record.table).select('id').eq('id', step.record.id).maybeSingle()
      .then(({ data, error }) => setRecord(data && !error ? 'ok' : 'missing'))
  }, [step])

  useEffect(() => {
    heading.current?.focus()
  }, [step?.key])

  useEffect(() => {
    if (!step?.target) { setTargetMissing(false); return }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let element: Element | null = null
    let tries = 0
    const timer = window.setInterval(() => {
      element = document.querySelector(`[data-tour="${step.target}"], [data-testid="${step.target}"]`)
      if (element || ++tries > 30) {
        window.clearInterval(timer)
        setTargetMissing(!element)
        if (element) {
          element.classList.add('tour-highlight')
          element.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
        }
      }
    }, 150)
    return () => { window.clearInterval(timer); element?.classList.remove('tour-highlight') }
  }, [step?.target, step?.key, pathname])

  useEffect(() => {
    if (!state) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') persist(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, persist])

  if (!tour || !state || !step) return null
  const index = Math.min(state.index, tour.steps.length - 1)
  const last = index === tour.steps.length - 1

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="recorrido-titulo"
      data-testid="recorrido-guiado"
      data-paso={step.key}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 right-3 z-[60] rounded-[22px] border border-white/70 bg-white/95 p-4 shadow-[0_24px_60px_-24px_rgba(45,62,61,0.55)] backdrop-blur-xl sm:left-auto sm:right-24 sm:w-[380px]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-petrol-blue/60"><Compass className="h-3.5 w-3.5" aria-hidden />Recorrido guiado · {index + 1} de {tour.steps.length}</p>
        <button type="button" onClick={() => persist(null)} aria-label="Salir del recorrido" className="rounded-full p-1 text-petrol-blue/60 hover:bg-petrol-blue/5"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-petrol-blue/[0.08]" aria-hidden>
        <div className="h-full rounded-full bg-turquoise transition-[width] motion-reduce:transition-none" style={{ width: `${((index + 1) / tour.steps.length) * 100}%` }} />
      </div>
      <h2 id="recorrido-titulo" ref={heading} tabIndex={-1} className="mt-3 text-[16px] font-medium text-petrol-blue outline-none">{step.title}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-petrol-blue/85" aria-live="polite">{step.body}</p>
      {step.record?.label && record === 'ok' && <p className="mt-2 text-[12px] text-petrol-blue/65">Registro: {step.record.label}</p>}
      {record === 'missing' && (
        <p className="mt-2 flex gap-1.5 rounded-xl bg-amber-50 px-2.5 py-2 text-[12px] text-amber-900" role="status" data-testid="recorrido-sin-registro">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />El registro de este paso ya no existe o tu perfil no puede verlo. Puedes seguir con el paso siguiente.
        </p>
      )}
      {record === 'ok' && targetMissing && <p className="mt-2 text-[12px] text-petrol-blue/60">Busca en esta pantalla el bloque que describe el paso.</p>}
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => persist({ ...state, index: index - 1 })}><ChevronLeft className="mr-1 h-3.5 w-3.5" />Anterior</Button>
        <span className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => persist(null)}>Salir</Button>
          {last
            ? <Button size="sm" onClick={() => persist(null)} data-testid="recorrido-terminar">Terminar</Button>
            : <Button size="sm" onClick={() => persist({ ...state, index: index + 1 })} data-testid="recorrido-siguiente">Siguiente<ChevronRight className="ml-1 h-3.5 w-3.5" /></Button>}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-petrol-blue/55">Solo lectura: el recorrido no modifica datos. Al salir sigues explorando XPEND libremente.</p>
    </aside>
  )
}

export function DemoTourCard() {
  const { startable, isDemo } = useDemoTours()
  const [hidden, setHidden] = useState(false)
  useEffect(() => { setHidden(localStorage.getItem('xpend.recorrido.oculto') === '1') }, [])
  const tour = startable.find(item => item.audience === 'internal')
  if (!isDemo || !tour || hidden) return null
  return (
    <section className="glass-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="descubre-xpend">
      <div>
        <p className="text-[15px] font-medium text-petrol-blue">Descubre XPEND en acción</p>
        <p className="mt-0.5 max-w-2xl text-[12.5px] text-petrol-blue/75">{tour.description || 'Un recorrido por registros reales de esta empresa demo: del gasto al contrato y al ahorro.'} Puedes salir en cualquier momento.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="ghost" onClick={() => { localStorage.setItem('xpend.recorrido.oculto', '1'); setHidden(true) }}>Explorar por mi cuenta</Button>
        <Button size="sm" onClick={() => startTour(tour.id)} data-testid="iniciar-demo-guiada"><Compass className="mr-1 h-3.5 w-3.5" />Iniciar demo guiada</Button>
      </div>
    </section>
  )
}
