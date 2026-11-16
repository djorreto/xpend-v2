'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Award, BarChart3, Check, FileText, Lock, Scale, ScrollText, Send, ShieldCheck, Sparkles, Target, Users,
} from 'lucide-react'

/* Ilustraciones animadas de la home. Todo es SVG/CSS: sin dependencias nuevas ni servicios externos.
   Los ejemplos de cifras son ilustrativos y así se rotulan en pantalla. */

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function useInView<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setSeen(entry.isIntersecting), { threshold })
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])
  return [ref, seen] as const
}

/* Revelado al desplazarse y brillo que sigue al cursor. */
export function useHomeEffects(root: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = root.current
    if (!el) return
    const items = Array.from(el.querySelectorAll<HTMLElement>('.rv'))
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) { entry.target.classList.add('in'); observer.unobserve(entry.target) }
      }
    }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' })
    items.forEach(item => observer.observe(item))
    const onMove = (event: PointerEvent) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>('.xh-spot')
      if (!card) return
      const box = card.getBoundingClientRect()
      card.style.setProperty('--mx', `${event.clientX - box.left}px`)
      card.style.setProperty('--my', `${event.clientY - box.top}px`)
    }
    el.addEventListener('pointermove', onMove)
    return () => { observer.disconnect(); el.removeEventListener('pointermove', onMove) }
  }, [root])
}

/* ---------- Logotipos de los módulos ---------- */
export type ModuleKind = 'intelligence' | 'sourcing' | 'contracts' | 'ana'

const MARK_GRADIENT: Record<ModuleKind, [string, string]> = {
  intelligence: ['#3be7ae', '#2ad4d2'],
  sourcing: ['#c6ff00', '#3be7ae'],
  contracts: ['#2ad4d2', '#1f8f72'],
  ana: ['#ffffff', '#c6ff00'],
}

