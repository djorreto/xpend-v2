'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowRight, Building2, Check, FileSpreadsheet, Layers, Lock, Mail, Menu, Puzzle, ScrollText, Search, ShieldCheck, Sparkles, Users, Wallet, X,
} from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { supabaseBrowser } from '@/lib/supabase'
import {
  AnaViz, ContractViz, HeroStage, IconCard, Marquee, ModularViz, ModuleMark, SourcingViz, SpendViz, WordReveal, useHomeEffects, type ModuleKind,
} from './home-visuals'

const nav = [
  { href: '#inteligencia', label: 'Intelligence' },
  { href: '#sourcing', label: 'Sourcing' },
  { href: '#contratos', label: 'Contracts' },
  { href: '#ana', label: 'ANA' },
  { href: '#modularidad', label: 'Modular' },
]

const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL?.trim() || ''

function Head({ kind, label, title, children, dark, center }: { kind: ModuleKind; label: string; title: ReactNode; children?: ReactNode; dark?: boolean; center?: boolean }) {
  return (
    <div className={`rv ${center ? 'mx-auto text-center' : ''} max-w-4xl`}>
      <div className={`flex items-center gap-3 ${center ? 'justify-center' : ''}`}>
        <ModuleMark kind={kind} size={36} />
        <span className={`xh-kicker ${dark ? 'text-[#3be7ae]' : 'text-[#1f8f72]'}`}>{label}</span>
      </div>
      <h2 className={`mt-5 text-[clamp(2.3rem,5.8vw,4.6rem)] font-semibold leading-[1.02] ${dark ? '' : 'text-[#0b1918]'}`}>{title}</h2>
      {children && <p className={`mt-5 max-w-2xl text-lg leading-relaxed ${center ? 'mx-auto' : ''} ${dark ? 'text-white/70' : 'text-[#2d3e3d]/80'}`}>{children}</p>}
    </div>
  )
}

