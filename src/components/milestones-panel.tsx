'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { BlockCard, EmptyHint } from '@/components/workspace-blocks'
import { supabaseBrowser } from '@/lib/supabase'
import { can } from '@/lib/navigation'
import { loadSchedules, type InitiativeSchedule } from '@/lib/annual-plan-data'
import {
  CAUSE_LABEL,
  HEALTH_LABEL,
  MILESTONE_LABEL,
  NO_CAUSE_LABEL,
  STATUS_LABEL,
  delayCause,
  proposeAdjustments,
  type MilestoneStatus,
  type MilestoneView,
  type RescheduleCause,
} from '@/lib/milestones'

type ChangeRow = { id: string; milestone_id: string; field: string; old_value: string | null; new_value: string | null; cause: RescheduleCause | null; reason: string | null; changed_at: string }
type PlanLite = { id: string; company_id: string; plan_year: number; responsible_user_id?: string | null; backup_user_id?: string | null }

export const STATUS_STYLE: Record<MilestoneStatus, string> = {
  completed: 'bg-accent-mint/40 text-petrol-blue',
  blocked: 'bg-amber-100 text-amber-900',
  late: 'bg-red-100 text-red-800',
  due_soon: 'bg-yellow-100 text-yellow-900',
  on_time: 'bg-white text-petrol-blue border border-petrol-blue/15',
  no_date: 'bg-petrol-blue/[0.06] text-petrol-blue/80',
}

const FIELD = 'h-9 rounded-xl border border-petrol-blue/15 bg-white/80 px-3 text-[13px] text-petrol-blue'
const CAUSES = (Object.keys(CAUSE_LABEL) as RescheduleCause[]).filter(cause => cause !== 'arrastre')

