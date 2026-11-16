'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading'
import { BlockCard, EmptyHint } from '@/components/workspace-blocks'
import { fmtDate } from '@/components/milestones-panel'
import { supabaseBrowser } from '@/lib/supabase'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { can } from '@/lib/navigation'
import { formatCurrency } from '@/lib/utils'
import { loadPortfolio, personName, type PortfolioData } from '@/lib/portfolio-data'
import { loadSavings, type AwardRow, type ManualCandidate, type SavingsBundle, type ValidationRow } from '@/lib/savings-data'
import { SAVINGS_TEXT, canValidate, describeNature, netRecognized, pendingDeclarations, summarizeSavings, type Nature, type Recurrence, type SavingsRow } from '@/lib/savings'
import { savingsEvidencePath } from '@/lib/storage-paths'

const FIELD = 'h-9 rounded-xl border border-petrol-blue/15 bg-white/80 px-3 text-[13px] text-petrol-blue'
const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'declarar', label: 'Por declarar' },
  { id: 'validar', label: 'Por validar' },
  { id: 'validados', label: 'Validados y reconocidos' },
  { id: 'auditoria', label: 'Auditoría' },
] as const
type TabId = (typeof TABS)[number]['id']

const EVENT_LABEL: Record<string, string> = {
  declared: 'Declarado',
  validated: 'Validado',
  returned: 'Devuelto',
  withdrawn: 'Retirado',
  evidence_added: 'Evidencia agregada',
  recognized: 'Reconocido',
  reversed: 'Reversado',
}

type DeclareTarget = { award?: AwardRow; manual?: ManualCandidate; negotiated: number; currency: string; title: string; planId?: string | null }
type Message = { kind: 'ok' | 'error'; text: string }

function money(value: number | null | undefined, currency: string, empty: string = SAVINGS_TEXT.noInfo) {
  return value == null ? empty : formatCurrency(value, currency)
}

function Tile({ label, tag, children }: { label: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-petrol-blue/10 bg-white/70 p-3">
      <p className="flex items-center justify-between gap-2 text-[12px] font-medium text-petrol-blue/75">
        {label}
        {tag && <span className="rounded-full bg-petrol-blue/[0.06] px-2 py-0.5 text-[10.5px] uppercase tracking-wide">{tag}</span>}
      </p>
      <div className="mt-1.5 text-[1.05rem] font-medium tracking-tight text-petrol-blue">{children}</div>
    </div>
  )
}

