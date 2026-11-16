'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Plus, Send, Trash2, XCircle } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import type { PersonOption } from '@/components/project/comments'
import { baselineSavings } from '@/lib/project'
import type { ApprovalRequest } from '@/lib/project-data'
import type { MethodologyRules } from '@/lib/methodology'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

const FIELD = 'h-9 w-full rounded-xl border border-petrol-blue/15 bg-white/80 px-3 text-[13px] text-petrol-blue'
const STATUS: Record<string, string> = { draft: 'Borrador', in_review: 'En aprobación', approved: 'Aprobada', superseded: 'Reemplazada' }
const METHOD: Record<string, string> = { price_comparison: 'Comparación de precios', total_cost: 'Costo total', cost_avoidance: 'Costo evitado', benchmark: 'Referencia de mercado' }
const SAVINGS_STATUS: Record<string, string> = { declared: 'Declarado, por validar', validated: 'Validado', returned: 'Devuelto', withdrawn: 'Retirado' }

type Baseline = { id: string; title: string; currency: string; method: string; period_months: number; status: string; version: number; scope_note: string | null; conditions_note: string | null; prepared_by: string | null; approved_by: string | null; approved_at: string | null; created_at: string }
type Line = { id: string; baseline_id: string; seq: number; item: string; unit: string | null; specification: string | null; reference_price: number; adjustment_pct: number; projected_qty: number; awarded_price: number | null; supplier_name: string | null }
type Saving = { id: string; currency: string; declared_amount: number; validated_amount: number | null; status: string; nature: string; recurrence: string; baseline_id: string | null }

