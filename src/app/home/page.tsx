'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Menu, X } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { supabaseBrowser } from '@/lib/supabase'

const nav = [
  { href: '#inteligencia', label: 'Intelligence' },
  { href: '#sourcing', label: 'Sourcing' },
  { href: '#contratos', label: 'Contracts' },
  { href: '#ana', label: 'ANA' },
  { href: '#modularidad', label: 'Modularidad' },
]

const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL?.trim() || ''

export default function PublicHomePage() {
  const [open, setOpen] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    supabaseBrowser().auth.getSession().then(({ data }) => setAuthenticated(!!data.session))
  }, [])

  const enterHref = authenticated ? '/dashboard' : '/login'

  return (
    <div className="min-h-screen bg-[#e7eeec] text-[#2D3E3D]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#2D3E3D]/95 pt-[env(safe-area-inset-top)] text-white backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="/" aria-label="Xpend, inicio">
            <Logo size="md" variant="white" />
          </a>
          <nav className="hidden items-center gap-6 text-sm md:flex" aria-label="Secciones">
            {nav.map(item => (
              <a key={item.href} href={item.href} className="text-white/85 hover:text-[#3BE7AE]">{item.label}</a>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <a href={enterHref} className="text-sm text-white/85 hover:text-white">{authenticated ? 'Ir a la plataforma' : 'Iniciar sesión'}</a>
            <a href="#demo" className="rounded-full bg-[#3BE7AE] px-4 py-2 text-sm font-medium text-[#1a2625]">Solicitar una demo</a>
          </div>
          <button type="button" className="md:hidden" aria-expanded={open} aria-label={open ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setOpen(value => !value)}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {open && (
          <nav className="space-y-1 border-t border-white/10 px-4 py-3 md:hidden" aria-label="Secciones">
            {nav.map(item => (
              <a key={item.href} href={item.href} className="block py-2 text-sm" onClick={() => setOpen(false)}>{item.label}</a>
            ))}
            <a href={enterHref} className="block py-2 text-sm" onClick={() => setOpen(false)}>{authenticated ? 'Ir a la plataforma' : 'Iniciar sesión'}</a>
            <a href="#demo" className="block py-2 text-sm text-[#3BE7AE]" onClick={() => setOpen(false)}>Solicitar una demo</a>
          </nav>
        )}
      </header>

      <main>
        <section className="bg-[#1a2625] text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-[#3BE7AE]">Procurement para equipos medianos</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">Abastecimiento más inteligente. Menos complejidad.</h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">Planifica, licita, evalúa y gestiona contratos desde una plataforma modular, con inteligencia artificial que trabaja junto a tu equipo.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#demo" className="inline-flex items-center rounded-full bg-[#C6FF00] px-5 py-3 text-sm font-medium text-[#1a2625]">Solicitar una demo <ArrowRight className="ml-2 h-4 w-4" /></a>
                <a href="#modulos" className="inline-flex items-center rounded-full border border-white/25 px-5 py-3 text-sm text-white">Ver los módulos</a>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5" aria-hidden>
              <p className="text-xs uppercase tracking-wider text-white/50">Un proceso, tres entradas</p>
              <div className="mt-4 space-y-3">
                {[
                  ['Intelligence', 'Gasto, categorías y oportunidades'],
                  ['Sourcing', 'Del plan a la adjudicación'],
                  ['Contracts', 'Contratos, versiones y vigencia'],
                ].map(([title, detail]) => (
                  <div key={title} className="rounded-2xl bg-[#2D3E3D] px-4 py-3">
                    <p className="font-medium text-[#3BE7AE]">{title}</p>
                    <p className="text-sm text-white/75">{detail}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-white/70">ANA recorre los tres. Una persona confirma lo que se guarda.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="problemas">
          <h2 id="problemas" className="text-3xl font-semibold">El trabajo de abastecimiento no debería vivir en archivos sueltos.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ['El gasto no llega a una decisión', 'Las planillas muestran montos, pero cuesta ver categorías, proveedores y dónde concentrar el próximo proceso.'],
              ['Cada licitación empieza de cero', 'La iniciativa, las bases, las ofertas y el comité quedan en correos distintos. El expediente se arma a mano.'],
              ['El contrato queda desconectado', 'Lo adjudicado y lo firmado no siempre coinciden, y encontrar una vigencia o un preaviso toma una relectura completa.'],
            ].map(([title, text]) => (
              <article key={title} className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="text-lg font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#2D3E3D]/80">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="modulos" className="bg-white">
          <div className="mx-auto max-w-6xl space-y-16 px-4 py-16 sm:px-6">
            <article id="inteligencia">
              <p className="text-sm font-medium text-[#1f8f72]">XPEND Intelligence</p>
              <h2 className="mt-2 text-3xl font-semibold">Del gasto cargado a una decisión de abastecimiento.</h2>
              <p className="mt-3 max-w-3xl text-[#2D3E3D]/80">Sube un Excel o CSV, revisa categorías y proveedores, y detecta concentración u oportunidades de consolidación. ANA puede leer ese gasto cuando está cargado. Si no hay líneas, lo dice: no completa cifras.</p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {['Carga y análisis de gasto, sin mezclar monedas.', 'Visibilidad por categoría y proveedor.', 'Concentración y oportunidades de consolidación.', 'ANA apoya la lectura. No reemplaza la confirmación del equipo.'].map(item => (
                  <li key={item} className="rounded-xl bg-[#e7eeec] px-4 py-3 text-sm">{item}</li>
                ))}
              </ul>
            </article>

            <article id="sourcing">
              <p className="text-sm font-medium text-[#1f8f72]">XPEND Sourcing</p>
              <h2 className="mt-2 text-3xl font-semibold">Del plan a la adjudicación, en un solo expediente.</h2>
              <p className="mt-3 max-w-3xl text-[#2D3E3D]/80">Sourcing no es una lista de herramientas sueltas. La iniciativa abre el RFx, la licitación invita proveedores, la sala recibe propuestas, la evaluación compara y el comité adjudica. El hilo queda en el expediente.</p>
              <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {['Plan de iniciativas, con objetivo de ahorro separado del resultado.', 'RFx en borrador hasta que el comprador completa y publica las bases.', 'Invitación, NDA cuando corresponde, y recepción de ofertas.', 'Evaluación, comité y adjudicación. Recomendar no adjudica.'].map((item, index) => (
                  <li key={item} className="rounded-xl border border-[#2D3E3D]/10 p-4 text-sm"><span className="mb-2 block text-xs font-medium text-[#1f8f72]">0{index + 1}</span>{item}</li>
                ))}
              </ol>
            </article>

            <article id="contratos">
              <p className="text-sm font-medium text-[#1f8f72]">XPEND Contracts</p>
              <h2 className="mt-2 text-3xl font-semibold">Administra contratos que ya tienes, o arma el que sigue a una adjudicación.</h2>
              <p className="mt-3 max-w-3xl text-[#2D3E3D]/80">Contracts funciona solo o conectado al proceso. Puedes cargar un PDF o DOCX, buscar condiciones en el texto, comparar versiones y aprobar con una persona distinta de quien redactó. Si vienes de una licitación, el borrador hereda el monto adjudicado.</p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {['Carga, búsqueda y comparación de contratos existentes.', 'Plantillas, cláusulas, versiones y devolución con observaciones.', 'Generación desde una adjudicación autorizada.', 'Exportación DOCX y PDF de la versión aprobada.'].map(item => (
                  <li key={item} className="rounded-xl bg-[#e7eeec] px-4 py-3 text-sm">{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section id="ana" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="rounded-3xl bg-[#2D3E3D] px-6 py-10 text-white sm:px-10">
            <p className="text-sm font-medium text-[#3BE7AE]">ANA</p>
            <h2 className="mt-2 text-3xl font-semibold">Tu asistente de procurement, dentro del registro que estás viendo.</h2>
            <p className="mt-4 max-w-3xl text-white/80">ANA ayuda a leer gasto, preparar un borrador de RFx, entender una evaluación ya abierta y revisar cláusulas de un contrato. Cita la fuente. Si el dato no está, lo dice. Lo que propone queda en borrador hasta que una persona lo confirma.</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {['Analiza datos y documentos autorizados para tu usuario.', 'Prepara borradores. No publica bases ni adjudica.', 'No aprueba ni firma un contrato.', 'Si el cupo de Groq se agota, no reintenta sin límite ni inventa la respuesta.'].map(item => (
                <li key={item} className="rounded-xl bg-white/5 px-4 py-3 text-sm text-white/85">{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section id="modularidad" className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-semibold">Empieza con lo que necesitas. Conecta todo cuando quieras.</h2>
            <p className="mt-3 max-w-3xl text-[#2D3E3D]/80">XPEND no es un ERP. Cada módulo se usa por su cuenta y, cuando el equipo lo decide, el expediente une gasto, proceso y contrato.</p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {[
                ['Solo el gasto', 'Una empresa parte por cargar y entender su spend, sin abrir una licitación.'],
                ['Solo las licitaciones', 'Otra digitaliza invitaciones, ofertas y evaluación, y deja los contratos para después.'],
                ['Solo los contratos', 'Otra administra vigencias, versiones y aprobaciones de contratos que ya existen.'],
                ['El proceso completo', 'Y otra recorre de la iniciativa a la adjudicación y al contrato, con el mismo expediente.'],
              ].map(([title, text]) => (
                <article key={title} className="rounded-2xl border border-[#2D3E3D]/10 p-5">
                  <h3 className="text-lg font-medium">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#2D3E3D]/80">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="como">
          <h2 id="como" className="text-3xl font-semibold">Cómo se trabaja en Xpend</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-4">
            {[
              ['Entras al módulo que necesitas', 'Gasto, una iniciativa, una licitación o un contrato.'],
              ['El expediente guarda el hilo', 'Lo que se decide queda asociado al proceso, no en un archivo paralelo.'],
              ['ANA propone con evidencia', 'La respuesta muestra de dónde salió. No ejecuta la decisión.'],
              ['Una persona aprueba', 'Publicar, adjudicar o aprobar un contrato sigue siendo una acción humana.'],
            ].map(([title, text], index) => (
              <li key={title} className="rounded-2xl bg-white p-5">
                <span className="text-sm font-medium text-[#1f8f72]">{index + 1}</span>
                <h3 className="mt-2 font-medium">{title}</h3>
                <p className="mt-2 text-sm text-[#2D3E3D]/80">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="para-quien" className="bg-[#2D3E3D] text-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-semibold">Para equipos de abastecimiento que no quieren una suite imposible de implementar.</h2>
            <p className="mt-3 max-w-3xl text-white/75">Xpend está pensado para empresas medianas y en crecimiento. Profesionaliza la gestión con herramientas modulares, sin exigir un gran equipo de tecnología ni reemplazar el ERP.</p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {['Gerencias y equipos de Abastecimiento.', 'Compradores y especialistas de sourcing.', 'Responsables de contratos.', 'Finanzas y Operaciones que necesitan ver el proceso.', 'Empresas que parten por un módulo y conectan el resto después.'].map(item => (
                <li key={item} className="rounded-xl bg-white/5 px-4 py-3 text-sm text-white/85">{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section id="demo" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="rounded-3xl bg-white px-6 py-10 sm:px-10">
            <h2 className="text-3xl font-semibold">Solicitar una demo</h2>
            {demoEmail ? (
              <>
                <p className="mt-3 max-w-2xl text-[#2D3E3D]/80">Escribe a {demoEmail}. El mensaje sale desde tu correo. Xpend no guarda la solicitud en la plataforma.</p>
                <a href={`mailto:${demoEmail}?subject=${encodeURIComponent('Demo de Xpend')}`} className="mt-6 inline-flex items-center rounded-full bg-[#2D3E3D] px-5 py-3 text-sm font-medium text-white">Escribir para una demo <ArrowRight className="ml-2 h-4 w-4" /></a>
              </>
            ) : (
              <>
                <p className="mt-3 max-w-2xl text-[#2D3E3D]/80">El buzón de solicitudes todavía no está conectado, así que esta página no simula un envío. Si ya tienes cuenta, entra a la plataforma. Para habilitar la demo, configura el correo público de contacto.</p>
                <a href={enterHref} className="mt-6 inline-flex items-center rounded-full bg-[#2D3E3D] px-5 py-3 text-sm font-medium text-white">{authenticated ? 'Ir a la plataforma' : 'Iniciar sesión'} <ArrowRight className="ml-2 h-4 w-4" /></a>
              </>
            )}
          </div>
        </section>
      </main>

      <footer className="bg-[#1a2625] px-4 py-12 text-white sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Logo size="sm" variant="white" />
            <p className="mt-4 max-w-md text-sm text-white/70">Plataforma modular de abastecimiento. Intelligence, Sourcing y Contracts, con ANA como apoyo del equipo.</p>
          </div>
          <div className="text-sm text-white/70">
            <a href={enterHref} className="block hover:text-[#3BE7AE]">{authenticated ? 'Ir a la plataforma' : 'Iniciar sesión'}</a>
            <a href="#demo" className="mt-2 block hover:text-[#3BE7AE]">Solicitar una demo</a>
            <p className="mt-4">© 2026 Xpend™. Marca en trámite INAPI.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