export function ModuleMark({ kind, size = 44 }: { kind: ModuleKind; size?: number }) {
  const [from, to] = MARK_GRADIENT[kind]
  const id = `mk-${kind}`
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="4" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse"><stop stopColor={from} /><stop offset="1" stopColor={to} /></linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill={`url(#${id})`} />
      <g stroke="#06100f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {kind === 'intelligence' && (<><path d="M12 28V21M20 28V14M28 28V18" /><circle cx="28" cy="11.5" r="1.8" fill="#06100f" stroke="none" /></>)}
        {kind === 'sourcing' && (<><circle cx="12" cy="13" r="2.6" /><circle cx="12" cy="27" r="2.6" /><circle cx="29" cy="20" r="2.6" fill="#06100f" /><path d="M14.6 13C21 13 21 20 26.4 20M14.6 27C21 27 21 20 26.4 20" /></>)}
        {kind === 'contracts' && (<><path d="M13 9.5h10l5.5 5.5v15.5H13z" /><path d="M17 22.5l3 3 5-6" /></>)}
        {kind === 'ana' && (<path d="M20 8l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="#06100f" stroke="none" />)}
      </g>
    </svg>
  )
}

/* ---------- Hero: el proceso completo, animado ---------- */
const HERO_NODES = [
  { label: 'Gasto', note: 'Cargas tu gasto y ves categorías y proveedores.', Icon: BarChart3, x: 60, y: 230 },
  { label: 'Iniciativa', note: 'Decides qué comprar, con qué meta de ahorro.', Icon: Target, x: 190, y: 120 },
  { label: 'RFx', note: 'Armas las bases y las publicas cuando estén listas.', Icon: FileText, x: 320, y: 230 },
  { label: 'Sala de ofertas', note: 'Invitas proveedores con NDA y recibes propuestas.', Icon: Send, x: 450, y: 120 },
  { label: 'Evaluación', note: 'Comparas ofertas con criterios y justificación.', Icon: Scale, x: 580, y: 230 },
  { label: 'Contrato', note: 'Del adjudicado al contrato, con el mismo expediente.', Icon: ScrollText, x: 710, y: 120 },
]
const HERO_W = 770
const HERO_H = 340
const HERO_PATH = 'M60 230 C125 230 125 120 190 120 S255 230 320 230 S385 120 450 120 S515 230 580 230 S645 120 710 120'

export function HeroStage() {
  const reduced = useReducedMotion()
  const [active, setActive] = useState(0)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduced) return
    const timer = setInterval(() => setActive(index => (index + 1) % HERO_NODES.length), 1800)
    return () => clearInterval(timer)
  }, [reduced])

  useEffect(() => {
    const el = stageRef.current
    if (!el || reduced) return
    let frame = 0
    const update = () => {
      frame = 0
      const p = Math.min(1, Math.max(0, window.scrollY / 540))
      el.style.transform = `rotateX(${(1 - p) * 13}deg) scale(${0.94 + 0.06 * p})`
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame) }
  }, [reduced])

  return (
    <div className="xh-stage-wrap relative mx-auto mt-14 max-w-5xl px-4 sm:px-6">
      <div className="pointer-events-none absolute -left-4 bottom-8 z-10 hidden lg:block xh-float" aria-hidden>
        <div className="xh-glass flex items-center gap-3 rounded-2xl px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#3be7ae] to-[#2ad4d2] text-[#06100f]"><Sparkles className="h-4 w-4" /></span>
          <span className="text-left"><span className="block text-xs text-white/50">ANA</span><span className="block text-sm font-medium">Cita la fuente</span></span>
        </div>
      </div>
      <div className="pointer-events-none absolute -right-2 bottom-24 z-10 hidden lg:block xh-float b" aria-hidden>
        <div className="xh-glass flex items-center gap-3 rounded-2xl px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#c6ff00] to-[#3be7ae] text-[#06100f]"><ShieldCheck className="h-4 w-4" /></span>
          <span className="text-left"><span className="block text-xs text-white/50">Gobierno</span><span className="block text-sm font-medium">Una persona aprueba</span></span>
        </div>
      </div>

      <div ref={stageRef} className="xh-stage xh-glass overflow-hidden rounded-[2rem] p-4 sm:p-8">
        <div className="mb-5 flex items-center gap-2" aria-hidden>
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]/80" /><span className="h-3 w-3 rounded-full bg-[#febc2e]/80" /><span className="h-3 w-3 rounded-full bg-[#28c840]/80" />
          <span className="ml-3 rounded-full bg-white/[0.06] px-3 py-1 text-[11px] text-white/45">xpend.cl · Un solo expediente</span>
        </div>
        <div className="relative w-full" style={{ aspectRatio: `${HERO_W} / ${HERO_H}` }} role="img" aria-label="Diagrama animado del proceso: gasto, iniciativa, RFx, sala de ofertas, evaluación y contrato">
          <svg viewBox={`0 0 ${HERO_W} ${HERO_H}`} className="absolute inset-0 h-full w-full" fill="none" aria-hidden>
            <defs>
              <linearGradient id="xh-flow-grad" x1="0" y1="0" x2={HERO_W} y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3be7ae" /><stop offset=".5" stopColor="#2ad4d2" /><stop offset="1" stopColor="#c6ff00" />
              </linearGradient>
              <filter id="xh-glow"><feGaussianBlur stdDeviation="5" /></filter>
            </defs>
            <path d={HERO_PATH} className="xh-path-base" />
            <path d={HERO_PATH} className="xh-path-flow" />
            {!reduced && (
              <g>
                <circle r="16" fill="#3be7ae" opacity=".45" filter="url(#xh-glow)">
                  <animateMotion dur="10.8s" repeatCount="indefinite" path={HERO_PATH} calcMode="linear" keyPoints="0;1;1" keyTimes="0;0.8333;1" />
                </circle>
                <circle r="5.5" fill="#fff">
                  <animateMotion dur="10.8s" repeatCount="indefinite" path={HERO_PATH} calcMode="linear" keyPoints="0;1;1" keyTimes="0;0.8333;1" />
                </circle>
              </g>
            )}
          </svg>
          {HERO_NODES.map(({ label, Icon, x, y }, index) => (
            <div key={label} className={`xh-node ${active === index ? 'on' : ''}`} style={{ left: `${(x / HERO_W) * 100}%`, top: `${(y / HERO_H) * 100}%` }}>
              <div className="xh-node-dot"><Icon className="h-[46%] w-[46%]" strokeWidth={1.8} /></div>
              <p className="xh-node-label">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex min-h-[3rem] items-center justify-center text-center" aria-live="off">
          <p key={active} className="text-sm text-white/75 sm:text-base" style={{ animation: 'xh-in .6s ease both' }}>
            <span className="mr-2 font-semibold text-[#3be7ae]">{HERO_NODES[active].label}.</span>{HERO_NODES[active].note}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ---------- Cinta de conceptos ---------- */
const MARQUEE_ITEMS = ['Gasto por categoría', 'Concentración de proveedores', 'Plan anual', 'RFx', 'NDA', 'Sala de ofertas', 'Evaluación', 'Comité', 'Adjudicación', 'Contrato', 'Vigencias y preaviso', 'Ahorro validado', 'Evidencia', 'Auditoría']
export function Marquee() {
  const row = MARQUEE_ITEMS.concat(MARQUEE_ITEMS)
  return (
    <div className="xh-fade-x overflow-hidden" aria-hidden>
      <div className="xh-marquee gap-3 py-2">
        {row.map((item, index) => (
          <span key={`${item}-${index}`} className="mr-3 inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3be7ae]" />{item}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---------- Texto que se enciende al desplazarse ---------- */
export function WordReveal({ parts, className }: { parts: { t: string; hi?: boolean }[]; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const words = parts.flatMap(part => part.t.split(' ').filter(Boolean).map(word => ({ word, hi: !!part.hi })))
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const spans = Array.from(el.querySelectorAll<HTMLElement>('[data-w]'))
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { spans.forEach(span => { span.style.opacity = '1' }); return }
    let frame = 0
    const update = () => {
      frame = 0
      const box = el.getBoundingClientRect()
      const vh = window.innerHeight
      const p = Math.min(1, Math.max(0, (vh * 0.88 - box.top) / (vh * 0.55 + box.height * 0.5)))
      spans.forEach((span, index) => {
        const v = Math.min(1, Math.max(0, p * spans.length * 1.2 - index))
        span.style.opacity = String(0.14 + 0.86 * v)
      })
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (frame) cancelAnimationFrame(frame) }
  }, [])
  return (
    <p ref={ref} className={className}>
      {words.map(({ word, hi }, index) => (
        <span key={index} data-w className={hi ? 'xh-grad' : ''} style={{ opacity: 0.14, transition: 'opacity .15s linear' }}>{word}{' '}</span>
      ))}
    </p>
  )
}

/* ---------- Intelligence: barras y dona que se dibujan ---------- */
const BARS = [
  { label: 'Mant.', h: 64 }, { label: 'Tecn.', h: 80, hot: true }, { label: 'Log.', h: 46 },
  { label: 'Mat.', h: 76 }, { label: 'Serv.', h: 38 }, { label: 'Equip.', h: 58 },
]
const DONUT = [
  { len: 150, off: 0, color: '#1f8f72' }, { len: 105, off: 156, color: '#3be7ae' }, { len: 66, off: 267, color: '#2ad4d2' },
]
export function SpendViz() {
  return (
    <div className="rv grid gap-5 lg:grid-cols-[1.35fr_1fr]">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-white p-6 shadow-[0_30px_80px_-40px_rgba(6,16,15,.45)] sm:p-8">
        <div className="mb-6 flex items-center justify-between text-sm">
          <span className="font-medium text-[#0b1918]">Gasto por categoría</span>
          <span className="rounded-full bg-[#e7f7f1] px-3 py-1 text-xs font-medium text-[#1f8f72]">CLP · USD por separado</span>
        </div>
        <div className="relative flex h-64 items-stretch gap-3 sm:gap-5">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-transparent via-[#3be7ae]/25 to-transparent xh-sweep" aria-hidden />
          {BARS.map((bar, index) => (
            <div key={bar.label} className="flex flex-1 flex-col">
              <div className="relative flex flex-1 items-end">
                {bar.hot && (
                  <span className="xh-pop absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#0b1918] px-3 py-1 text-[11px] font-medium text-[#3be7ae]" style={{ bottom: `calc(${bar.h}% + 10px)`, '--d': '1100ms' } as CSSProperties}>
                    Oportunidad de consolidar
                  </span>
                )}
                <div className="xh-bar w-full rounded-t-xl" style={{ height: `${bar.h}%`, '--d': `${index * 110}ms`, background: bar.hot ? 'linear-gradient(180deg,#3be7ae,#1f8f72)' : 'linear-gradient(180deg,#cfe3de,#a8c7bf)' } as CSSProperties} />
              </div>
              <span className="mt-2 text-center text-[11px] text-[#2d3e3d]/60">{bar.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-[#2d3e3d]/50">Ilustración con datos ficticios.</p>
      </div>

      <div className="rounded-[1.75rem] bg-[#0b1918] p-6 text-white shadow-[0_30px_80px_-40px_rgba(6,16,15,.6)] sm:p-8">
        <p className="text-sm font-medium">Concentración de proveedores</p>
        <div className="relative mx-auto mt-4 h-52 w-52">
          <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="80" cy="80" r="60" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="16" />
            {DONUT.map((seg, index) => (
              <circle key={seg.color} cx="80" cy="80" r="60" fill="none" stroke={seg.color} strokeWidth="16" strokeLinecap="round" className="xh-donut" strokeDashoffset={-seg.off} style={{ '--len': seg.len, '--d': `${index * 260}ms` } as CSSProperties} />
            ))}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div><p className="text-3xl font-semibold tracking-tight xh-grad">Alerta</p><p className="mt-1 text-xs text-white/55">cuando un proveedor<br />pesa demasiado</p></div>
          </div>
        </div>
        <ul className="mt-4 space-y-2 text-xs text-white/65">
          {['Proveedor A', 'Proveedor B', 'Resto'].map((name, index) => (
            <li key={name} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: DONUT[index].color }} />{name}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ---------- Sourcing: la línea de tiempo que se completa ---------- */
const SOURCING_STEPS = [
  { label: 'Iniciativa', text: 'Objetivo de ahorro separado del resultado.', Icon: Target },
  { label: 'RFx', text: 'Borrador hasta que el comprador publica las bases.', Icon: FileText },
  { label: 'Sala y NDA', text: 'Invitas, el proveedor acepta y envía su oferta.', Icon: Lock },
  { label: 'Evaluación', text: 'Criterios, puntajes y justificación a la vista.', Icon: Scale },
  { label: 'Comité', text: 'Votan personas distintas de quien compra.', Icon: Users },
  { label: 'Adjudicación', text: 'Recomendar no adjudica: decide el comité.', Icon: Award },
]
export function SourcingViz() {
  return (
    <div className="rv relative">
      <div className="pointer-events-none absolute left-[8.33%] right-[8.33%] top-[27px] hidden h-[3px] lg:block" aria-hidden>
        <div className="absolute inset-0 rounded-full bg-white/10" />
        <div className="xh-line-fill absolute inset-0 rounded-full bg-gradient-to-r from-[#3be7ae] via-[#2ad4d2] to-[#c6ff00]" />
      </div>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:gap-3">
        {SOURCING_STEPS.map(({ label, text, Icon }, index) => (
          <li key={label} className="xh-step xh-spot">
            <div className="relative mx-auto grid h-[54px] w-[54px] place-items-center rounded-[1.1rem] bg-gradient-to-br from-[#3be7ae] to-[#2ad4d2] text-[#06100f] shadow-[0_14px_40px_-10px_rgba(59,231,174,.7)]">
              <span className="xh-step-ring" style={{ '--d': `${index * 650}ms` } as CSSProperties} />
              <Icon className="h-6 w-6" strokeWidth={1.9} />
            </div>
            <p className="mt-4 text-xs font-semibold tracking-wide text-[#3be7ae]">0{index + 1}</p>
            <h3 className="mt-1 text-lg font-semibold">{label}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/60">{text}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ---------- Contracts: un documento que se lee solo ---------- */
export function ContractViz() {
  const lines = [88, 96, 72, 92, 60, 84, 94, 70]
  return (
    <div className="rv relative mx-auto w-full max-w-md" style={{ perspective: 1200 }}>
      <div className="relative rounded-[1.5rem] bg-white p-7 shadow-[0_40px_90px_-40px_rgba(6,16,15,.55)]" style={{ transform: 'rotateY(-7deg) rotateX(3deg)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><ModuleMark kind="contracts" size={28} /><span className="text-sm font-semibold text-[#0b1918]">Contrato de servicios</span></div>
          <span className="rounded-full bg-[#e7f7f1] px-2.5 py-1 text-[11px] font-medium text-[#1f8f72]">v2</span>
        </div>
        <div className="relative mt-6 space-y-3">
          <div className="xh-scan pointer-events-none absolute -inset-x-3 z-10 h-10 rounded-xl bg-gradient-to-b from-transparent via-[#3be7ae]/35 to-transparent" aria-hidden />
          {lines.map((width, index) => (
            <div key={index} className="relative">
              {index === 3 && <span className="xh-hl absolute -inset-x-2 -inset-y-1.5" aria-hidden />}
              <div className="relative h-2.5 rounded-full bg-[#d5e3df]" style={{ width: `${width}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-[#0b1918]/10 pt-4 text-xs text-[#2d3e3d]/70">
          <span>Cláusula 12.3 · Preaviso</span>
          <span className="inline-flex items-center gap-1 text-[#1f8f72]"><Check className="h-3.5 w-3.5" />Aprobado por otra persona</span>
        </div>
      </div>
      <div className="xh-float absolute -right-3 -top-5 sm:-right-8" aria-hidden>
        <div className="xh-pop rounded-2xl bg-[#0b1918] px-4 py-2.5 text-white shadow-xl" style={{ '--d': '600ms' } as CSSProperties}><p className="text-[10px] uppercase tracking-wider text-white/45">Preaviso</p><p className="text-sm font-semibold text-[#3be7ae]">60 días</p></div>
      </div>
      <div className="xh-float b absolute -left-3 top-1/2 sm:-left-12" aria-hidden>
        <div className="xh-pop rounded-2xl bg-[#0b1918] px-4 py-2.5 text-white shadow-xl" style={{ '--d': '900ms' } as CSSProperties}><p className="text-[10px] uppercase tracking-wider text-white/45">Monto adjudicado</p><p className="text-sm font-semibold text-[#3be7ae]">Heredado</p></div>
      </div>
      <div className="xh-float c absolute -bottom-7 left-10 sm:left-14" aria-hidden>
        <div className="xh-pop rounded-2xl bg-[#0b1918] px-4 py-2.5 text-white shadow-xl" style={{ '--d': '1200ms' } as CSSProperties}><p className="text-[10px] uppercase tracking-wider text-white/45">Versiones</p><p className="text-sm font-semibold text-[#3be7ae]">v1 → v2 comparadas</p></div>
      </div>
    </div>
  )
}

/* ---------- ANA: una conversación que se escribe sola ---------- */
const QA = [
  {
    q: '¿Qué proveedores concentran el gasto?',
    a: 'Dos proveedores reúnen más de la mitad del gasto de Mantenimiento. Hay espacio para consolidar. ¿Armo un borrador de iniciativa?',
    source: 'Gasto cargado · últimos 12 meses', action: 'Borrador de iniciativa · pendiente de tu confirmación',
  },
  {
    q: '¿Qué dice el contrato sobre el preaviso?',
    a: 'La cláusula 12.3 fija 60 días de preaviso para no renovar. Te sugiero revisarla con tu equipo legal.',
    source: 'Contrato · cláusula 12.3', action: 'Solo lectura · no modifica el contrato',
  },
  {
    q: '¿Cómo quedó la evaluación?',
    a: 'La oferta B lidera con 88 puntos. Recomendar no adjudica: la decisión es del comité.',
    source: 'Evaluación cerrada', action: 'Recomendación · la adjudicación es humana',
  },
]
export function AnaViz() {
  const reduced = useReducedMotion()
  const [ref, visible] = useInView<HTMLDivElement>(0.3)
  const [qi, setQi] = useState(0)
  const [phase, setPhase] = useState<'q' | 'think' | 'a' | 'done'>('q')
  const [n, setN] = useState(0)

  useEffect(() => {
    if (!visible || reduced) return
    const qa = QA[qi]
    let timer: ReturnType<typeof setTimeout>
    if (phase === 'q') {
      timer = n < qa.q.length ? setTimeout(() => setN(n + 1), 36) : setTimeout(() => { setPhase('think'); setN(0) }, 420)
    } else if (phase === 'think') {
      timer = setTimeout(() => { setPhase('a'); setN(0) }, 1000)
    } else if (phase === 'a') {
      timer = n < qa.a.length ? setTimeout(() => setN(Math.min(qa.a.length, n + 2)), 20) : setTimeout(() => setPhase('done'), 250)
    } else {
      timer = setTimeout(() => { setQi((qi + 1) % QA.length); setPhase('q'); setN(0) }, 4800)
    }
    return () => clearTimeout(timer)
  }, [visible, reduced, qi, phase, n])

  const qa = QA[reduced ? 0 : qi]
  const shownPhase = reduced ? 'done' : phase
  const question = shownPhase === 'q' ? qa.q.slice(0, n) : qa.q
  const answer = shownPhase === 'a' ? qa.a.slice(0, n) : qa.a

  return (
    <div ref={ref} className="rv xh-glass mx-auto w-full max-w-xl rounded-[2rem] p-5 sm:p-7">
      <div className="mb-5 flex items-center gap-3 border-b border-white/10 pb-4">
        <span className="xh-ping relative grid h-10 w-10 place-items-center rounded-full"><ModuleMark kind="ana" size={40} /></span>
        <div><p className="text-sm font-semibold">ANA</p><p className="text-xs text-white/50">Asistente de procurement · lee solo lo que tu usuario puede ver</p></div>
      </div>
      <div className="min-h-[19.5rem] space-y-4 text-[15px] leading-relaxed">
        <div className="ml-auto w-fit max-w-[85%] rounded-3xl rounded-br-lg bg-white/[0.12] px-4 py-3">
          <span className={shownPhase === 'q' ? 'xh-caret' : ''}>{question || '\u00A0'}</span>
        </div>
        {shownPhase !== 'q' && (
          <div className="max-w-[92%] rounded-3xl rounded-bl-lg border border-[#3be7ae]/25 bg-[#3be7ae]/[0.08] px-4 py-3">
            {shownPhase === 'think' ? <span className="xh-dots" aria-label="ANA está escribiendo"><span /><span /><span /></span> : <span className={shownPhase === 'a' ? 'xh-caret' : ''}>{answer}</span>}
          </div>
        )}
        {shownPhase === 'done' && (
          <div key={qi} className="in space-y-2">
            <div className="xh-pop inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1.5 text-xs text-white/70"><FileText className="h-3.5 w-3.5 text-[#3be7ae]" />Fuente: {qa.source}</div>
            <div className="xh-pop flex items-center gap-2 rounded-2xl border border-dashed border-[#c6ff00]/40 px-3 py-2 text-xs text-[#d9ff66]" style={{ '--d': '250ms' } as CSSProperties}><ShieldCheck className="h-3.5 w-3.5 shrink-0" />{qa.action}</div>
          </div>
        )}
      </div>
      <p className="mt-4 text-center text-[11px] text-white/35">Ejemplo ilustrativo con datos ficticios.</p>
    </div>
  )
}

/* ---------- Modularidad: enciende las piezas que necesitas ---------- */
const SCENARIOS: { key: string; label: string; text: string; lit: ModuleKind[] }[] = [
  { key: 'gasto', label: 'Solo el gasto', text: 'Una empresa parte por cargar y entender su spend, sin abrir una licitación.', lit: ['intelligence'] },
  { key: 'lic', label: 'Solo las licitaciones', text: 'Otra digitaliza invitaciones, ofertas y evaluación, y deja los contratos para después.', lit: ['sourcing'] },
  { key: 'con', label: 'Solo los contratos', text: 'Otra administra vigencias, versiones y aprobaciones de contratos que ya existen.', lit: ['contracts'] },
  { key: 'all', label: 'El proceso completo', text: 'Y otra recorre de la iniciativa a la adjudicación y al contrato, con el mismo expediente.', lit: ['intelligence', 'sourcing', 'contracts'] },
]
const MODULES: { kind: ModuleKind; name: string; line: string }[] = [
  { kind: 'intelligence', name: 'Intelligence', line: 'Gasto y oportunidades' },
  { kind: 'sourcing', name: 'Sourcing', line: 'Del plan a la adjudicación' },
  { kind: 'contracts', name: 'Contracts', line: 'Contratos y vigencias' },
]
export function ModularViz() {
  const [index, setIndex] = useState(3)
  const scenario = SCENARIOS[index]
  const on = (kind: ModuleKind) => scenario.lit.includes(kind)
  return (
    <div className="rv">
      <div role="tablist" aria-label="Cómo usar Xpend" className="mx-auto flex max-w-full flex-wrap justify-center gap-2">
        {SCENARIOS.map((item, i) => (
          <button key={item.key} role="tab" aria-selected={i === index} onClick={() => setIndex(i)}
            className={`rounded-full px-5 py-2.5 text-sm font-medium transition-all ${i === index ? 'bg-[#0b1918] text-white shadow-lg' : 'bg-white text-[#2d3e3d] hover:bg-[#e7f0ed]'}`}>{item.label}</button>
        ))}
      </div>
      <div className="mt-10 flex items-center">
        {MODULES.map(({ kind, name, line }, i) => (
          <div key={kind} className="flex flex-1 items-center last:flex-none">
            <div className={`flex w-28 flex-col items-center text-center transition-all duration-500 sm:w-40 ${on(kind) ? 'scale-100 opacity-100' : 'scale-90 opacity-40 grayscale'}`}>
              <div className={`rounded-[1.4rem] p-1 transition-shadow duration-500 ${on(kind) ? 'shadow-[0_20px_50px_-12px_rgba(59,231,174,.8)]' : ''}`}><ModuleMark kind={kind} size={64} /></div>
              <p className="mt-3 text-base font-semibold text-[#0b1918] sm:text-lg">{name}</p>
              <p className="mt-0.5 hidden text-xs text-[#2d3e3d]/60 sm:block">{line}</p>
            </div>
            {i < MODULES.length - 1 && <div className={`xh-link mx-1 sm:mx-3 ${on(kind) && on(MODULES[i + 1].kind) ? 'on' : ''}`} />}
          </div>
        ))}
      </div>
      <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-3 rounded-full border border-[#0b1918]/10 bg-white px-5 py-3 text-sm text-[#2d3e3d] shadow-sm">
        <ModuleMark kind="ana" size={26} /> ANA acompaña a las piezas que enciendas.
      </div>
      <p key={scenario.key} className="mx-auto mt-8 min-h-[3.5rem] max-w-xl text-center text-lg leading-snug text-[#0b1918]" style={{ animation: 'xh-in .5s ease both' }}>{scenario.text}</p>
    </div>
  )
}

/* ---------- Utilidad: tarjeta con icono ---------- */
export function IconCard({ icon, title, text, dark }: { icon: ReactNode; title: string; text: string; dark?: boolean }) {
  return (
    <article className={`xh-spot rv rounded-3xl p-6 transition-transform duration-300 hover:-translate-y-1 ${dark ? 'xh-glass' : 'border border-[#0b1918]/10 bg-white shadow-sm'}`}>
      <span className={`grid h-11 w-11 place-items-center rounded-2xl ${dark ? 'bg-white/10 text-[#3be7ae]' : 'bg-[#e7f7f1] text-[#1f8f72]'}`}>{icon}</span>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className={`mt-2 text-sm leading-relaxed ${dark ? 'text-white/65' : 'text-[#2d3e3d]/75'}`}>{text}</p>
    </article>
  )
}