export default function AhorrosPage() {
  const router = useRouter()
  const [session, setSession] = useState<AppSession | null>(null)
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null)
  const [bundle, setBundle] = useState<SavingsBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [tab, setTab] = useState<TabId>('resumen')
  const [message, setMessage] = useState<Message | null>(null)
  const [personFilter, setPersonFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [declaring, setDeclaring] = useState<DeclareTarget | null>(null)
  const [focusAward, setFocusAward] = useState<string | null>(null)

  const refresh = useCallback(async (appSession: AppSession, selectedYear: number) => {
    const supabase = supabaseBrowser()
    const companyId = appSession.companyId as string
    const portfolioData = await loadPortfolio(supabase, companyId)
    const data = await loadSavings(supabase, companyId, selectedYear, { withEvidence: appSession.role !== 'viewer', assignments: portfolioData.assignments })
    setPortfolio(portfolioData)
    setBundle(data)
  }, [])

  useEffect(() => {
    loadAppSession().then(async appSession => {
      if (!appSession) return router.replace('/login')
      if (appSession.role === 'supplier') return router.replace('/sala')
      setSession(appSession)
      if (appSession.companyId) await refresh(appSession, year)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Enlace desde Adjudicaciones: /ahorros?award=<id> abre la pestaña con esa adjudicación.
  useEffect(() => {
    const award = new URLSearchParams(window.location.search).get('award')
    if (award) {
      setFocusAward(award)
      setTab('declarar')
    }
  }, [])

  const scope = useMemo(() => ({ categoryId: categoryFilter || undefined, ownerId: personFilter || undefined, teamId: teamFilter || undefined }), [categoryFilter, personFilter, teamFilter])
  const summary = useMemo(
    () => (bundle ? summarizeSavings({ year, awards: bundle.awards, validations: bundle.validations, recognitions: bundle.recognitions, targets: bundle.targets, scope }) : []),
    [bundle, year, scope]
  )

  if (loading || !session || !portfolio || !bundle) return <MainLayout><LoadingSpinner /></MainLayout>
  const layoutUser = { name: session.name, email: session.email, role: session.role }
  const supabase = supabaseBrowser()
  const person = (id: string | null | undefined) => personName(portfolio.people.find(item => item.id === id))
  const categoryName = (id: string | null) => portfolio.categories.find(category => category.id === id)?.name || 'Sin categoría'
  const canDeclare = can(session.role, 'declareSavings')
  const canValidateRole = can(session.role, 'validateSavings')
  const isViewer = session.role === 'viewer'

  const run = async (action: PromiseLike<{ error: { message: string } | null }>, success: string) => {
    const { error } = await action
    if (error) setMessage({ kind: 'error', text: error.message })
    else {
      setMessage({ kind: 'ok', text: success })
      await refresh(session, year)
    }
    return !error
  }

  const pending = pendingDeclarations(bundle.awards, bundle.validations)
    .map(item => ({ ...item, award: bundle.awards.find(award => award.id === item.awardId) as AwardRow }))
    .filter(item => session.role !== 'analyst' || item.award.owner_user_id === session.userId || item.award.backup_user_id === session.userId)
    .filter(item => (!categoryFilter || item.award.category_id === categoryFilter) && (!personFilter || item.award.owner_user_id === personFilter) && (!teamFilter || item.award.team_id === teamFilter))
  const manual = session.role === 'analyst' ? [] : bundle.manual
  const inScopeValidation = (validation: ValidationRow) => (!categoryFilter || validation.category_id === categoryFilter) && (!personFilter || validation.owner_user_id === personFilter) && (!teamFilter || validation.team_id === teamFilter)
  const toValidate = bundle.validations.filter(item => (item.status === 'declared' || item.status === 'returned') && inScopeValidation(item))
  const validated = bundle.validations.filter(item => item.status === 'validated' && inScopeValidation(item))

  const startDeclaring = (target: DeclareTarget) => {
    setDeclaring(target)
    setTab('declarar')
    setMessage(null)
  }

  return (
    <MainLayout user={layoutUser} companyName={session.companyName}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1>Control de ahorros</h1>
            <p className="mt-1 max-w-3xl text-[13px] text-petrol-blue/75">
              Cinco conceptos que no se mezclan: línea base documentada, meta, negociado, validado y realizado. Adjudicar no valida ni realiza un ahorro: lo declara el responsable,
              lo valida otra persona con su metodología, y el realizado se reconoce mes a mes con evidencia. Cada moneda se muestra por separado, sin conversión.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[12px] font-medium text-petrol-blue/80" htmlFor="anio-ahorros">Año</label>
            <select id="anio-ahorros" className={FIELD} value={year} onChange={async event => { const next = Number(event.target.value); setYear(next); await refresh(session, next) }}>
              {Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - 2 + index).map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <select aria-label="Persona" className={`${FIELD} h-8`} value={personFilter} onChange={event => setPersonFilter(event.target.value)}>
            <option value="">Todas las personas</option>
            {portfolio.people.map(item => <option key={item.id} value={item.id}>{personName(item)}</option>)}
          </select>
          <select aria-label="Equipo" className={`${FIELD} h-8`} value={teamFilter} onChange={event => setTeamFilter(event.target.value)}>
            <option value="">Todos los equipos</option>
            {portfolio.teams.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select aria-label="Categoría" className={`${FIELD} h-8`} value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
            <option value="">Todas las categorías</option>
            {portfolio.categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>

        {message && <p role="status" className={`rounded-xl px-3 py-2 text-[13px] ${message.kind === 'ok' ? 'bg-accent-mint/30 text-petrol-blue' : 'bg-red-50 text-red-800'}`}>{message.text}</p>}

        <div role="tablist" className="flex flex-wrap gap-1.5">
          {TABS.filter(item => !(isViewer && item.id === 'auditoria')).map(item => {
            const count = item.id === 'declarar' ? pending.length + manual.length : item.id === 'validar' ? toValidate.length : null
            return (
              <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${tab === item.id ? 'bg-petrol-blue text-white' : 'border border-petrol-blue/15 bg-white/70 text-petrol-blue hover:bg-white'}`}>
                {item.label}{count != null && count > 0 ? ` (${count})` : ''}
              </button>
            )
          })}
        </div>

        {tab === 'resumen' && <Summary rows={summary} year={year} />}

        {tab === 'declarar' && (
          <div className="space-y-4">
            {declaring && (
              <DeclareForm
                key={declaring.award?.id || declaring.manual?.licitacion_id}
                target={declaring}
                onCancel={() => setDeclaring(null)}
                onSubmit={async values => {
                  const ok = await run(
                    supabase.rpc('declare_savings', {
                      p_award: declaring.award?.id ?? null,
                      p_licitacion: declaring.manual?.licitacion_id ?? null,
                      p_plan: null,
                      p_declared: values.declared,
                      p_nature: values.nature,
                      p_recurrence: values.recurrence,
                      p_start: values.start,
                      p_end: values.recurrence === 'recurrente' ? values.end : null,
                      p_note: values.note || null,
                    }),
                    'Ahorro declarado. Ahora lo valida otra persona.'
                  )
                  if (ok) setDeclaring(null)
                }}
              />
            )}
            <BlockCard title={`Adjudicaciones sin declarar (${pending.length})`} description="Ahorro negociado comparable que aún no se declaró. Declarar no lo valida ni lo realiza.">
              {!canDeclare ? (
                <EmptyHint>Tu perfil puede consultar el control de ahorros, pero no declarar.</EmptyHint>
              ) : pending.length === 0 ? (
                <EmptyHint>No hay adjudicaciones con ahorro negociado pendientes de declarar.</EmptyHint>
              ) : (
                <ul className="divide-y divide-petrol-blue/[0.06]" data-testid="pendientes-declarar">
                  {pending.map(item => (
                    <li key={item.awardId} className={`flex flex-wrap items-center justify-between gap-3 py-3 ${focusAward === item.awardId ? 'rounded-xl bg-accent-mint/20 px-2' : ''}`}>
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-petrol-blue">{item.award.licitacion_name || item.licitacionId || 'Adjudicación'}</p>
                        <p className="text-[12px] text-petrol-blue/75">
                          {item.award.supplier_name || 'Proveedor'} · {categoryName(item.award.category_id ?? null)} · {person(item.award.owner_user_id)} · negociado {formatCurrency(item.negotiated, item.currency)} · {fmtDate(item.awardedAt)}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => startDeclaring({ award: item.award, negotiated: item.negotiated, currency: item.currency, title: item.award.licitacion_name || item.licitacionId || 'Adjudicación' })}>Declarar ahorro</Button>
                    </li>
                  ))}
                </ul>
              )}
            </BlockCard>
            {manual.length > 0 && canDeclare && (
              <BlockCard title={`Ahorros manuales sin adjudicación de comité (${manual.length})`} description={`${SAVINGS_TEXT.manual}. Se declaran igual y se marcan como manuales en toda la vista.`}>
                <ul className="divide-y divide-petrol-blue/[0.06]">
                  {manual.map(item => (
                    <li key={item.licitacion_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-[14px] font-medium text-petrol-blue">{item.name}</p>
                        <p className="text-[12px] text-petrol-blue/75">Base {formatCurrency(item.baseline, item.currency)} · adjudicado {formatCurrency(item.awarded, item.currency)} · negociado {formatCurrency(item.baseline - item.awarded, item.currency)}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => startDeclaring({ manual: item, negotiated: item.baseline - item.awarded, currency: item.currency, title: item.name })}>Declarar como manual</Button>
                    </li>
                  ))}
                </ul>
              </BlockCard>
            )}
          </div>
        )}

        {tab === 'validar' && (
          <BlockCard title={`Declaraciones por revisar (${toValidate.length})`} description="Quien declara no valida. La validación exige una metodología escrita y no puede superar lo declarado.">
            {toValidate.length === 0 ? (
              <EmptyHint>No hay declaraciones pendientes.</EmptyHint>
            ) : (
              <ul className="space-y-3" data-testid="por-validar">
                {toValidate.map(item => (
                  <ValidateCard
                    key={item.id}
                    validation={item}
                    session={session}
                    declaredBy={person(item.declared_by)}
                    category={categoryName(item.category_id)}
                    owner={person(item.owner_user_id)}
                    allowValidate={canValidate(item, session.userId, session.role)}
                    canManage={canValidateRole}
                    onValidate={(amount, method, note) => run(supabase.rpc('validate_savings', { p_validation: item.id, p_validated: amount, p_method: method, p_note: note || null }), 'Ahorro validado.')}
                    onReturn={note => run(supabase.rpc('return_savings', { p_validation: item.id, p_note: note }), 'Declaración devuelta con comentario.')}
                    onWithdraw={note => run(supabase.rpc('withdraw_savings', { p_validation: item.id, p_note: note }), 'Declaración retirada.')}
                    onRedeclare={() => {
                      const award = bundle.awards.find(candidate => candidate.id === item.award_id)
                      const manualItem = bundle.manual.find(candidate => candidate.licitacion_id === item.licitacion_id)
                      const negotiated = Math.max(item.baseline_amount - item.awarded_amount, 0)
                      startDeclaring({ award, manual: award ? undefined : manualItem || { licitacion_id: item.licitacion_id || '', name: item.licitacion_name || '', currency: item.currency, baseline: item.baseline_amount, awarded: item.awarded_amount }, negotiated, currency: item.currency, title: item.licitacion_name || 'Declaración devuelta' })
                    }}
                  />
                ))}
              </ul>
            )}
          </BlockCard>
        )}

        {tab === 'validados' && (
          <div className="space-y-3" data-testid="validados">
            {validated.length === 0 ? (
              <EmptyHint>Todavía no hay ahorros validados.</EmptyHint>
            ) : (
              validated.map(item => (
                <ValidatedCard
                  key={item.id}
                  validation={item}
                  bundle={bundle}
                  session={session}
                  person={person}
                  category={categoryName(item.category_id)}
                  canManage={canValidateRole}
                  hideEvidence={isViewer}
                  onUpload={async (file, description) => {
                    let path = ''
                    try {
                      path = savingsEvidencePath(session.companyId as string, item.id, file.name)
                    } catch (error) {
                      setMessage({ kind: 'error', text: (error as Error).message })
                      return false
                    }
                    const uploaded = await supabase.storage.from('documents').upload(path, file, { upsert: false })
                    if (uploaded.error) {
                      setMessage({ kind: 'error', text: `No se pudo subir el archivo: ${uploaded.error.message}` })
                      return false
                    }
                    const ok = await run(supabase.rpc('add_savings_evidence', { p_validation: item.id, p_path: path, p_file_name: file.name, p_mime: file.type || null, p_size: file.size, p_description: description || null }), 'Evidencia agregada.')
                    if (!ok) await supabase.storage.from('documents').remove([path])
                    return ok
                  }}
                  onOpen={async path => {
                    const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60)
                    if (error || !data) setMessage({ kind: 'error', text: error?.message || 'No se pudo abrir el archivo' })
                    else window.open(data.signedUrl, '_blank', 'noopener')
                  }}
                  onRecognize={(period, amount, evidence, note) => run(supabase.rpc('recognize_savings', { p_validation: item.id, p_period: period, p_amount: amount, p_evidence: evidence || null, p_note: note || null }), 'Ahorro reconocido.')}
                  onReverse={(recognitionId, note) => run(supabase.rpc('reverse_recognition', { p_recognition: recognitionId, p_note: note }), 'Reconocimiento reversado. Queda el registro original y su reversa.')}
                  onWithdraw={note => run(supabase.rpc('withdraw_savings', { p_validation: item.id, p_note: note }), 'Validación retirada.')}
                />
              ))
            )}
          </div>
        )}

        {tab === 'auditoria' && !isViewer && (
          <BlockCard title="Auditoría de ahorros" description="Cada declaración, validación, devolución, evidencia, reconocimiento y reversa queda registrada y no se puede editar.">
            {bundle.events.length === 0 ? (
              <EmptyHint>Aún no hay eventos.</EmptyHint>
            ) : (
              <ul className="divide-y divide-petrol-blue/[0.06]" data-testid="auditoria-ahorros">
                {bundle.events.map(event => {
                  const validation = bundle.validations.find(item => item.id === event.validation_id)
                  return (
                    <li key={event.id} className="py-2.5 text-[13px] text-petrol-blue">
                      <span className="font-medium">{EVENT_LABEL[event.event] || event.event}</span> · {validation?.licitacion_name || 'Ahorro'} · {person(event.actor_id)} · {new Date(event.at).toLocaleString('es-CL')}
                      {event.note ? <span className="block text-[12px] text-petrol-blue/75">“{event.note}”</span> : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </BlockCard>
        )}
      </div>
    </MainLayout>
  )
}

function Summary({ rows, year }: { rows: SavingsRow[]; year: number }) {
  if (rows.length === 0) {
    return <EmptyHint>No hay metas, adjudicaciones comparables ni ahorros declarados para {year} con estos filtros. Sin información no es cero: aún no se ha medido nada.</EmptyHint>
  }
  return (
    <div className="space-y-4" data-testid="resumen-ahorros">
      {rows.map(row => (
        <BlockCard key={row.currency} title={`Ahorro ${year} en ${row.currency}`} description="Reducción de precio. La evitación de costo se muestra aparte y no se suma.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Línea base documentada" tag="Referencia">{money(row.baseline, row.currency)}</Tile>
            <Tile label="Meta del plan" tag="Objetivo">{money(row.target, row.currency)}</Tile>
            <Tile label="Negociado" tag="Estimado">{money(row.negotiated, row.currency)}</Tile>
            <Tile label="Pendiente de validación" tag="Declarado">{money(row.pendingValidation, row.currency, 'Ninguno pendiente')}</Tile>
            <Tile label="Validado (anualizado)" tag="Validado">{money(row.validatedAnnualized, row.currency, SAVINGS_TEXT.pending)}</Tile>
            <Tile label="Validado con impacto en el año" tag="Validado">{money(row.validatedYear, row.currency, SAVINGS_TEXT.pending)}</Tile>
            <Tile label="Realizado en el año" tag="Realizado">{money(row.realizedYear, row.currency)}</Tile>
            <Tile label="Realizado acumulado" tag="Realizado">{money(row.realizedTotal, row.currency)}</Tile>
          </div>
          {(row.costAvoidance.validatedAnnualized != null || row.costAvoidance.realizedYear != null) && (
            <div className="mt-3 rounded-2xl border border-dashed border-petrol-blue/20 p-3">
              <p className="text-[12px] font-medium text-petrol-blue/80">Evitación de costo (aparte, no suma a la reducción de precio)</p>
              <p className="mt-1 text-[13px] text-petrol-blue">
                Validado anualizado {money(row.costAvoidance.validatedAnnualized, row.currency)} · con impacto en el año {money(row.costAvoidance.validatedYear, row.currency)} · realizado {money(row.costAvoidance.realizedYear, row.currency)}
              </p>
            </div>
          )}
        </BlockCard>
      ))}
    </div>
  )
}

function DeclareForm({ target, onSubmit, onCancel }: { target: DeclareTarget; onSubmit: (values: { declared: number; nature: Nature; recurrence: Recurrence; start: string; end: string; note: string }) => Promise<void>; onCancel: () => void }) {
  const [declared, setDeclared] = useState(String(Math.round(target.negotiated * 100) / 100))
  const [nature, setNature] = useState<Nature>('reduccion_precio')
  const [recurrence, setRecurrence] = useState<Recurrence>('unico')
  const [start, setStart] = useState((target.award?.awarded_at || new Date().toISOString()).slice(0, 10))
  const [end, setEnd] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      data-testid="form-declarar"
      className="glass-card space-y-3 p-4"
      onSubmit={async event => {
        event.preventDefault()
        setBusy(true)
        await onSubmit({ declared: Number(declared), nature, recurrence, start, end, note })
        setBusy(false)
      }}
    >
      <p className="text-[14px] font-medium text-petrol-blue">Declarar ahorro: {target.title}</p>
      <p className="text-[12px] text-petrol-blue/75">Negociado comparable: {formatCurrency(target.negotiated, target.currency)}. Puedes declarar hasta ese monto; la validación posterior puede dejarlo menor.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[12px] font-medium text-petrol-blue/80">Monto declarado ({target.currency})
          <input aria-label="Monto declarado" type="number" min="0" step="0.01" required className={`${FIELD} mt-1 w-full`} value={declared} onChange={event => setDeclared(event.target.value)} />
        </label>
        <label className="text-[12px] font-medium text-petrol-blue/80">Naturaleza
          <select aria-label="Naturaleza" className={`${FIELD} mt-1 w-full`} value={nature} onChange={event => setNature(event.target.value as Nature)}>
            <option value="reduccion_precio">Reducción de precio</option>
            <option value="evitacion_costo">Evitación de costo</option>
          </select>
        </label>
        <label className="text-[12px] font-medium text-petrol-blue/80">Vigencia
          <select aria-label="Recurrencia" className={`${FIELD} mt-1 w-full`} value={recurrence} onChange={event => setRecurrence(event.target.value as Recurrence)}>
            <option value="unico">Único</option>
            <option value="recurrente">Recurrente (mensual)</option>
          </select>
        </label>
        <label className="text-[12px] font-medium text-petrol-blue/80">Rige desde
          <input aria-label="Rige desde" type="date" required className={`${FIELD} mt-1 w-full`} value={start} onChange={event => setStart(event.target.value)} />
        </label>
        {recurrence === 'recurrente' && (
          <label className="text-[12px] font-medium text-petrol-blue/80">Rige hasta
            <input aria-label="Rige hasta" type="date" required className={`${FIELD} mt-1 w-full`} value={end} onChange={event => setEnd(event.target.value)} />
          </label>
        )}
      </div>
      <label className="block text-[12px] font-medium text-petrol-blue/80">Nota para quien valida (opcional)
        <textarea aria-label="Nota de la declaración" className="mt-1 w-full rounded-xl border border-petrol-blue/15 bg-white/80 px-3 py-2 text-[13px] text-petrol-blue" rows={2} value={note} onChange={event => setNote(event.target.value)} />
      </label>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>{busy ? 'Declarando…' : 'Declarar para validación'}</Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  )
}

function ValidateCard({
  validation,
  session,
  declaredBy,
  category,
  owner,
  allowValidate,
  canManage,
  onValidate,
  onReturn,
  onWithdraw,
  onRedeclare,
}: {
  validation: ValidationRow
  session: AppSession
  declaredBy: string
  category: string
  owner: string
  allowValidate: boolean
  canManage: boolean
  onValidate: (amount: number, method: string, note: string) => Promise<boolean>
  onReturn: (note: string) => Promise<boolean>
  onWithdraw: (note: string) => Promise<boolean>
  onRedeclare: () => void
}) {
  const [amount, setAmount] = useState(String(validation.declared_amount))
  const [method, setMethod] = useState('')
  const [note, setNote] = useState('')
  const own = validation.declared_by === session.userId
  const returned = validation.status === 'returned'
  return (
    <li className="rounded-2xl border border-petrol-blue/10 bg-white/70 p-4" data-testid="tarjeta-validar">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[14px] font-medium text-petrol-blue">{validation.licitacion_name || 'Ahorro'}{validation.source_kind === 'manual' ? ` · ${SAVINGS_TEXT.manual}` : ''}</p>
          <p className="text-[12px] text-petrol-blue/75">
            {category} · responsable {owner} · {describeNature(validation.nature, validation.recurrence)} · desde {fmtDate(validation.start_date)}{validation.end_date ? ` hasta ${fmtDate(validation.end_date)}` : ''}
          </p>
          <p className="text-[12px] text-petrol-blue/75">
            Base {formatCurrency(validation.baseline_amount, validation.currency)} · adjudicado {formatCurrency(validation.awarded_amount, validation.currency)} · declarado <strong>{formatCurrency(validation.declared_amount, validation.currency)}</strong> por {declaredBy}
          </p>
          {validation.declare_note && <p className="text-[12px] italic text-petrol-blue/75">“{validation.declare_note}”</p>}
        </div>
        <span className={`rounded-full px-3 py-1 text-[12px] font-medium ${returned ? 'bg-amber-100 text-amber-900' : 'bg-petrol-blue/[0.06] text-petrol-blue'}`}>{returned ? 'Devuelta' : 'Pendiente de validación'}</span>
      </div>
      {returned && validation.review_note && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">Comentario de quien revisó: {validation.review_note}</p>}
      {returned ? (
        <div className="mt-3"><Button size="sm" onClick={onRedeclare}>Volver a declarar</Button></div>
      ) : (
        <div className="mt-3 space-y-2">
          {own && <p className="text-[12px] text-petrol-blue/75">Declaraste este ahorro: debe validarlo otra persona.</p>}
          {allowValidate && (
            <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
              <input aria-label="Monto validado" type="number" min="0" step="0.01" className={FIELD} value={amount} onChange={event => setAmount(event.target.value)} />
              <input aria-label="Metodología de validación" className={FIELD} placeholder="Cómo se validó (ej. comparación con facturas del año anterior)" value={method} onChange={event => setMethod(event.target.value)} />
            </div>
          )}
          {(allowValidate || own) && (
            <input aria-label="Comentario" className={`${FIELD} w-full`} placeholder={allowValidate ? 'Comentario (obligatorio para devolver)' : 'Motivo del retiro'} value={note} onChange={event => setNote(event.target.value)} />
          )}
          <div className="flex flex-wrap gap-2">
            {allowValidate && <Button size="sm" onClick={() => onValidate(Number(amount), method, note)}>Validar ahorro</Button>}
            {allowValidate && <Button size="sm" variant="outline" onClick={() => onReturn(note)}>Devolver con comentario</Button>}
            {(own || canManage) && <Button size="sm" variant="outline" onClick={() => onWithdraw(note)}>Retirar declaración</Button>}
          </div>
        </div>
      )}
    </li>
  )
}

function ValidatedCard({
  validation,
  bundle,
  session,
  person,
  category,
  canManage,
  hideEvidence,
  onUpload,
  onOpen,
  onRecognize,
  onReverse,
  onWithdraw,
}: {
  validation: ValidationRow
  bundle: SavingsBundle
  session: AppSession
  person: (id: string | null | undefined) => string
  category: string
  canManage: boolean
  hideEvidence: boolean
  onUpload: (file: File, description: string) => Promise<boolean>
  onOpen: (path: string) => Promise<void>
  onRecognize: (period: string, amount: number, evidence: string, note: string) => Promise<boolean>
  onReverse: (recognitionId: string, note: string) => Promise<boolean>
  onWithdraw: (note: string) => Promise<boolean>
}) {
  const recognitions = bundle.recognitions.filter(item => item.validation_id === validation.id)
  const evidence = bundle.evidence.filter(item => item.validation_id === validation.id)
  const net = netRecognized(recognitions)
  const validatedAmount = validation.validated_amount as number
  const suggested = validation.recurrence === 'recurrente' ? Math.round((validatedAmount / 12) * 100) / 100 : Math.max(Math.round((validatedAmount - net) * 100) / 100, 0)
  const now = new Date()
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [amount, setAmount] = useState(String(suggested))
  const [evidenceId, setEvidenceId] = useState('')
  const [note, setNote] = useState('')
  const [reverseNote, setReverseNote] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const reversed = new Set(recognitions.filter(item => item.kind === 'reversal').map(item => item.reverses_id))
  return (
    <div className="rounded-2xl border border-petrol-blue/10 bg-white/70 p-4" data-testid="tarjeta-validado">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[14px] font-medium text-petrol-blue">{validation.licitacion_name || 'Ahorro'}{validation.source_kind === 'manual' ? ` · ${SAVINGS_TEXT.manual}` : ''}</p>
          <p className="text-[12px] text-petrol-blue/75">
            {category} · responsable {person(validation.owner_user_id)} · {describeNature(validation.nature, validation.recurrence)} · desde {fmtDate(validation.start_date)}{validation.end_date ? ` hasta ${fmtDate(validation.end_date)}` : ''}
          </p>
          <p className="text-[12px] text-petrol-blue/75">
            Declarado {formatCurrency(validation.declared_amount, validation.currency)} por {person(validation.declared_by)} · validado <strong>{formatCurrency(validatedAmount, validation.currency)}</strong> por {person(validation.validated_by)} el {fmtDate(validation.validated_at)}
          </p>
          {validation.method && <p className="text-[12px] text-petrol-blue/75">Metodología: {validation.method}</p>}
        </div>
        <div className="text-right text-[12px] text-petrol-blue/80">
          <p>Realizado neto</p>
          <p className="text-[1.05rem] font-medium text-petrol-blue">{recognitions.length ? formatCurrency(net, validation.currency) : SAVINGS_TEXT.noInfo}</p>
        </div>
      </div>

      {!hideEvidence && (
        <div className="mt-3">
          <p className="text-[12.5px] font-medium text-petrol-blue">Evidencia ({evidence.length})</p>
          {evidence.length === 0 ? (
            <p className="text-[12px] text-petrol-blue/75">Sin evidencia. Sin ella no se puede reconocer el ahorro.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {evidence.map(item => (
                <li key={item.id} className="text-[12.5px] text-petrol-blue">
                  <button type="button" className="font-medium underline" onClick={() => onOpen(item.storage_path)}>{item.file_name}</button>
                  {item.description ? ` · ${item.description}` : ''} · {person(item.uploaded_by)} · {fmtDate(item.uploaded_at)}
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input key={evidence.length} aria-label="Archivo de evidencia" type="file" className="text-[12px]" onChange={event => setFile(event.target.files?.[0] || null)} />
              <input aria-label="Descripción de la evidencia" className={`${FIELD} h-8`} placeholder="Qué demuestra (ej. factura marzo)" value={description} onChange={event => setDescription(event.target.value)} />
              <Button size="sm" variant="outline" disabled={!file} onClick={async () => { if (file && (await onUpload(file, description))) { setFile(null); setDescription('') } }}>Subir evidencia</Button>
            </div>
          )}
        </div>
      )}

      <div className="mt-3">
        <p className="text-[12.5px] font-medium text-petrol-blue">Reconocimientos ({recognitions.length})</p>
        {recognitions.length === 0 ? (
          <p className="text-[12px] text-petrol-blue/75">Aún no se reconoce ningún mes: el realizado figura como “{SAVINGS_TEXT.noInfo}”.</p>
        ) : (
          <ul className="mt-1 divide-y divide-petrol-blue/[0.06]">
            {recognitions.map(item => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-[12.5px] text-petrol-blue">
                <span>
                  {item.period} · {item.kind === 'recognition' ? 'Reconocido' : 'Reversa'} {formatCurrency(item.amount, item.currency)} · {person(item.recognized_by)}
                  {item.note ? ` · “${item.note}”` : ''}
                  {item.kind === 'recognition' && reversed.has(item.id) ? ' · reversado' : ''}
                </span>
                {canManage && item.kind === 'recognition' && !reversed.has(item.id) && (
                  <span className="flex items-center gap-1">
                    <input aria-label="Motivo de la reversa" className={`${FIELD} h-8 w-56`} placeholder="Motivo de la reversa" value={reverseNote} onChange={event => setReverseNote(event.target.value)} />
                    <Button size="sm" variant="outline" onClick={async () => { if (await onReverse(item.id, reverseNote)) setReverseNote('') }}>Reversar</Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {canManage && (
          <div className="mt-2 grid gap-2 sm:grid-cols-[150px_150px_1fr_1fr_auto]">
            <input aria-label="Mes a reconocer" type="month" className={FIELD} value={period} onChange={event => setPeriod(event.target.value)} />
            <input aria-label="Monto a reconocer" type="number" min="0" step="0.01" className={FIELD} value={amount} onChange={event => setAmount(event.target.value)} />
            <select aria-label="Evidencia que respalda" className={FIELD} value={evidenceId} onChange={event => setEvidenceId(event.target.value)}>
              <option value="">Evidencia que respalda…</option>
              {evidence.map(item => <option key={item.id} value={item.id}>{item.file_name}</option>)}
            </select>
            <input aria-label="Nota del reconocimiento" className={FIELD} placeholder="Nota (opcional)" value={note} onChange={event => setNote(event.target.value)} />
            <Button size="sm" onClick={() => onRecognize(period, Number(amount), evidenceId, note)}>Reconocer mes</Button>
          </div>
        )}
        {canManage && recognitions.length === 0 && (
          <div className="mt-2"><Button size="sm" variant="outline" onClick={() => onWithdraw('Retirado antes de reconocer')}>Retirar validación</Button></div>
        )}
      </div>
      <p className="mt-2 text-[11.5px] text-petrol-blue/60">{session.role === 'viewer' ? 'Perfil de solo lectura: la evidencia y la auditoría no se muestran.' : ''}</p>
    </div>
  )
}
