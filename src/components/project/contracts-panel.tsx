'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, FileSignature, GitMerge, Link2 } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

const FIELD = 'h-9 w-full rounded-xl border border-petrol-blue/15 bg-white/80 px-3 text-[13px] text-petrol-blue'

export const RELATION_LABEL: Record<string, string> = {
  renewal: 'Renovación',
  replacement: 'Reemplazo',
  consolidation: 'Consolidación',
  split: 'División',
  partial_replacement: 'Reemplazo parcial',
  complementary: 'Complementario',
}
export const CONTRACT_STATUS: Record<string, string> = { draft: 'Borrador', in_review: 'En revisión', active: 'Vigente', expired: 'Vencido', terminated: 'Terminado' }
const END_REASON: Record<string, string> = { expired: 'Venció', terminated_early: 'Término anticipado', replaced: 'Reemplazado', partially_replaced: 'Reemplazado en parte', no_replacement: 'Término sin reemplazo' }

export type ContractLite = { id: string; code: string | null; name: string; counterparty_name: string | null; status: string; starts_on: string | null; ends_on: string | null; signed_on: string | null; terminated_on: string | null; end_reason: string | null; currency: string | null; amount: number | null; licitacion_id: string | null }
type ProjectLink = { id: string; contract_id: string; role: 'affected' | 'successor' | 'related'; note: string | null }
type Relation = { id: string; from_contract_id: string; to_contract_id: string; relation: string; scope_note: string | null; share_pct: number | null; effective_on: string | null; sourcing_project_id: string | null }

export const CONTRACT_COLUMNS = 'id, code, name, counterparty_name, status, starts_on, ends_on, signed_on, terminated_on, end_reason, currency, amount, licitacion_id'

function fmt(date: string | null) {
  if (!date) return '—'
  const [y, m, d] = date.split('-')
  return `${d}-${m}-${y}`
}

function daysTo(date: string | null, today: string) {
  if (!date) return null
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
}

