'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FilePlus2, Gavel, Scale, Search, X } from 'lucide-react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/ui/loading'
import { EmptyHint } from '@/components/workspace-blocks'
import { supabaseBrowser } from '@/lib/supabase'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { can } from '@/lib/navigation'
import {
  EMPTY_WORKSPACE,
  PROCESS_KIND_LABELS,
  buildProcesses,
  filterProcesses,
  loadWorkspaceRaw,
  type WorkspaceRaw,
} from '@/lib/workspace'
import { cn } from '@/lib/utils'

const ESTADO_ACTIVOS = 'activos'
const ESTADO_TODOS = 'todos'

export default function ProcesosPage() {
  const router = useRouter()
  const [session, setSession] = useState<AppSession | null>(null)
  const [raw, setRaw] = useState<WorkspaceRaw>(EMPTY_WORKSPACE)
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState('')
  const [estado, setEstado] = useState(ESTADO_ACTIVOS)
  const [mine, setMine] = useState(false)
  const [query, setQuery] = useState('')

  const params = useSearchParams()
  const paramsKey = params.toString()

  useEffect(() => {
    setKind(params.get('tipo') || '')
    setMine(params.get('mios') === '1')
    setQuery(params.get('q') || '')
    setEstado(params.get('estado') || (params.get('q') ? ESTADO_TODOS : ESTADO_ACTIVOS))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey])

  useEffect(() => {
    loadAppSession().then(async appSession => {
      if (!appSession) {
        router.replace('/login')
        return
      }
      if (appSession.role === 'supplier') {
        router.replace('/sala')
        return
      }
      setSession(appSession)
      if (appSession.companyId) {
        setRaw(await loadWorkspaceRaw(supabaseBrowser(), appSession.companyId, appSession.role))
      }
      setLoading(false)
    })
  }, [router])

  const all = useMemo(() => session ? buildProcesses(raw, session.userId, session.role) : [], [raw, session])
  const ofKind = useMemo(() => all.filter(item => !kind || item.kind === kind), [all, kind])
  const statusOptions = useMemo(() => Array.from(new Set(ofKind.map(item => item.statusLabel))).sort(), [ofKind])
  const visible = filterProcesses(all, {
    kind,
    mine,
    query,
    active: estado === ESTADO_ACTIVOS,
    statusLabel: estado !== ESTADO_ACTIVOS && estado !== ESTADO_TODOS ? estado : null,
  })

  if (loading || !session) return <MainLayout><LoadingSpinner /></MainLayout>

  const role = session.role
  const readOnly = role === 'viewer'
  const actions = [
    can(role, 'createRfx') && { href: '/rfx-maker/new', label: 'Preparar bases (RFx)', icon: FilePlus2 },
    can(role, 'createLicitacion') && { href: '/licitaciones/new', label: 'Nueva licitación', icon: Gavel },
    can(role, 'openSala') && { href: '/sala/new', label: 'Abrir sala de ofertas', icon: Scale },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Gavel }[]

  return (
    <MainLayout user={{ name: session.name, email: session.email, role: session.role }} companyName={session.companyName}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1>Procesos</h1>
            <p className="mt-1 max-w-2xl text-[13px] text-petrol-blue/75">
              Todas las RFx, licitaciones y salas de ofertas en un solo lugar, con el siguiente paso. Para trabajar un tipo por separado usa las pestañas de arriba.
            </p>
          </div>
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {actions.map((action, index) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-medium transition-colors',
                    index === 0 ? 'bg-petrol-blue text-white hover:bg-petrol-blue/90' : 'border border-petrol-blue/15 bg-white/70 text-petrol-blue hover:bg-white'
                  )}
                >
                  <action.icon className="h-3.5 w-3.5" aria-hidden />
                  {action.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-petrol-blue/75" aria-hidden />
                <Input
                  aria-label="Buscar por nombre o código"
                  placeholder="Buscar por nombre o código"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  className="rounded-full pl-9"
                />
              </div>
              <label className="flex items-center gap-2 text-[12.5px] text-petrol-blue/70">
                <input type="checkbox" checked={mine} onChange={event => setMine(event.target.checked)} />
                Solo donde soy responsable
              </label>
              <label className="flex items-center gap-2 text-[12.5px] text-petrol-blue/80">
                Estado
                <select
                  aria-label="Estado"
                  value={estado}
                  onChange={event => setEstado(event.target.value)}
                  className="rounded-full border border-petrol-blue/20 bg-white/70 px-3 py-1.5 text-[12.5px] text-petrol-blue"
                >
                  <option value={ESTADO_ACTIVOS}>Activos (en curso)</option>
                  <option value={ESTADO_TODOS}>Todos, incluso cerrados</option>
                  {statusOptions.map(label => (
                    <option key={label} value={label}>Solo: {label}</option>
                  ))}
                </select>
              </label>
            </div>
            {kind && (
              <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-petrol-blue/80">
                Mostrando solo
                <button
                  type="button"
                  onClick={() => router.replace('/procesos')}
                  className="flex items-center gap-1 rounded-full border border-petrol-blue/20 bg-white/70 px-3 py-1 font-medium text-petrol-blue hover:bg-white"
                  aria-label={`Quitar el filtro de tipo ${PROCESS_KIND_LABELS[kind as keyof typeof PROCESS_KIND_LABELS] || kind}`}
                >
                  {PROCESS_KIND_LABELS[kind as keyof typeof PROCESS_KIND_LABELS] || kind}
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </p>
            )}
          </CardContent>
        </Card>

        {visible.length === 0 ? (
          <EmptyHint>
            {all.length === 0
              ? <>Todavía no hay procesos. {actions[0] ? <Link href={actions[0].href} className="font-medium underline">{actions[0].label}</Link> : 'Cuando un comprador o gerente cree uno, aparecerá aquí.'}</>
              : 'Ningún proceso coincide con estos filtros.'}
          </EmptyHint>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-petrol-blue/[0.06]">
                {visible.map(item => (
                  <li key={`${item.kind}-${item.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-petrol-blue/[0.06] px-2 py-0.5 text-[12px] font-medium text-petrol-blue/70">{PROCESS_KIND_LABELS[item.kind]}</span>
                        <span className="text-[12px] text-petrol-blue/75">{item.statusLabel}</span>
                        {item.mine && <span className="rounded-full bg-accent-mint/30 px-2 py-0.5 text-[12px] text-petrol-blue">Responsable</span>}
                      </div>
                      <Link href={item.href} className="mt-1 block truncate text-[14px] font-medium text-petrol-blue hover:underline">{item.title}</Link>
                      {!readOnly && <p className="text-[12.5px] text-petrol-blue/80">{item.reason}</p>}
                      {item.next.note && !readOnly && <p className="text-[12px] text-petrol-blue/75">{item.next.note}</p>}
                    </div>
                    {!readOnly && item.next.href && (
                      <Link
                        href={item.next.href}
                        className="shrink-0 rounded-full border border-petrol-blue/15 bg-white/70 px-3 py-1.5 text-[12px] font-medium text-petrol-blue hover:bg-white"
                      >
                        {item.next.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

      </div>
    </MainLayout>
  )
}