export const fmtDate = (value: string | null | undefined) => (value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

const SOURCE_LABEL: Record<string, string> = { manual: 'registrada a mano', rfx: 'desde las bases (RFx)', licitacion: 'desde la licitación', sala: 'desde la sala de ofertas', adjudicacion: 'desde la adjudicación', contrato: 'desde el contrato', proceso: 'desde el primer proceso' }

export function MilestonesPanel({ plan, role, userId }: { plan: PlanLite; role: string; userId: string }) {
  const [schedule, setSchedule] = useState<InitiativeSchedule | null>(null)
  const [changes, setChanges] = useState<ChangeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [form, setForm] = useState<{ id: string; mode: 'reschedule' | 'actual' | 'block'; date: string; cause: string; reason: string } | null>(null)

  const writable = can(role, 'manageTeams') || (role === 'analyst' && (plan.responsible_user_id === userId || plan.backup_user_id === userId))

  const load = useCallback(async () => {
    const supabase = supabaseBrowser()
    const [result] = await loadSchedules(supabase, plan.company_id, plan.plan_year, role, undefined, plan.id)
    setSchedule(result || null)
    const ids = (result?.milestones || []).map(item => item.id)
    if (ids.length) {
      const { data } = await supabase.from('initiative_milestone_changes').select('id, milestone_id, field, old_value, new_value, cause, reason, changed_at').in('milestone_id', ids).order('changed_at', { ascending: false }).limit(30)
      setChanges((data || []) as ChangeRow[])
    } else setChanges([])
    setLoading(false)
  }, [plan.id, plan.company_id, plan.plan_year, role])

  useEffect(() => {
    load()
  }, [load])

  const run = async (action: PromiseLike<{ error: { message: string } | null }>, success: string) => {
    const { error } = await action
    if (error) setMessage({ kind: 'error', text: error.message })
    else {
      setMessage({ kind: 'ok', text: success })
      setForm(null)
      await load()
    }
  }

  if (loading) return null
  const supabase = supabaseBrowser()
  const views = schedule?.milestones || []
  const proposal = schedule ? proposeAdjustments(schedule.projection) : []
  const origin = schedule?.projection.originMilestone

  return (
    <BlockCard
      title="Hitos del proceso"
      description="Siete hitos con fecha original (no cambia), comprometida vigente y real. Los atrasos no se corrigen solos."
    >
      {views.length === 0 ? (
        <EmptyHint>
          Esta iniciativa aún no tiene hitos.{' '}
          {writable ? (
            <>
              Se crean con las fechas que ya existen (inicio, licitación vinculada); no se inventa ninguna.{' '}
              <Button size="sm" className="ml-2" onClick={() => run(supabase.rpc('ensure_milestones', { p_plan: plan.id }), 'Hitos creados con las fechas existentes.')}>Crear los siete hitos</Button>
            </>
          ) : 'Un responsable o un gerente puede crearlos.'}
        </EmptyHint>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-[13px] text-petrol-blue" data-testid="hitos-resumen">
            <span className="rounded-full bg-petrol-blue/[0.06] px-3 py-1 font-medium">{HEALTH_LABEL[schedule!.health]}</span>
            {schedule!.projection.committedEnd && (
              <span>
                Término comprometido {fmtDate(schedule!.projection.committedEnd)}
                {schedule!.projection.endShiftDays > 0 && <> · proyectado {fmtDate(schedule!.projection.projectedEnd)} (+{schedule!.projection.endShiftDays} días)</>}
              </span>
            )}
            {origin && schedule!.projection.endShiftDays > 0 && <span className="text-petrol-blue/80">Origen del impacto: {MILESTONE_LABEL[origin]}</span>}
          </div>
          {message && <p role="status" className={`mb-3 rounded-xl px-3 py-2 text-[13px] ${message.kind === 'ok' ? 'bg-accent-mint/30 text-petrol-blue' : 'bg-red-50 text-red-800'}`}>{message.text}</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[12.5px] text-petrol-blue" data-testid="tabla-hitos">
              <thead>
                <tr className="border-b border-petrol-blue/10 text-[12px] text-petrol-blue/75">
                  <th className="py-2 pr-3 font-medium">Hito</th>
                  <th className="py-2 pr-3 font-medium">Original</th>
                  <th className="py-2 pr-3 font-medium">Comprometida</th>
                  <th className="py-2 pr-3 font-medium">Fecha real</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 font-medium">Desviación</th>
                  <th className="py-2 pr-3 font-medium">Causa</th>
                  {writable && <th className="py-2 font-medium">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {views.map(view => <Row key={view.id} view={view} schedule={schedule!} writable={writable} onForm={setForm} onUnblock={() => run(supabase.rpc('set_milestone_block', { p_milestone: view.id, p_blocked: false }), 'Hito desbloqueado.')} />)}
              </tbody>
            </table>
          </div>

          {form && writable && (
            <div className="mt-3 grid gap-3 rounded-xl border border-petrol-blue/10 bg-white/60 p-3 sm:grid-cols-4" data-testid="hito-formulario">
              <p className="text-[13px] font-medium text-petrol-blue sm:col-span-4">
                {form.mode === 'reschedule' ? 'Reprogramar' : form.mode === 'actual' ? 'Registrar fecha real de' : 'Bloquear'} {MILESTONE_LABEL[views.find(view => view.id === form.id)!.kind]}
              </p>
              {form.mode !== 'block' && (
                <label className="text-[12px] font-medium text-petrol-blue/80">
                  {form.mode === 'reschedule' ? 'Nueva fecha comprometida' : 'Fecha real'}
                  <input type="date" className={`${FIELD} mt-1 block w-full`} value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} />
                </label>
              )}
              {form.mode !== 'actual' && (
                <label className="text-[12px] font-medium text-petrol-blue/80">
                  Causa
                  <select className={`${FIELD} mt-1 block w-full`} value={form.cause} onChange={event => setForm({ ...form, cause: event.target.value })}>
                    <option value="">Elegir causa…</option>
                    {CAUSES.map(cause => <option key={cause} value={cause}>{CAUSE_LABEL[cause]}</option>)}
                  </select>
                </label>
              )}
              <label className="text-[12px] font-medium text-petrol-blue/80 sm:col-span-2">
                {form.mode === 'actual' ? 'Nota (opcional)' : 'Motivo'}
                <input className={`${FIELD} mt-1 block w-full`} value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} />
              </label>
              <div className="flex gap-2 sm:col-span-4">
                <Button size="sm" onClick={() => {
                  if (form.mode === 'reschedule') run(supabase.rpc('reschedule_milestones', { p_changes: [{ id: form.id, date: form.date }], p_cause: form.cause, p_reason: form.reason }), 'Hito reprogramado. La fecha original se conserva.')
                  else if (form.mode === 'actual') run(supabase.rpc('record_milestone_actual', { p_milestone: form.id, p_actual: form.date || null, p_note: form.reason || null }), 'Fecha real registrada.')
                  else run(supabase.rpc('set_milestone_block', { p_milestone: form.id, p_blocked: true, p_cause: form.cause || null, p_note: form.reason }), 'Hito bloqueado.')
                }}>Guardar</Button>
                <Button size="sm" variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
              </div>
            </div>
          )}

          {proposal.length > 0 && (
            <div className="mt-4 rounded-xl border border-dashed border-petrol-blue/20 p-3 text-[13px] text-petrol-blue" data-testid="hitos-propuesta">
              <p className="font-medium">Impacto proyectado en hitos posteriores</p>
              <ul className="mt-1 space-y-0.5 text-petrol-blue/85">
                {proposal.map(item => <li key={item.id}>{MILESTONE_LABEL[item.kind]}: {fmtDate(item.from)} → {fmtDate(item.to)}</li>)}
              </ul>
              <p className="mt-1 text-[12px] text-petrol-blue/75">Es una proyección: ninguna fecha cambia hasta que una persona la confirme.</p>
              {writable && (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => run(
                  supabase.rpc('reschedule_milestones', { p_changes: proposal.map(item => ({ id: item.id, date: item.to })), p_cause: 'arrastre', p_reason: `arrastre del hito ${origin ? MILESTONE_LABEL[origin] : 'anterior'}` }),
                  'Fechas ajustadas. Las originales se conservan.'
                )}>Ajustar siguientes</Button>
              )}
            </div>
          )}

          <div className="mt-4">
            <p className="text-[12px] font-medium text-petrol-blue/75">Historial de cambios</p>
            {changes.length === 0 ? <EmptyHint>Sin cambios registrados.</EmptyHint> : (
              <ul className="mt-1 space-y-1 text-[12.5px] text-petrol-blue/85">
                {changes.slice(0, 12).map(change => (
                  <li key={change.id}>
                    {describeChange(change, views)} · {new Date(change.changed_at).toLocaleDateString('es-CL')}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </BlockCard>
  )
}

function describeChange(change: ChangeRow, views: MilestoneView[]) {
  const label = MILESTONE_LABEL[views.find(view => view.id === change.milestone_id)?.kind as keyof typeof MILESTONE_LABEL] || 'Hito'
  const cause = change.cause ? ` · ${CAUSE_LABEL[change.cause]}` : ''
  const reason = change.reason ? ` (${change.reason})` : ''
  if (change.field === 'committed_date') return `${label}: fecha comprometida ${fmtDate(change.old_value)} → ${fmtDate(change.new_value)}${cause}${reason}`
  if (change.field === 'actual_date') return `${label}: fecha real ${change.new_value ? fmtDate(change.new_value) : 'retirada'}${reason}`
  return `${label}: ${change.new_value === 'true' ? 'bloqueado' : 'desbloqueado'}${cause}${reason}`
}

function Row({ view, schedule, writable, onForm, onUnblock }: {
  view: MilestoneView
  schedule: InitiativeSchedule
  writable: boolean
  onForm: (form: { id: string; mode: 'reschedule' | 'actual' | 'block'; date: string; cause: string; reason: string }) => void
  onUnblock: () => void
}) {
  const cause = view.status === 'late' || view.status === 'blocked' ? delayCause(view, schedule.lastCause[view.id]) : null
  const deviation = view.deviationDays
  return (
    <tr className="border-b border-petrol-blue/[0.06] align-top" data-testid={`hito-${view.kind}`}>
      <td className="py-2 pr-3 font-medium">{view.label}</td>
      <td className="py-2 pr-3">{fmtDate(view.original_date)}</td>
      <td className="py-2 pr-3">{fmtDate(view.committed_date)}</td>
      <td className="py-2 pr-3">
        {fmtDate(view.actual)}
        {view.actualSource && <span className="block text-[11.5px] text-petrol-blue/70">{SOURCE_LABEL[view.actualSource]}</span>}
      </td>
      <td className="py-2 pr-3">
        <span className={`inline-block rounded-full px-2 py-0.5 text-[12px] font-medium ${STATUS_STYLE[view.status]}`}>{STATUS_LABEL[view.status]}</span>
        {view.blockedBy && <span className="block text-[11.5px] text-petrol-blue/75">{view.blockedBy.automatic ? 'Automático: ' : ''}{view.blockedBy.note}</span>}
      </td>
      <td className="py-2 pr-3">
        {deviation == null ? '—' : deviation > 0 ? `+${deviation} d` : deviation < 0 ? `${deviation} d` : '0 d'}
        {view.vsOriginalDays != null && view.vsOriginalDays !== 0 && <span className="block text-[11.5px] text-petrol-blue/70">vs original {view.vsOriginalDays > 0 ? '+' : ''}{view.vsOriginalDays} d</span>}
      </td>
      <td className="py-2 pr-3">{cause ? (cause.cause === 'sin_causa' ? NO_CAUSE_LABEL : cause.label) : '—'}</td>
      {writable && (
        <td className="py-2">
          <div className="flex flex-wrap gap-1.5">
            {!view.actual && <Button size="sm" variant="outline" onClick={() => onForm({ id: view.id, mode: 'reschedule', date: view.committed_date || '', cause: '', reason: '' })}>{view.committed_date ? 'Reprogramar' : 'Fijar fecha'}</Button>}
            {(!view.actual || view.actualSource === 'manual') && <Button size="sm" variant="ghost" onClick={() => onForm({ id: view.id, mode: 'actual', date: view.actual || '', cause: '', reason: '' })}>{view.actualSource === 'manual' ? 'Corregir real' : 'Registrar real'}</Button>}
            {!view.actual && (view.blocked ? <Button size="sm" variant="ghost" onClick={onUnblock}>Desbloquear</Button> : <Button size="sm" variant="ghost" onClick={() => onForm({ id: view.id, mode: 'block', date: '', cause: '', reason: '' })}>Bloquear</Button>)}
          </div>
        </td>
      )}
    </tr>
  )
}
