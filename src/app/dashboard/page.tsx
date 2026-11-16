'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, ChevronRight, FilePlus2, FileText, FolderPlus, Gavel, Scale, Upload } from 'lucide-react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { BlockCard, EmptyHint, ItemList, Metric, QuickAction, type BlockItem } from '@/components/workspace-blocks'
import { supabaseBrowser } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { describeSpendSource, type SpendSourceInfo } from '@/lib/spend-sources'
import { can, roleLabel } from '@/lib/navigation'
import {
  SAVINGS_LABELS,
  loadPlanSavingsLinks,
  realizedSavingsLabel,
  savingsByCurrency,
  validatedSavingsLabel,
  type CurrencySavings,
} from '@/lib/procurement-flow'
import {
  EMPTY_WORKSPACE,
  PROCESS_KIND_LABELS,
  approvals,
  areaSummary,
  buildProcesses,
  continueWhereLeft,
  contractsForMe,
  loadWorkspaceRaw,
  myInitiatives,
  needsAttention,
  pendingActions,
  stageCounts,
  upcomingDates,
  type WorkspaceRaw,
} from '@/lib/workspace'

type Viewer = { id: string; name: string; email: string; role: string; companyId: string | null }

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function InicioPage() {
  const router = useRouter()
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [companyName, setCompanyName] = useState<string>()
  const [raw, setRaw] = useState<WorkspaceRaw>(EMPTY_WORKSPACE)
  const [planSavings, setPlanSavings] = useState<CurrencySavings[] | null>(null)
  const [spend, setSpend] = useState<SpendSourceInfo | null>(null)
  const [healthIssues, setHealthIssues] = useState<{ title: string; detail: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = supabaseBrowser()
      let { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        await new Promise(resolve => setTimeout(resolve, 150))
        ;({ data: { session } } = await supabase.auth.getSession())
      }
      if (!session?.user) {
        router.replace('/login')
        return
      }
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, role, company_id')
        .eq('id', session.user.id)
        .single()
      if (profileError || !profile) throw new Error('No encontramos tu perfil.')
      if (profile.role === 'supplier') {
        router.replace('/sala')
        return
      }
      const nextViewer = {
        id: profile.id,
        name: profile.full_name || session.user.email || '',
        email: session.user.email || '',
        role: profile.role,
        companyId: profile.company_id,
      }
      setViewer(nextViewer)
      if (!profile.company_id) {
        setLoading(false)
        return
      }

      const year = new Date().getFullYear()
      const [company, workspace, source, planRows] = await Promise.all([
        supabase.from('companies').select('name').eq('id', profile.company_id).single(),
        loadWorkspaceRaw(supabase, profile.company_id, profile.role),
        can(profile.role, 'readSpend') ? describeSpendSource(supabase, profile.company_id) : Promise.resolve(null),
        can(profile.role, 'approve')
          ? supabase.from('sourcing_plans')
              .select('id, currency, projected_savings_amount, actual_savings_amount, status')
              .eq('company_id', profile.company_id)
              .eq('plan_year', year)
          : Promise.resolve(null),
      ])
      setCompanyName(company.data?.name)
      setRaw(workspace)
      setSpend(source)
      if (planRows && !planRows.error) {
        const rows = planRows.data || []
        const links = await loadPlanSavingsLinks(supabase, rows.map(row => row.id))
        setPlanSavings(savingsByCurrency(rows, links))
      }
      if (can(profile.role, 'administer')) {
        fetch('/api/health/integrations')
          .then(response => response.json())
          .then(body => setHealthIssues((body.issues || []).filter((issue: { level?: string }) => issue.level === 'blocker')))
          .catch(() => setHealthIssues([]))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar tu inicio.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const layoutUser = viewer ? { name: viewer.name, email: viewer.email, role: viewer.role } : undefined

  if (loading) {
    return <MainLayout user={layoutUser} companyName={companyName}><LoadingSpinner /></MainLayout>
  }
  if (error || !viewer) {
    return (
      <MainLayout user={layoutUser} companyName={companyName}>
        <ErrorMessage title="No se pudo cargar tu inicio" message={error || 'Sesión no disponible'} onRetry={load} />
      </MainLayout>
    )
  }
  if (!viewer.companyId) {
    return (
      <MainLayout user={layoutUser}>
        <EmptyHint>Tu usuario todavía no está asociado a una empresa. Pide a un administrador que te agregue.</EmptyHint>
      </MainLayout>
    )
  }

  const role = viewer.role
  const me = viewer.id
  const supervisor = can(role, 'approve')
  const readOnly = role === 'viewer'
  const processes = buildProcesses(raw, me, role)
  const mineActive = processes.filter(item => item.mine && item.active)
  const companyActive = processes.filter(item => item.active)
  const continueItem = readOnly ? null : continueWhereLeft(raw, me, role)
  const stages = stageCounts(raw, me, role)
  const summary = areaSummary(raw)
  const toDo = readOnly ? [] : pendingActions(raw, me, role)
  const toApprove = approvals(raw, me, role)
  const attention = supervisor ? needsAttention(raw, me, role) : []
  const initiatives = myInitiatives(raw, me, role)
  const dates = upcomingDates(raw, { me, onlyMine: !supervisor && !readOnly })
  const myContracts = can(role, 'readContracts') && !supervisor ? contractsForMe(raw, me) : []
  const firstName = viewer.name.split(/[\s@]/)[0]
  const noData = processes.length === 0 && raw.plans.length === 0

  const processItems = (list: typeof processes): BlockItem[] => list.map(item => ({
    id: `${item.kind}-${item.id}`,
    title: item.title,
    detail: `${PROCESS_KIND_LABELS[item.kind]} · ${item.statusLabel}`,
    href: readOnly ? item.href : item.next.href || item.href,
    cta: readOnly ? 'Ver' : item.next.label,
    note: readOnly ? undefined : item.next.note,
  }))

  const quickActions = [
    can(role, 'createInitiative') && { href: '/sourcing-plan/new', icon: FolderPlus, label: 'Nueva iniciativa', hint: 'Agrégala al plan de abastecimiento' },
    can(role, 'createRfx') && { href: '/rfx-maker/new', icon: FilePlus2, label: 'Preparar bases (RFx)', hint: 'Requerimientos, criterios y documentos' },
    can(role, 'createLicitacion') && { href: '/licitaciones/new', icon: Gavel, label: 'Nueva licitación', hint: 'Publica bases e invita proveedores' },
    can(role, 'openSala') && { href: '/sala/new', icon: Scale, label: 'Abrir sala de ofertas', hint: 'Sobre cerrado, rondas o subasta' },
    can(role, 'writeContracts') && { href: '/contratos/nuevo', icon: Upload, label: 'Cargar contrato', hint: 'Sube un contrato y revisa su ficha' },
  ].filter(Boolean) as { href: string; icon: typeof Gavel; label: string; hint: string }[]

  const subtitle = readOnly
    ? 'Tu perfil es de consulta: puedes revisar procesos, plan y proveedores, pero no crear ni aprobar.'
    : supervisor
      ? 'Lo que está pasando en abastecimiento y lo que espera tu aprobación.'
      : 'Lo que tienes abierto, lo que requiere tu acción y cómo seguir.'

  return (
    <MainLayout user={layoutUser} companyName={companyName}>
      <div className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-petrol-blue/45">
              {roleLabel(role)}{companyName ? ` · ${companyName}` : ''}
            </p>
            <h1 className="mt-1">Hola, {firstName}</h1>
            <p className="mt-1 max-w-2xl text-[13px] text-petrol-blue/60">{subtitle}</p>
          </div>
        </header>

        {healthIssues.length > 0 && (
          <BlockCard title="Para que funcione" description="Piezas que hay que corregir antes de confiar en la operación.">
            <ItemList items={healthIssues.map(issue => ({ id: issue.title, title: issue.title, detail: issue.detail }))} empty="" />
          </BlockCard>
        )}

        {continueItem && (
          <Link
            href={continueItem.href}
            className="glass-card flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-accent-mint p-4 hover:-translate-y-0.5"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-petrol-blue/45">Continuar donde quedaste</p>
              <p className="truncate text-[15px] font-medium text-petrol-blue">{continueItem.title}</p>
              <p className="text-[12px] text-petrol-blue/55">{continueItem.detail}</p>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-petrol-blue px-4 py-2 text-[12.5px] font-medium text-white">
              {continueItem.cta}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </Link>
        )}

        {quickActions.length > 0 && (
          <section aria-labelledby="acciones-rapidas" className="space-y-2">
            <h2 id="acciones-rapidas" className="text-[13px] font-medium text-petrol-blue/70">Comenzar algo nuevo</h2>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
              {quickActions.slice(0, 4).map((action, index) => (
                <QuickAction key={action.href} {...action} primary={index === 0} />
              ))}
            </div>
            {!can(role, 'createLicitacion') && (
              <p className="text-[12px] text-petrol-blue/50">
                Las iniciativas, licitaciones y salas de ofertas las crea un gerente o administrador. Tú puedes preparar las bases y los contratos.
              </p>
            )}
          </section>
        )}

        {noData && (
          <BlockCard title="Primeros pasos con XPEND" description="Tres módulos, un mismo hilo: del gasto a la adjudicación y el contrato.">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { title: 'Entender el gasto', text: 'Carga tu gasto, clasifícalo por categoría y descubre oportunidades.', href: can(role, 'readSpend') ? '/sourcing-intelligence' : null },
                { title: 'Abastecer', text: 'Convierte una oportunidad en iniciativa, prepara bases, licita y adjudica.', href: '/sourcing-plan' },
                { title: 'Formalizar', text: 'Guarda contratos, revisa versiones y controla vencimientos.', href: can(role, 'readContracts') ? '/contratos' : null },
              ].map(step => (
                <div key={step.title} className="glass-chip p-4">
                  <p className="text-[13.5px] font-medium text-petrol-blue">{step.title}</p>
                  <p className="mt-1 text-[12px] text-petrol-blue/60">{step.text}</p>
                  {step.href && <Link href={step.href} className="mt-2 inline-block text-[12px] font-medium text-petrol-blue underline">Ir</Link>}
                </div>
              ))}
            </div>
          </BlockCard>
        )}

        {(supervisor || readOnly) && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label={`Iniciativas abiertas ${summary.year}`} value={summary.openInitiatives} hint={`${summary.completedInitiatives} completadas`} href="/sourcing-plan" />
            <Metric label="Procesos activos" value={summary.activeProcesses} hint="RFx, licitaciones y salas" href="/procesos" />
            {supervisor ? (
              <Metric label="Aprobaciones pendientes" value={toApprove.length} hint="Bases, adjudicaciones y contratos" />
            ) : (
              <Metric label="Adjudicaciones registradas" value={raw.awards.length} href="/adjudicaciones" />
            )}
            {can(role, 'readContracts') ? (
              <Metric label="Contratos en preparación" value={summary.contractsInReview} hint="Borradores y en revisión" href="/contratos?vista=pendientes" />
            ) : (
              <Metric label="Próximas fechas" value={dates.length} hint="En los próximos 45 días" />
            )}
          </div>
        )}

        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[13px] font-medium text-petrol-blue/70">Cómo avanza el abastecimiento en tu empresa</h2>
              <p className="text-[11.5px] text-petrol-blue/45">Cada paso se puede usar por separado. Los números son registros activos en esa etapa.</p>
            </div>
            <ol className="flex gap-1 overflow-x-auto pb-1">
              {stages.map((stage, index) => (
                <li key={stage.id} className="flex items-center gap-1">
                  {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-petrol-blue/25" aria-hidden />}
                  {stage.count === null ? (
                    <div className="flex min-w-[96px] flex-col rounded-xl border border-dashed border-petrol-blue/15 px-3 py-2">
                      <span className="text-[11.5px] text-petrol-blue/55">{stage.label}</span>
                      <span className="text-[12px] leading-[27px] text-petrol-blue/45">Sin acceso</span>
                    </div>
                  ) : (
                    <Link
                      href={stage.href}
                      className="flex min-w-[96px] flex-col rounded-xl border border-white/70 bg-white/55 px-3 py-2 transition-colors hover:bg-white/85"
                    >
                      <span className="text-[11.5px] text-petrol-blue/55">{stage.label}</span>
                      <span className="text-[18px] font-medium text-petrol-blue">{stage.count}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {supervisor && (
            <BlockCard title="Aprobaciones pendientes" description="Bases por publicar, decisiones del comité y versiones de contrato.">
              <ItemList items={toApprove} empty="No hay aprobaciones pendientes." />
            </BlockCard>
          )}
          {supervisor && (
            <BlockCard title="Requieren atención" description="Procesos detenidos e iniciativas sin responsable o sin proceso." action={{ label: 'Ver plan', href: '/sourcing-plan' }}>
              <ItemList items={attention} empty="Nada detenido. Todas las iniciativas abiertas tienen responsable y proceso." />
            </BlockCard>
          )}

          {!readOnly && (
            <BlockCard title={supervisor ? 'Tus pendientes' : 'Requiere tu acción'} description="Calculado con el estado actual de tus procesos, iniciativas y contratos.">
              <ItemList items={toDo} empty="No tienes acciones pendientes. Revisa tus procesos activos o comienza algo nuevo." />
            </BlockCard>
          )}

          <BlockCard
            title={readOnly ? 'Procesos activos de la empresa' : 'Mis procesos activos'}
            description={readOnly ? 'RFx, licitaciones y salas en curso.' : 'RFx, licitaciones y salas donde eres responsable.'}
            action={{ label: 'Ver todos', href: readOnly ? '/procesos' : '/procesos?mios=1' }}
          >
            <ItemList
              items={processItems(readOnly ? companyActive : mineActive)}
              empty={readOnly ? 'No hay procesos activos.' : 'No eres responsable de procesos activos.'}
            />
          </BlockCard>

          {!readOnly && (
            <BlockCard title="Mis iniciativas asignadas" description="Iniciativas abiertas del plan donde figuras como responsable." action={{ label: 'Plan de abastecimiento', href: '/sourcing-plan' }}>
              <ItemList
                items={initiatives.map(item => ({ id: item.id, title: item.title, detail: item.detail, href: item.next.href, cta: item.next.label }))}
                empty="No tienes iniciativas asignadas. Un gerente puede asignarte una desde el plan."
              />
            </BlockCard>
          )}

          <BlockCard
            title="Próximas fechas"
            description={`Fechas cargadas en licitaciones, salas, contratos e iniciativas${supervisor || readOnly ? '' : ' tuyas'}, próximos 45 días.`}
          >
            <ItemList
              items={dates.map(item => ({ id: item.id, title: `${formatDate(item.date)} · ${item.label}`, detail: item.title, href: item.href }))}
              empty="No hay fechas próximas cargadas. Los hitos del plan con fecha comprometida llegarán en una etapa posterior."
              limit={8}
            />
          </BlockCard>

          {can(role, 'readContracts') && !supervisor && (
            <BlockCard title="Contratos que requieren tu atención" description="Tus borradores, revisiones y vencimientos en 90 días." action={{ label: 'Repositorio', href: '/contratos' }}>
              <ItemList items={myContracts} empty="No tienes contratos pendientes." />
            </BlockCard>
          )}

          {supervisor && planSavings && (
            <BlockCard title={`Plan de abastecimiento ${summary.year}`} description="Ahorros por moneda, sin conversión." action={{ label: 'Abrir plan', href: '/sourcing-plan' }}>
              {planSavings.length === 0 ? (
                <EmptyHint>{SAVINGS_LABELS.noInfo}. Todavía no hay iniciativas con montos este año.</EmptyHint>
              ) : (
                <div className="space-y-3">
                  {planSavings.map(row => (
                    <div key={row.currency} className="grid grid-cols-3 gap-2 text-[12px]">
                      <div className="glass-chip p-3">
                        <p className="text-petrol-blue/55">{SAVINGS_LABELS.target}</p>
                        <p className="mt-1 text-[14px] font-medium text-petrol-blue">{row.target != null ? formatCurrency(row.target, row.currency) : SAVINGS_LABELS.noInfo}</p>
                      </div>
                      <div className="glass-chip p-3">
                        <p className="text-petrol-blue/55">{SAVINGS_LABELS.negotiated}</p>
                        <p className="mt-1 text-[14px] font-medium text-petrol-blue">{row.negotiated != null ? formatCurrency(row.negotiated, row.currency) : SAVINGS_LABELS.noInfo}</p>
                        <p className="text-[10.5px] text-petrol-blue/45">{validatedSavingsLabel(row.negotiated != null)}</p>
                      </div>
                      <div className="glass-chip p-3">
                        <p className="text-petrol-blue/55">{SAVINGS_LABELS.realized}</p>
                        <p className="mt-1 text-[14px] font-medium text-petrol-blue/60">{realizedSavingsLabel()}</p>
                        <p className="text-[10.5px] text-petrol-blue/45">Aún no se mide</p>
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-petrol-blue/45">El objetivo es una meta, no un resultado. El negociado sale de las adjudicaciones del comité.</p>
                </div>
              )}
            </BlockCard>
          )}

          {spend && (
            <BlockCard title="Gasto" description={spend.label} action={{ label: 'Resumen y análisis', href: '/spend' }}>
              {spend.needsReview > 0 ? (
                <ItemList
                  items={[{ id: 'review', title: `${spend.needsReview} líneas de gasto sin clasificar`, detail: 'Clasificarlas mejora el análisis y las oportunidades.', href: '/sourcing-intelligence/validacion', cta: 'Revisar' }]}
                  empty=""
                />
              ) : spend.active === 'none' ? (
                <EmptyHint>
                  Todavía no hay gasto cargado.{' '}
                  {can(role, 'manageSpend') && <Link href="/sourcing-intelligence/upload" className="font-medium underline">Cargar gasto</Link>}
                </EmptyHint>
              ) : (
                <EmptyHint>Todo el gasto cargado está clasificado. <Link href="/oportunidades" className="font-medium underline">Ver oportunidades</Link></EmptyHint>
              )}
            </BlockCard>
          )}

          {can(role, 'administer') && (
            <BlockCard title="Administración" description="Usuarios, roles y configuración de la empresa.">
              <div className="flex flex-wrap gap-2">
                {[
                  ['Usuarios', '/users'],
                  ['Roles y permisos', '/administracion/roles'],
                  ['Configuración', '/settings'],
                ].map(([label, href]) => (
                  <Link key={href} href={href} className="rounded-full border border-petrol-blue/15 bg-white/70 px-3 py-1.5 text-[12.5px] font-medium text-petrol-blue hover:bg-white">{label}</Link>
                ))}
              </div>
            </BlockCard>
          )}
        </div>

        <BlockCard title="Dónde encontrar cada cosa">
          <div className="grid gap-2 text-[12.5px] sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Bases, ofertas y evaluaciones', href: '/procesos', hint: 'Abastecimiento → Procesos' },
              { label: 'Resultados de adjudicación', href: '/adjudicaciones', hint: 'Abastecimiento → Adjudicaciones' },
              can(role, 'readContracts') && { label: 'Contratos y versiones', href: '/contratos', hint: 'Contratos → Repositorio' },
              { label: 'Exportaciones en CSV', href: '/reports', hint: 'Abastecimiento → Reportes' },
            ].filter(Boolean).map(entry => {
              const item = entry as { label: string; href: string; hint: string }
              return (
                <Link key={item.href} href={item.href} className="glass-chip flex items-center gap-2 p-3 hover:bg-white/70">
                  <FileText className="h-4 w-4 shrink-0 text-petrol-blue/50" aria-hidden />
                  <span>
                    <span className="block font-medium text-petrol-blue">{item.label}</span>
                    <span className="block text-[11px] text-petrol-blue/50">{item.hint}</span>
                  </span>
                </Link>
              )
            })}
          </div>
          <p className="mt-3 text-[11.5px] text-petrol-blue/45">¿Dudas? ANA, el asistente, está disponible abajo a la derecha en todas las pantallas.</p>
        </BlockCard>
      </div>
    </MainLayout>
  )
}