export function BaselinePanel({ companyId, projectId, initiativeId, rules, approvals, people, approvers, userId, canManage, readOnly, onChanged }: {
  companyId: string
  projectId: string
  initiativeId: string
  rules: MethodologyRules
  approvals: ApprovalRequest[]
  people: PersonOption[]
  approvers: PersonOption[]
  userId: string
  canManage: boolean
  readOnly: boolean
  onChanged: () => void
}) {
  const supabase = supabaseBrowser()
  const [baselines, setBaselines] = useState<Baseline[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [savings, setSavings] = useState<Saving[]>([])
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [create, setCreate] = useState({ title: '', currency: 'CLP', method: 'price_comparison', period: '12', scope: '', conditions: '' })
  const [draft, setDraft] = useState({ item: '', unit: '', reference: '', adjustment: '0', qty: '', awarded: '' })
  const [approver, setApprover] = useState('')
  const [decision, setDecision] = useState('')
  const name = (id: string | null) => people.find(person => person.id === id)?.name || 'Persona del equipo'

  const load = useCallback(async () => {
    const { data } = await supabase.from('economic_baselines').select('id, title, currency, method, period_months, status, version, scope_note, conditions_note, prepared_by, approved_by, approved_at, created_at').eq('project_id', projectId).order('created_at', { ascending: false })
    const rows = (data || []) as Baseline[]
    setBaselines(rows)
    const [lineRows, savingRows] = await Promise.all([
      rows.length ? supabase.from('baseline_lines').select('id, baseline_id, seq, item, unit, specification, reference_price, adjustment_pct, projected_qty, awarded_price, supplier_name').in('baseline_id', rows.map(row => row.id)).order('seq') : Promise.resolve({ data: [] }),
      supabase.from('savings_validations').select('id, currency, declared_amount, validated_amount, status, nature, recurrence, baseline_id').eq('sourcing_plan_id', initiativeId).limit(100),
    ])
    setLines(((lineRows.data || []) as Line[]).map(line => ({ ...line, reference_price: Number(line.reference_price), adjustment_pct: Number(line.adjustment_pct), projected_qty: Number(line.projected_qty), awarded_price: line.awarded_price == null ? null : Number(line.awarded_price) })))
    setSavings((savingRows.data || []) as Saving[])
  }, [supabase, projectId, initiativeId])
  useEffect(() => { load() }, [load])

  const run = async (action: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await action
    if (error) { setMessage({ kind: 'error', text: error.message }); return false }
    setMessage({ kind: 'ok', text: ok })
    await load()
    onChanged()
    return true
  }

  const current = baselines.filter(row => row.status !== 'superseded')
  const old = baselines.filter(row => row.status === 'superseded')

  return (
    <div className="space-y-4" data-testid="linea-base">
      <div className="rounded-2xl border border-white/70 bg-white/55 p-4 text-[12.5px] text-petrol-blue/85">
        <p className="font-medium text-petrol-blue">{rules.baselineApproval === 'formal' ? 'Línea base formal y versionada' : 'Referencia económica documentada'}</p>
        <p className="mt-1">
          El ahorro anualizado es Σ [(precio de referencia ajustado − precio adjudicado) × cantidad proyectada]. Se calcula por moneda, solo con líneas que ya tienen precio adjudicado.
          {rules.baselineApproval === 'formal' ? ' La metodología exige aprobarla, por una persona distinta de quien la preparó, antes de validar ahorros.' : ' Basta una aprobación simple por otra persona.'}
          {' '}No se atribuyen efectos de tipo de cambio, volumen, calidad o alcance.
        </p>
      </div>
      {message && <p role="status" className={cn('rounded-xl px-3 py-2 text-[12.5px]', message.kind === 'ok' ? 'bg-accent-mint/30 text-petrol-blue' : 'bg-red-50 text-red-800')}>{message.text}</p>}

      {current.length === 0 && <p className="rounded-xl border border-dashed border-petrol-blue/15 px-4 py-5 text-[12.5px] text-petrol-blue/75">Este proyecto todavía no tiene línea base.</p>}
      {current.map(baseline => {
        const own = lines.filter(line => line.baseline_id === baseline.id)
        const totals = baselineSavings(own)
        const pending = approvals.find(row => row.subject_id === baseline.id && row.status === 'pending')
        const editable = canManage && !readOnly && baseline.status === 'draft'
        const priceable = canManage && !readOnly && baseline.status !== 'superseded'
        return (
          <section key={baseline.id} className="space-y-3 rounded-2xl border border-white/70 bg-white/70 p-4" data-testid="linea-base-item">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[14px] font-medium text-petrol-blue">{baseline.title} <span className="text-petrol-blue/60">· {baseline.currency} · v{baseline.version}</span></p>
                <p className="text-[12px] text-petrol-blue/70">{METHOD[baseline.method]} · {baseline.period_months} meses · preparó {name(baseline.prepared_by)}{baseline.approved_by ? ` · aprobó ${name(baseline.approved_by)}` : ''}</p>
                {baseline.scope_note && <p className="mt-1 text-[12px] text-petrol-blue/80">Alcance: {baseline.scope_note}</p>}
                {baseline.conditions_note && <p className="text-[12px] text-petrol-blue/80">Condiciones: {baseline.conditions_note}</p>}
              </div>
              <span className={cn('rounded-full px-2.5 py-0.5 text-[11.5px] font-medium', baseline.status === 'approved' ? 'bg-accent-mint/45 text-petrol-blue' : baseline.status === 'in_review' ? 'bg-yellow-100 text-yellow-900' : 'bg-petrol-blue/10 text-petrol-blue')}>{STATUS[baseline.status]}</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Figure label="Referencia ajustada × cantidad" value={formatCurrency(totals.reference, baseline.currency)} />
              <Figure label="Adjudicado × cantidad" value={totals.awarded != null ? formatCurrency(totals.awarded, baseline.currency) : 'Sin precios adjudicados'} />
              <Figure label={`Ahorro anualizado (${totals.priced} de ${totals.lines} líneas)`} value={totals.savings != null ? formatCurrency(totals.savings, baseline.currency) : '—'} strong />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[12.5px] text-petrol-blue">
                <thead><tr className="border-b border-petrol-blue/10 text-[11.5px] text-petrol-blue/70">{['Ítem', 'Unidad', 'Precio referencia', 'Ajuste', 'Cantidad proyectada', 'Precio adjudicado', 'Ahorro', ''].map(label => <th key={label} className="px-2 py-1.5 font-medium">{label}</th>)}</tr></thead>
                <tbody>
                  {own.map(line => {
                    const adjusted = line.reference_price * (1 + line.adjustment_pct / 100)
                    return (
                      <tr key={line.id} className="border-b border-petrol-blue/[0.05]">
                        <td className="px-2 py-1.5 font-medium">{line.item}{line.specification && <span className="block text-[11px] font-normal text-petrol-blue/65">{line.specification}</span>}</td>
                        <td className="px-2 py-1.5">{line.unit || '—'}</td>
                        <td className="px-2 py-1.5">{formatCurrency(line.reference_price, baseline.currency)}</td>
                        <td className="px-2 py-1.5">{line.adjustment_pct}%</td>
                        <td className="px-2 py-1.5">{line.projected_qty.toLocaleString('es-CL')}</td>
                        <td className="px-2 py-1.5">{line.awarded_price != null ? formatCurrency(line.awarded_price, baseline.currency) : priceable ? (
                          <input type="number" min="0" className="h-7 w-28 rounded-lg border border-petrol-blue/15 px-2 text-[12px]" placeholder="Sin adjudicar" aria-label={`Precio adjudicado de ${line.item}`}
                            onBlur={event => event.target.value && run(supabase.from('baseline_lines').update({ awarded_price: Number(event.target.value) }).eq('id', line.id), 'Precio adjudicado registrado.')} />
                        ) : 'Sin adjudicar'}</td>
                        <td className="px-2 py-1.5">{line.awarded_price != null ? formatCurrency((adjusted - line.awarded_price) * line.projected_qty, baseline.currency) : '—'}</td>
                        <td className="px-2 py-1.5">{editable && <button type="button" aria-label={`Quitar ${line.item}`} onClick={() => run(supabase.from('baseline_lines').delete().eq('id', line.id), 'Línea quitada.')} className="text-petrol-blue/60 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>}</td>
                      </tr>
                    )
                  })}
                  {own.length === 0 && <tr><td colSpan={8} className="px-2 py-3 text-petrol-blue/65">Sin líneas.</td></tr>}
                </tbody>
              </table>
            </div>

            {editable && (
              <div className="grid gap-2 rounded-xl bg-petrol-blue/[0.03] p-2 sm:grid-cols-7">
                <input className={`${FIELD} sm:col-span-2`} placeholder="Ítem" value={draft.item} onChange={event => setDraft({ ...draft, item: event.target.value })} aria-label="Ítem" />
                <input className={FIELD} placeholder="Unidad" value={draft.unit} onChange={event => setDraft({ ...draft, unit: event.target.value })} aria-label="Unidad" />
                <input type="number" min="0" className={FIELD} placeholder="Precio ref." value={draft.reference} onChange={event => setDraft({ ...draft, reference: event.target.value })} aria-label="Precio de referencia" />
                <input type="number" className={FIELD} placeholder="Ajuste %" value={draft.adjustment} onChange={event => setDraft({ ...draft, adjustment: event.target.value })} aria-label="Ajuste porcentual" />
                <input type="number" min="0" className={FIELD} placeholder="Cantidad" value={draft.qty} onChange={event => setDraft({ ...draft, qty: event.target.value })} aria-label="Cantidad proyectada" />
                <Button size="sm" disabled={!draft.item.trim() || draft.reference === '' || draft.qty === ''} onClick={async () => {
                  const ok = await run(supabase.from('baseline_lines').insert({ company_id: companyId, baseline_id: baseline.id, seq: own.length + 1, item: draft.item.trim(), unit: draft.unit || null, reference_price: Number(draft.reference), adjustment_pct: Number(draft.adjustment || 0), projected_qty: Number(draft.qty) }), 'Línea agregada.')
                  if (ok) setDraft({ item: '', unit: '', reference: '', adjustment: '0', qty: '', awarded: '' })
                }}><Plus className="mr-1 h-3.5 w-3.5" />Agregar</Button>
              </div>
            )}

            {editable && own.length > 0 && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-[12px] text-petrol-blue/80">Quién aprueba
                  <select className={`${FIELD} mt-1 w-64`} value={approver} onChange={event => setApprover(event.target.value)}>
                    <option value="">Elegir…</option>
                    {approvers.filter(person => person.id !== userId).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>
                <Button size="sm" disabled={!approver} onClick={() => run(supabase.rpc('request_approval', { p_kind: 'baseline', p_subject: baseline.id, p_approver: approver }), 'Línea base enviada a aprobación.')}><Send className="mr-1 h-3.5 w-3.5" />Enviar a aprobación</Button>
              </div>
            )}
            {pending && (
              <div className="space-y-2 rounded-xl border border-yellow-200 bg-yellow-50/70 p-3 text-[12.5px] text-petrol-blue">
                <p>En aprobación con {name(pending.approver_id)} desde el {new Date(pending.created_at).toLocaleDateString('es-CL')}.</p>
                {pending.approver_id === userId && !readOnly && (
                  <div className="flex flex-wrap gap-2">
                    <input className={`${FIELD} max-w-sm`} placeholder="Comentario (obligatorio para rechazar)" value={decision} onChange={event => setDecision(event.target.value)} />
                    <Button size="sm" onClick={() => run(supabase.rpc('decide_approval', { p_request: pending.id, p_decision: 'approved', p_note: decision || null }), 'Línea base aprobada.')}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Aprobar</Button>
                    <Button size="sm" variant="outline" disabled={decision.trim().length < 5} onClick={() => run(supabase.rpc('decide_approval', { p_request: pending.id, p_decision: 'rejected', p_note: decision }), 'Línea base devuelta a borrador.')}><XCircle className="mr-1 h-3.5 w-3.5" />Rechazar</Button>
                  </div>
                )}
              </div>
            )}
          </section>
        )
      })}

      {canManage && !readOnly && (
        <details className="rounded-2xl border border-white/70 bg-white/55 p-3">
          <summary className="cursor-pointer text-[13px] font-medium text-petrol-blue">{current.length ? 'Nueva versión o línea base en otra moneda' : 'Preparar la línea base'}</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input className={`${FIELD} sm:col-span-2`} placeholder="Nombre (ej.: Línea base aseo 2027)" value={create.title} onChange={event => setCreate({ ...create, title: event.target.value })} aria-label="Nombre de la línea base" />
            <input className={`${FIELD} uppercase`} maxLength={3} value={create.currency} onChange={event => setCreate({ ...create, currency: event.target.value.toUpperCase() })} aria-label="Moneda" />
            <select className={FIELD} value={create.method} onChange={event => setCreate({ ...create, method: event.target.value })} aria-label="Método">{Object.entries(METHOD).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
            <input type="number" min="1" max="120" className={FIELD} value={create.period} onChange={event => setCreate({ ...create, period: event.target.value })} aria-label="Período en meses" />
            <input className={FIELD} placeholder="Alcance" value={create.scope} onChange={event => setCreate({ ...create, scope: event.target.value })} />
            <input className={`${FIELD} sm:col-span-3`} placeholder="Condiciones de referencia (precios vigentes, reajustes, volumen)" value={create.conditions} onChange={event => setCreate({ ...create, conditions: event.target.value })} />
          </div>
          <Button size="sm" className="mt-2" disabled={!create.title.trim() || create.currency.length !== 3} onClick={() => run(supabase.rpc('create_baseline', { p_project: projectId, p_title: create.title.trim(), p_currency: create.currency, p_method: create.method, p_period_months: Number(create.period || 12), p_scope: create.scope || null, p_conditions: create.conditions || null }), 'Línea base creada en borrador.')}>Crear en borrador</Button>
          <p className="mt-1 text-[11.5px] text-petrol-blue/65">Si ya hay una versión en borrador o en aprobación en esa moneda, queda reemplazada. Una versión aprobada se conserva.</p>
        </details>
      )}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[13px] font-medium text-petrol-blue">Ahorros de la iniciativa</h3>
          <Link href="/ahorros" className="text-[12px] font-medium text-petrol-blue underline">Control de ahorros</Link>
        </div>
        {savings.length === 0 ? <p className="text-[12.5px] text-petrol-blue/70">Aún no hay ahorros declarados. Se declaran desde la adjudicación y los valida otra persona.</p> : (
          <ul className="space-y-1 text-[12.5px] text-petrol-blue">
            {savings.map(row => (
              <li key={row.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-white/60 px-3 py-2">
                <span>{row.nature === 'evitacion_costo' ? 'Costo evitado' : 'Reducción de precio'} · {row.recurrence === 'recurrente' ? 'recurrente' : 'único'} · {SAVINGS_STATUS[row.status] || row.status}</span>
                <span className="font-medium">{formatCurrency(Number(row.validated_amount ?? row.declared_amount), row.currency)}{row.validated_amount == null ? ' (declarado)' : ' (validado)'}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11.5px] text-petrol-blue/65">Negociado no es realizado: el ahorro realizado se reconoce con la ejecución del contrato, no con la adjudicación.</p>
      </section>

      {old.length > 0 && <p className="text-[12px] text-petrol-blue/65">Versiones reemplazadas: {old.map(row => `${row.title} v${row.version} (${row.currency})`).join(' · ')}.</p>}
    </div>
  )
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('rounded-xl px-3 py-2', strong ? 'bg-petrol-blue text-white' : 'bg-petrol-blue/[0.04] text-petrol-blue')}>
      <p className={cn('text-[11.5px]', strong ? 'text-white/75' : 'text-petrol-blue/70')}>{label}</p>
      <p className="text-[15px] font-medium">{value}</p>
    </div>
  )
}