function Checks({ items, dark }: { items: string[]; dark?: boolean }) {
  return (
    <ul className="mt-8 grid gap-3 sm:grid-cols-2">
      {items.map((item, index) => (
        <li key={item} className="rv flex items-start gap-3 text-[15px] leading-snug" style={{ '--d': `${index * 90}ms` } as React.CSSProperties}>
          <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${dark ? 'bg-[#3be7ae]/20 text-[#3be7ae]' : 'bg-[#1f8f72]/15 text-[#1f8f72]'}`}><Check className="h-3 w-3" strokeWidth={3} /></span>
          <span className={dark ? 'text-white/80' : 'text-[#2d3e3d]'}>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function PublicHomePage() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useHomeEffects(rootRef)

  useEffect(() => {
    supabaseBrowser().auth.getSession().then(({ data }) => setAuthenticated(!!data.session))
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const enterHref = authenticated ? '/dashboard' : '/login'
  const enterLabel = authenticated ? 'Ir a la plataforma' : 'Iniciar sesión'

  return (
    <div ref={rootRef} className="xh min-h-screen scroll-smooth">
      <header className={`fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)] transition-all duration-500 ${scrolled || open ? 'border-b border-white/10 bg-[#06100f]/70 backdrop-blur-xl' : 'border-b border-transparent'}`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="/" aria-label="Xpend, inicio"><Logo size="md" variant="white" /></a>
          <nav className="hidden items-center gap-8 text-sm md:flex" aria-label="Secciones">
            {nav.map(item => <a key={item.href} href={item.href} className="text-white/70 transition-colors hover:text-white">{item.label}</a>)}
          </nav>
          <div className="hidden items-center gap-4 md:flex">
            <a href={enterHref} className="text-sm text-white/70 transition-colors hover:text-white">{enterLabel}</a>
            <a href="#demo" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#06100f] transition-transform hover:scale-105">Solicitar una demo</a>
          </div>
          <button type="button" className="md:hidden" aria-expanded={open} aria-label={open ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setOpen(value => !value)}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {open && (
          <nav className="space-y-1 border-t border-white/10 px-4 py-3 md:hidden" aria-label="Secciones">
            {nav.map(item => <a key={item.href} href={item.href} className="block py-2 text-sm" onClick={() => setOpen(false)}>{item.label}</a>)}
            <a href={enterHref} className="block py-2 text-sm" onClick={() => setOpen(false)}>{enterLabel}</a>
            <a href="#demo" className="block py-2 text-sm text-[#3be7ae]" onClick={() => setOpen(false)}>Solicitar una demo</a>
          </nav>
        )}
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="relative isolate overflow-hidden pb-16 pt-32 text-center sm:pt-40">
          <div className="xh-aurora" aria-hidden><i /><i /><i /></div>
          <div className="xh-grid" aria-hidden />
          <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
            <p className="rv xh-glass mx-auto inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-xs font-medium text-white/80">
              <span className="xh-ping relative h-2 w-2 rounded-full bg-[#3be7ae]" />Presentamos Xpend
            </p>
            <h1 className="rv mt-7 text-[clamp(3.4rem,11vw,8.5rem)] font-semibold leading-[0.95]" style={{ '--d': '100ms' } as React.CSSProperties}>
              Compra con<br /><span className="xh-grad">claridad.</span>
            </h1>
            <p className="rv mx-auto mt-7 max-w-2xl text-xl font-medium text-white/90 sm:text-2xl" style={{ '--d': '200ms' } as React.CSSProperties}>Abastecimiento más inteligente. Menos complejidad.</p>
            <p className="rv mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg" style={{ '--d': '280ms' } as React.CSSProperties}>
              Planifica, licita, evalúa y gestiona contratos desde una plataforma modular, con inteligencia artificial que trabaja junto a tu equipo.
            </p>
            <div className="rv mt-9 flex flex-wrap items-center justify-center gap-3" style={{ '--d': '360ms' } as React.CSSProperties}>
              <a href="#demo" className="xh-btn xh-btn-primary">Solicitar una demo <ArrowRight className="h-4 w-4" /></a>
              <a href="#proceso" className="xh-btn xh-btn-ghost">Ver cómo funciona</a>
            </div>
          </div>
          <div id="proceso" />
          <HeroStage />
          <div className="mt-14"><Marquee /></div>
        </section>

        {/* ---------- El problema ---------- */}
        <section className="relative bg-[#06100f] px-4 py-28 sm:px-6 sm:py-40" aria-labelledby="problemas">
          <div className="mx-auto max-w-5xl">
            <h2 id="problemas" className="sr-only">El trabajo de abastecimiento no debería vivir en archivos sueltos.</h2>
            <WordReveal className="text-[clamp(2rem,5.4vw,4.4rem)] font-semibold leading-[1.08] tracking-[-0.035em]"
              parts={[{ t: 'Planillas. Correos. PDFs. El abastecimiento se pierde entre archivos sueltos.' }, { t: 'Xpend lo reúne en un solo hilo.', hi: true }]} />
          </div>
          <div className="mx-auto mt-20 grid max-w-6xl gap-5 md:grid-cols-3">
            <IconCard dark icon={<FileSpreadsheet className="h-5 w-5" />} title="El gasto no llega a una decisión" text="Las planillas muestran montos, pero cuesta ver categorías, proveedores y dónde concentrar el próximo proceso." />
            <IconCard dark icon={<Mail className="h-5 w-5" />} title="Cada licitación empieza de cero" text="La iniciativa, las bases, las ofertas y el comité quedan en correos distintos. El expediente se arma a mano." />
            <IconCard dark icon={<ScrollText className="h-5 w-5" />} title="El contrato queda desconectado" text="Lo adjudicado y lo firmado no siempre coinciden, y encontrar una vigencia o un preaviso toma una relectura completa." />
          </div>
        </section>

        {/* ---------- Intelligence ---------- */}
        <section id="inteligencia" className="bg-[#f4f7f6] px-4 py-24 text-[#0b1918] sm:px-6 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <Head kind="intelligence" label="XPEND Intelligence" title={<>Tu gasto tiene<br /><span className="xh-grad-dark">algo que decir.</span></>}>
              Sube un Excel o CSV, revisa categorías y proveedores, y detecta concentración u oportunidades de consolidación. ANA puede leer ese gasto cuando está cargado. Si no hay líneas, lo dice: no completa cifras.
            </Head>
            <div className="mt-14"><SpendViz /></div>
            <Checks items={['Carga y análisis de gasto, sin mezclar monedas.', 'Visibilidad por categoría y proveedor.', 'Concentración y oportunidades de consolidación.', 'ANA apoya la lectura. No reemplaza la confirmación del equipo.']} />
          </div>
        </section>

        {/* ---------- Sourcing ---------- */}
        <section id="sourcing" className="relative overflow-hidden bg-[#06100f] px-4 py-24 sm:px-6 sm:py-32">
          <div className="xh-aurora opacity-50" aria-hidden><i /><i /></div>
          <div className="relative mx-auto max-w-6xl">
            <Head dark kind="sourcing" label="XPEND Sourcing" title={<>De la idea a la adjudicación.<br /><span className="xh-grad">Sin perder el hilo.</span></>}>
              Sourcing no es una lista de herramientas sueltas. La iniciativa abre el RFx, la licitación invita proveedores, la sala recibe propuestas, la evaluación compara y el comité adjudica. El hilo queda en el expediente.
            </Head>
            <div className="mt-16"><SourcingViz /></div>
          </div>
        </section>

        {/* ---------- Contracts ---------- */}
        <section id="contratos" className="bg-[#f4f7f6] px-4 py-24 text-[#0b1918] sm:px-6 sm:py-32">
          <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
            <div>
              <Head kind="contracts" label="XPEND Contracts" title={<>El contrato, a una <span className="xh-grad-dark">búsqueda</span> de distancia.</>}>
                Administra los contratos que ya tienes, o arma el que sigue a una adjudicación. Carga un PDF o DOCX, busca condiciones en el texto, compara versiones y aprueba con una persona distinta de quien redactó. Si vienes de una licitación, el borrador hereda el monto adjudicado.
              </Head>
              <Checks items={['Carga, búsqueda y comparación de contratos existentes.', 'Plantillas, cláusulas, versiones y devolución con observaciones.', 'Generación desde una adjudicación autorizada.', 'Exportación DOCX y PDF de la versión aprobada.']} />
            </div>
            <ContractViz />
          </div>
        </section>

        {/* ---------- ANA ---------- */}
        <section id="ana" className="relative overflow-hidden bg-[#06100f] px-4 py-24 sm:px-6 sm:py-32">
          <div className="xh-aurora opacity-60" aria-hidden><i /><i /><i /></div>
          <div className="relative mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1fr_1.05fr]">
            <div>
              <Head dark kind="ana" label="ANA" title={<>Conoce a ANA.<br /><span className="xh-grad">Lee, cita, propone.</span><br />Tú decides.</>}>
                Tu asistente de procurement, dentro del registro que estás viendo. Ayuda a leer gasto, preparar un borrador de RFx, entender una evaluación ya abierta y revisar cláusulas de un contrato. Cita la fuente. Si el dato no está, lo dice.
              </Head>
              <Checks dark items={['Analiza datos y documentos autorizados para tu usuario.', 'Prepara borradores. No publica bases ni adjudica.', 'No aprueba ni firma un contrato.', 'Si el cupo de Groq se agota, no reintenta sin límite ni inventa la respuesta.']} />
            </div>
            <AnaViz />
          </div>
        </section>

        {/* ---------- Gobierno humano ---------- */}
        <section className="relative bg-gradient-to-b from-[#06100f] to-[#0b1918] px-4 pb-28 pt-12 sm:px-6 sm:pb-40">
          <div className="mx-auto max-w-5xl">
            <WordReveal className="text-[clamp(2.2rem,6vw,5rem)] font-semibold leading-[1.04] tracking-[-0.04em]"
              parts={[{ t: 'La IA propone.' }, { t: 'Las personas deciden.', hi: true }, { t: 'Publicar, adjudicar o aprobar un contrato sigue siendo una acción humana.' }]} />
          </div>
          <div className="mx-auto mt-20 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <IconCard dark icon={<Layers className="h-5 w-5" />} title="Entras al módulo que necesitas" text="Gasto, una iniciativa, una licitación o un contrato." />
            <IconCard dark icon={<Lock className="h-5 w-5" />} title="El expediente guarda el hilo" text="Lo que se decide queda asociado al proceso, no en un archivo paralelo." />
            <IconCard dark icon={<Sparkles className="h-5 w-5" />} title="ANA propone con evidencia" text="La respuesta muestra de dónde salió. No ejecuta la decisión." />
            <IconCard dark icon={<ShieldCheck className="h-5 w-5" />} title="Una persona aprueba" text="Publicar, adjudicar o aprobar un contrato sigue siendo una acción humana." />
          </div>
        </section>

        {/* ---------- Modularidad ---------- */}
        <section id="modularidad" className="bg-[#f4f7f6] px-4 py-24 text-[#0b1918] sm:px-6 sm:py-32">
          <div className="mx-auto max-w-5xl">
            <div className="rv text-center">
              <h2 className="text-[clamp(2.3rem,5.8vw,4.6rem)] font-semibold leading-[1.02]">Empieza con lo que necesitas.<br /><span className="xh-grad-dark">Conecta todo cuando quieras.</span></h2>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#2d3e3d]/80">Xpend no es un ERP. Cada módulo se usa por su cuenta y, cuando el equipo lo decide, el expediente une gasto, proceso y contrato.</p>
            </div>
            <div className="mt-14"><ModularViz /></div>
          </div>
        </section>

        {/* ---------- Para quién ---------- */}
        <section id="para-quien" className="bg-[#06100f] px-4 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="rv max-w-4xl">
              <h2 className="text-[clamp(2.2rem,5.4vw,4.4rem)] font-semibold leading-[1.04]">Para equipos que no quieren<br /><span className="xh-grad">una suite imposible.</span></h2>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/65">Xpend está pensado para empresas medianas y en crecimiento. Profesionaliza la gestión con herramientas modulares, sin exigir un gran equipo de tecnología ni reemplazar el ERP.</p>
            </div>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <IconCard dark icon={<Building2 className="h-5 w-5" />} title="Gerencias de Abastecimiento" text="Ven el plan, los procesos y el ahorro de todo el equipo en un lugar." />
              <IconCard dark icon={<Search className="h-5 w-5" />} title="Compradores y sourcing" text="Llevan cada proceso, del RFx a la adjudicación, sin armar el expediente a mano." />
              <IconCard dark icon={<ScrollText className="h-5 w-5" />} title="Responsables de contratos" text="Encuentran vigencias, versiones y preavisos sin releer el documento." />
              <IconCard dark icon={<Wallet className="h-5 w-5" />} title="Finanzas y Operaciones" text="Siguen el proceso y el ahorro validado, con la evidencia a mano." />
              <IconCard dark icon={<Puzzle className="h-5 w-5" />} title="Empresas que parten por un módulo" text="Empiezan por el gasto, las licitaciones o los contratos y conectan el resto después." />
              <IconCard dark icon={<Users className="h-5 w-5" />} title="Equipos con roles claros" text="Quien compra, quien aprueba y quien consulta ven y hacen lo que les corresponde." />
            </div>
          </div>
        </section>

        {/* ---------- Demo ---------- */}
        <section id="demo" className="relative isolate overflow-hidden px-4 py-28 text-center sm:px-6 sm:py-40">
          <div className="xh-aurora" aria-hidden><i /><i /><i /></div>
          <div className="relative mx-auto max-w-3xl">
            <h2 className="rv text-[clamp(2.6rem,7vw,5.6rem)] font-semibold leading-[1]">Mira Xpend<br /><span className="xh-grad">en acción.</span></h2>
            {demoEmail ? (
              <>
                <p className="rv mx-auto mt-6 max-w-xl text-lg text-white/70">Escribe a {demoEmail}. El mensaje sale desde tu correo. Xpend no guarda la solicitud en la plataforma.</p>
                <div className="rv mt-9"><a href={`mailto:${demoEmail}?subject=${encodeURIComponent('Demo de Xpend')}`} className="xh-btn xh-btn-primary">Escribir para una demo <ArrowRight className="h-4 w-4" /></a></div>
              </>
            ) : (
              <>
                <p className="rv mx-auto mt-6 max-w-xl text-lg text-white/70">El buzón de solicitudes todavía no está conectado, así que esta página no simula un envío. Si ya tienes cuenta, entra a la plataforma. Para habilitar la demo, configura el correo público de contacto.</p>
                <div className="rv mt-9"><a href={enterHref} className="xh-btn xh-btn-primary">{enterLabel} <ArrowRight className="h-4 w-4" /></a></div>
              </>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#06100f] px-4 py-12 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Logo size="sm" variant="white" className="-ml-3" />
            <p className="mt-4 max-w-md text-sm text-white/60">Plataforma modular de abastecimiento. Intelligence, Sourcing y Contracts, con ANA como apoyo del equipo.</p>
          </div>
          <div className="text-sm text-white/60">
            <a href={enterHref} className="block transition-colors hover:text-[#3be7ae]">{enterLabel}</a>
            <a href="#demo" className="mt-2 block transition-colors hover:text-[#3be7ae]">Solicitar una demo</a>
            <p className="mt-4">© 2026 Xpend™. Marca en trámite INAPI.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