export function ContractCard({ contract, today, accent }: { contract: ContractLite; today: string; accent?: 'before' | 'after' }) {
  const left = daysTo(contract.ends_on, today)
  return (
    <Link href={`/contratos/${contract.id}`} className={cn('block rounded-2xl border bg-white/80 p-3 shadow-sm transition-transform hover:-translate-y-0.5', accent === 'after' ? 'border-accent-turquoise/50' : 'border-petrol-blue/10')} data-testid="tarjeta-contrato">
      <p className="text-[13px] font-medium text-petrol-blue">{contract.name}</p>
      <p className="text-[11.5px] text-petrol-blue/70">{contract.counterparty_name || 'Sin contraparte'}{contract.code ? ` · ${contract.code}` : ''}</p>
      <p className="mt-1.5 flex flex-wrap gap-1 text-[11px]">
        <span className="rounded-full bg-petrol-blue/[0.06] px-2 py-0.5 text-petrol-blue">{CONTRACT_STATUS[contract.status] || contract.status}</span>
        {contract.end_reason && <span className="rounded-full bg-petrol-blue/[0.06] px-2 py-0.5 text-petrol-blue/80">{END_REASON[contract.end_reason]}</span>}
        {contract.status === 'active' && left != null && left >= 0 && left <= 120 && <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-900">Vence en {left} d</span>}
      </p>
      <p className="mt-1 text-[11.5px] text-petrol-blue/75">Vigencia {fmt(contract.starts_on)} → {fmt(contract.ends_on)}{contract.signed_on ? ` · firmado ${fmt(contract.signed_on)}` : ''}</p>
      {contract.amount != null && contract.currency && <p className="text-[11.5px] text-petrol-blue/75">{formatCurrency(contract.amount, contract.currency)}</p>}
    </Link>
  )
}

export function ContractsPanel({ companyId, projectId, projectTitle, rfx, today, canManage, readOnly }: {
  companyId: string
  projectId: string
  projectTitle: string
  rfx: { id: string; name: string; type: string }[]
  today: string
  canManage: boolean
  readOnly: boolean
}) {
  const supabase = supabaseBrowser()
  const [links, setLinks] = useState<ProjectLink[]>([])
  const [relations, setRelations] = useState<Relation[]>([])
  const [contracts, setContracts] = useState<ContractLite[]>([])
  const [denied, setDenied] = useState(false)
  const [mode, setMode] = useState<'visual' | 'tabla'>('visual')
  const [form, setForm] = useState({ contract: '', role: 'affected', from: '', to: '', relation: 'replacement', share: '', scope: '', effective: '' })
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    const [linked, related, all] = await Promise.all([
      supabase.from('project_contracts').select('id, contract_id, role, note').eq('project_id', projectId),
      supabase.from('contract_relations').select('id, from_contract_id, to_contract_id, relation, scope_note, share_pct, effective_on, sourcing_project_id').eq('company_id', companyId).limit(500),
      supabase.from('contracts').select(CONTRACT_COLUMNS).eq('company_id', companyId).order('name').limit(500),
    ])
    setDenied(!!all.error)
    setLinks((linked.data || []) as ProjectLink[])
    setContracts((all.data || []) as ContractLite[])
    const ids = new Set(((linked.data || []) as ProjectLink[]).map(item => item.contract_id))
    setRelations(((related.data || []) as Relation[]).filter(item => item.sourcing_project_id === projectId || ids.has(item.from_contract_id) || ids.has(item.to_contract_id)))
  }, [supabase, companyId, projectId])
  useEffect(() => { load() }, [load])

  const byId = useMemo(() => new Map(contracts.map(item => [item.id, item])), [contracts])
  const before = links.filter(item => item.role === 'affected').map(item => byId.get(item.contract_id)).filter(Boolean) as ContractLite[]
  const after = links.filter(item => item.role === 'successor').map(item => byId.get(item.contract_id)).filter(Boolean) as ContractLite[]
  const related = links.filter(item => item.role === 'related').map(item => byId.get(item.contract_id)).filter(Boolean) as ContractLite[]

  const run = async (action: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await action
    if (error) setMessage({ kind: 'error', text: error.message })
    else { setMessage({ kind: 'ok', text: ok }); load() }
  }

  if (denied) return <p className="rounded-xl border border-dashed border-petrol-blue/15 px-4 py-5 text-[12.5px] text-petrol-blue/75">Tu perfil no tiene acceso a los contratos.</p>

  return (
    <div className="space-y-4" data-testid="historia-contratos">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-[12.5px] text-petrol-blue/75">
          Qué contratos reemplaza este proyecto y cuáles nacen de él. Un contrato anterior no se marca terminado por adjudicar uno nuevo: su término se registra en su ficha.
        </p>
        <div className="flex gap-1" role="group" aria-label="Vista">
          {(['visual', 'tabla'] as const).map(item => <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)} className={cn('rounded-full px-3 py-1 text-[12px] font-medium', mode === item ? 'bg-petrol-blue text-white' : 'border border-petrol-blue/15 bg-white/70 text-petrol-blue')}>{item === 'visual' ? 'Situación' : 'Tabla'}</button>)}
        </div>
      </div>
      {message && <p role="status" className={cn('rounded-xl px-3 py-2 text-[12.5px]', message.kind === 'ok' ? 'bg-accent-mint/30 text-petrol-blue' : 'bg-red-50 text-red-800')}>{message.text}</p>}

      {mode === 'visual' ? (
        <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]" data-testid="situacion-contratos">
          <Column title="Situación anterior" hint={`${before.length} contrato${before.length === 1 ? '' : 's'}`}>
            {before.length === 0 ? <Empty>Sin contratos anteriores vinculados.</Empty> : before.map(item => <ContractCard key={item.id} contract={item} today={today} accent="before" />)}
          </Column>
          <Arrow />
          <Column title="Proceso" hint="Proyecto de sourcing">
            <div className="rounded-2xl border border-petrol-blue/15 bg-petrol-blue p-3 text-white shadow">
              <p className="text-[13px] font-medium">{projectTitle}</p>
              <ul className="mt-2 space-y-1 text-[12px] text-white/85">
                {rfx.length === 0 ? <li>Sin procesos RFx vinculados.</li> : rfx.map(item => <li key={item.id}><Link href={`/licitaciones/${item.id}`} className="hover:underline">{item.type} · {item.name}</Link></li>)}
              </ul>
            </div>
            {relations.length > 0 && (
              <ul className="space-y-1.5" data-testid="transiciones">
                {relations.map(item => (
                  <li key={item.id} className="rounded-xl bg-white/70 px-3 py-2 text-[12px] text-petrol-blue">
                    <p className="flex flex-wrap items-center gap-1 font-medium"><GitMerge className="h-3.5 w-3.5" aria-hidden />{RELATION_LABEL[item.relation]}{item.share_pct ? ` · ${item.share_pct}%` : ''}</p>
                    <p className="text-petrol-blue/80">{byId.get(item.from_contract_id)?.name || 'Contrato'} → {byId.get(item.to_contract_id)?.name || 'Contrato'}</p>
                    {(item.scope_note || item.effective_on) && <p className="text-petrol-blue/65">{item.scope_note}{item.effective_on ? ` · desde ${fmt(item.effective_on)}` : ''}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Column>
          <Arrow />
          <Column title="Nueva situación" hint={`${after.length} contrato${after.length === 1 ? '' : 's'}`}>
            {after.length === 0 ? <Empty>Aún no hay contratos nuevos. Se vinculan al formalizar la adjudicación.</Empty> : after.map(item => <ContractCard key={item.id} contract={item} today={today} accent="after" />)}
          </Column>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/70 bg-white/70">
          <table className="w-full min-w-[760px] text-left text-[12.5px] text-petrol-blue" data-testid="tabla-contratos-proyecto">
            <thead><tr className="border-b border-petrol-blue/10 text-[12px] text-petrol-blue/75">{['Rol', 'Contrato', 'Contraparte', 'Estado', 'Vigencia', 'Monto', 'Transición'].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead>
            <tbody>
              {[...before.map(item => ({ item, role: 'Anterior' })), ...after.map(item => ({ item, role: 'Nuevo' })), ...related.map(item => ({ item, role: 'Relacionado' }))].map(({ item, role }) => (
                <tr key={`${role}-${item.id}`} className="border-b border-petrol-blue/[0.06]">
                  <td className="px-3 py-2">{role}</td>
                  <td className="px-3 py-2"><Link href={`/contratos/${item.id}`} className="font-medium hover:underline">{item.name}</Link></td>
                  <td className="px-3 py-2">{item.counterparty_name || '—'}</td>
                  <td className="px-3 py-2">{CONTRACT_STATUS[item.status] || item.status}{item.end_reason ? ` · ${END_REASON[item.end_reason]}` : ''}</td>
                  <td className="px-3 py-2">{fmt(item.starts_on)} → {fmt(item.ends_on)}</td>
                  <td className="px-3 py-2">{item.amount != null && item.currency ? formatCurrency(item.amount, item.currency) : '—'}</td>
                  <td className="px-3 py-2">{relations.filter(rel => rel.from_contract_id === item.id || rel.to_contract_id === item.id).map(rel => `${RELATION_LABEL[rel.relation]}${rel.share_pct ? ` ${rel.share_pct}%` : ''}`).join(', ') || '—'}</td>
                </tr>
              ))}
              {before.length + after.length + related.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-petrol-blue/70">Sin contratos vinculados.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {canManage && !readOnly && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-2 rounded-2xl border border-white/70 bg-white/60 p-3">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-petrol-blue"><Link2 className="h-3.5 w-3.5" />Vincular un contrato</p>
            <select className={FIELD} value={form.contract} onChange={event => setForm({ ...form, contract: event.target.value })} aria-label="Contrato">
              <option value="">Elegir contrato…</option>
              {contracts.map(item => <option key={item.id} value={item.id}>{item.name}{item.counterparty_name ? ` · ${item.counterparty_name}` : ''}</option>)}
            </select>
            <select className={FIELD} value={form.role} onChange={event => setForm({ ...form, role: event.target.value })} aria-label="Rol del contrato">
              <option value="affected">Contrato anterior (afectado por el proyecto)</option>
              <option value="successor">Contrato nuevo (resultado del proyecto)</option>
              <option value="related">Relacionado</option>
            </select>
            <Button size="sm" disabled={!form.contract} onClick={() => run(supabase.rpc('link_project_contract', { p_project: projectId, p_contract: form.contract, p_role: form.role }), 'Contrato vinculado al proyecto.')}>Vincular</Button>
          </div>
          <div className="space-y-2 rounded-2xl border border-white/70 bg-white/60 p-3">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-petrol-blue"><FileSignature className="h-3.5 w-3.5" />Registrar una transición</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <select className={FIELD} value={form.from} onChange={event => setForm({ ...form, from: event.target.value })} aria-label="Contrato anterior">
                <option value="">Desde…</option>
                {before.concat(related).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select className={FIELD} value={form.to} onChange={event => setForm({ ...form, to: event.target.value })} aria-label="Contrato nuevo">
                <option value="">Hacia…</option>
                {after.concat(related).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select className={FIELD} value={form.relation} onChange={event => setForm({ ...form, relation: event.target.value })} aria-label="Tipo de transición">
                {Object.entries(RELATION_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
              <input type="number" min="1" max="100" className={FIELD} placeholder="% del alcance (opcional)" value={form.share} onChange={event => setForm({ ...form, share: event.target.value })} />
              <input className={FIELD} placeholder="Alcance (ej.: sedes de Antofagasta)" value={form.scope} onChange={event => setForm({ ...form, scope: event.target.value })} />
              <input type="date" className={FIELD} value={form.effective} onChange={event => setForm({ ...form, effective: event.target.value })} aria-label="Desde cuándo" />
            </div>
            <Button size="sm" disabled={!form.from || !form.to} onClick={() => run(supabase.rpc('relate_contracts', { p_from: form.from, p_to: form.to, p_relation: form.relation, p_project: projectId, p_scope: form.scope || null, p_share: form.share ? Number(form.share) : null, p_effective: form.effective || null }), 'Transición registrada.')}>Registrar</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Historia de un contrato: de qué contratos viene, cuáles lo suceden y en qué proyectos participa. El término se registra aquí,
// nunca como efecto automático de adjudicar un contrato nuevo.
export function ContractHistory({ companyId, contractId, canManage }: { companyId: string; contractId: string; canManage: boolean }) {
  const supabase = supabaseBrowser()
  const [self, setSelf] = useState<ContractLite | null>(null)
  const [relations, setRelations] = useState<Relation[]>([])
  const [others, setOthers] = useState<Map<string, ContractLite>>(new Map())
  const [projects, setProjects] = useState<{ project_id: string; role: string; title: string }[]>([])
  const [form, setForm] = useState({ signed_on: '', terminated_on: '', end_reason: '' })
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const today = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    const [me, rels, links] = await Promise.all([
      supabase.from('contracts').select(CONTRACT_COLUMNS).eq('id', contractId).maybeSingle(),
      supabase.from('contract_relations').select('id, from_contract_id, to_contract_id, relation, scope_note, share_pct, effective_on, sourcing_project_id').eq('company_id', companyId).or(`from_contract_id.eq.${contractId},to_contract_id.eq.${contractId}`),
      supabase.from('project_contracts').select('project_id, role').eq('contract_id', contractId),
    ])
    const row = (me.data || null) as ContractLite | null
    setSelf(row)
    if (row) setForm({ signed_on: row.signed_on || '', terminated_on: row.terminated_on || '', end_reason: row.end_reason || '' })
    const list = (rels.data || []) as Relation[]
    setRelations(list)
    const ids = Array.from(new Set(list.flatMap(item => [item.from_contract_id, item.to_contract_id]).filter(id => id !== contractId)))
    const { data: rows } = ids.length ? await supabase.from('contracts').select(CONTRACT_COLUMNS).in('id', ids) : { data: [] }
    setOthers(new Map(((rows || []) as ContractLite[]).map(item => [item.id, item])))
    const linkRows = (links.data || []) as { project_id: string; role: string }[]
    const { data: titles } = linkRows.length ? await supabase.from('sourcing_projects').select('id, title').in('id', linkRows.map(item => item.project_id)) : { data: [] }
    const titleOf = new Map(((titles || []) as { id: string; title: string }[]).map(item => [item.id, item.title]))
    setProjects(linkRows.map(item => ({ ...item, title: titleOf.get(item.project_id) || 'Proyecto' })))
  }, [supabase, companyId, contractId])
  useEffect(() => { load() }, [load])

  if (!self) return null
  const previous = relations.filter(item => item.to_contract_id === contractId)
  const next = relations.filter(item => item.from_contract_id === contractId)
  const save = async () => {
    if (form.end_reason && !form.terminated_on && form.end_reason !== 'expired') return setMessage({ kind: 'error', text: 'Indica la fecha de término.' })
    const { error } = await supabase.from('contracts').update({ signed_on: form.signed_on || null, terminated_on: form.terminated_on || null, end_reason: form.end_reason || null }).eq('id', contractId)
    if (error) setMessage({ kind: 'error', text: error.message })
    else { setMessage({ kind: 'ok', text: 'Fechas del contrato actualizadas.' }); load() }
  }
  const relationItem = (item: Relation, other: string) => (
    <li key={item.id} className="space-y-1">
      <p className="text-[11.5px] font-medium text-petrol-blue/70">{RELATION_LABEL[item.relation]}{item.share_pct ? ` · ${item.share_pct}%` : ''}{item.effective_on ? ` · desde ${fmt(item.effective_on)}` : ''}{item.scope_note ? ` · ${item.scope_note}` : ''}</p>
      {others.get(other) ? <ContractCard contract={others.get(other)!} today={today} /> : <p className="text-[12px] text-petrol-blue/60">Contrato sin acceso.</p>}
    </li>
  )

  return (
    <section className="glass-card space-y-4 p-4" data-testid="historia-contrato">
      <div>
        <p className="text-[15px] font-medium text-petrol-blue">Historia del contrato</p>
        <p className="text-[12.5px] text-petrol-blue/75">Adjudicación, firma, vigencia y término son hitos distintos: un contrato sigue vigente hasta que se registra su término.</p>
      </div>
      <dl className="grid gap-2 text-[12.5px] sm:grid-cols-4">
        {[
          ['Adjudicación', self.licitacion_id ? <Link key="a" href={`/licitaciones/${self.licitacion_id}`} className="underline">Ver proceso</Link> : 'Sin proceso en XPEND'],
          ['Firma', fmt(self.signed_on)],
          ['Vigencia', `${fmt(self.starts_on)} → ${fmt(self.ends_on)}`],
          ['Término', self.terminated_on ? `${fmt(self.terminated_on)}${self.end_reason ? ` · ${END_REASON[self.end_reason]}` : ''}` : self.end_reason ? END_REASON[self.end_reason] : 'No registrado'],
        ].map(([label, value]) => <div key={label as string} className="rounded-xl bg-white/70 p-2.5"><dt className="text-[11px] text-petrol-blue/60">{label}</dt><dd className="font-medium text-petrol-blue">{value}</dd></div>)}
      </dl>
      <div className="grid items-start gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <Column title="Viene de" hint={`${previous.length}`}>{previous.length ? <ul className="space-y-2">{previous.map(item => relationItem(item, item.from_contract_id))}</ul> : <Empty>No reemplaza ni consolida otros contratos registrados.</Empty>}</Column>
        <Arrow />
        <Column title="Este contrato" hint={CONTRACT_STATUS[self.status] || self.status}><ContractCard contract={self} today={today} accent="after" /></Column>
        <Arrow />
        <Column title="Lo sucede" hint={`${next.length}`}>{next.length ? <ul className="space-y-2">{next.map(item => relationItem(item, item.to_contract_id))}</ul> : <Empty>Sin renovación ni reemplazo registrados.</Empty>}</Column>
      </div>
      {projects.length > 0 && (
        <p className="text-[12.5px] text-petrol-blue">Proyectos: {projects.map((item, index) => <span key={item.project_id}>{index ? ', ' : ''}<Link href={`/proyectos/${item.project_id}?tab=contratos`} className="underline">{item.title}</Link> ({item.role === 'affected' ? 'contrato anterior' : item.role === 'successor' ? 'contrato nuevo' : 'relacionado'})</span>)}</p>
      )}
      {canManage && (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-white/60 p-3 text-[12px] text-petrol-blue">
          <label>Firmado el<input type="date" className={`${FIELD} mt-1 w-40`} value={form.signed_on} onChange={event => setForm({ ...form, signed_on: event.target.value })} /></label>
          <label>Término el<input type="date" className={`${FIELD} mt-1 w-40`} value={form.terminated_on} onChange={event => setForm({ ...form, terminated_on: event.target.value })} /></label>
          <label>Motivo<select className={`${FIELD} mt-1 w-56`} value={form.end_reason} onChange={event => setForm({ ...form, end_reason: event.target.value })}><option value="">Sigue vigente</option>{Object.entries(END_REASON).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <Button size="sm" onClick={save}>Guardar fechas</Button>
          {message && <p role="status" className={message.kind === 'ok' ? 'text-petrol-blue' : 'text-red-700'}>{message.text}</p>}
        </div>
      )}
    </section>
  )
}

function Column({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-2xl bg-white/40 p-3">
      <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-petrol-blue/60">{title} <span className="normal-case tracking-normal text-petrol-blue/50">· {hint}</span></p>
      {children}
    </section>
  )
}
function Arrow() {
  return <div className="hidden items-center justify-center text-petrol-blue/40 lg:flex" aria-hidden><ArrowRight className="h-5 w-5" /></div>
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-petrol-blue/15 px-3 py-4 text-[12px] text-petrol-blue/70">{children}</p>
}
