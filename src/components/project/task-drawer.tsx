'use client'

import { useEffect, useState } from 'react'
import { CalendarClock, Check, Lock, Plus, X } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { STATE_PILL } from '@/components/gantt'
import { Comments, type PersonOption } from '@/components/project/comments'
import { ROLE_LABEL, type TaskRole } from '@/lib/methodology'
import { CAUSE_OPTIONS, STATE_LABEL, type TaskView } from '@/lib/project'
import { cn } from '@/lib/utils'

const FIELD = 'h-9 w-full rounded-xl border border-petrol-blue/15 bg-white/80 px-3 text-[13px] text-petrol-blue'
const CAUSE_LABEL: Record<string, string> = { ...Object.fromEntries(CAUSE_OPTIONS.map(item => [item.id, item.label])), arrastre: 'Arrastre de otra tarea' }
const FIELD_LABEL: Record<string, string> = { committed: 'Fechas comprometidas', status: 'Estado', not_applicable: 'No aplica', assignee: 'Responsable' }
const STATUS_TEXT: Record<string, string> = { pending: 'Pendiente', in_progress: 'En curso', done: 'Completada', blocked: 'Bloqueada', true: 'Sí', false: 'No' }

type Change = { id: string; field: string; old_value: string | null; new_value: string | null; cause: string | null; reason: string | null; changed_by: string | null; changed_at: string }

function fmt(date: string | null) {
  if (!date) return 'sin fecha'
  const [y, m, d] = date.split('-')
  return `${d}-${m}-${y}`
}

export function TaskDrawer({
  task,
  subtasks,
  allTasks,
  stageName,
  people,
  companyId,
  projectId,
  userId,
  canManage,
  readOnly,
  onClose,
  onChanged,
}: {
  task: TaskView
  subtasks: TaskView[]
  allTasks: TaskView[]
  stageName: string
  people: PersonOption[]
  companyId: string
  projectId: string
  userId: string
  canManage: boolean
  readOnly: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const supabase = supabaseBrowser()
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [history, setHistory] = useState<Change[]>([])
  const [mode, setMode] = useState<'none' | 'reschedule' | 'block' | 'na'>('none')
  const [form, setForm] = useState({ start: task.committed_start || '', end: task.committed_end || '', cause: '', reason: '', shift: true, note: '' })
  const [newSub, setNewSub] = useState('')
  const name = (id: string | null) => people.find(person => person.id === id)?.name || 'Sin responsable'
  const worker = !readOnly && (canManage || task.assignee_id === userId || task.collaborator_ids.includes(userId))

  useEffect(() => {
    setForm({ start: task.committed_start || '', end: task.committed_end || '', cause: '', reason: '', shift: true, note: '' })
    setMode('none')
    setMessage(null)
    supabase.from('project_task_changes').select('id, field, old_value, new_value, cause, reason, changed_by, changed_at').eq('task_id', task.id).order('changed_at', { ascending: false }).limit(30)
      .then(({ data }) => setHistory((data || []) as Change[]))
  }, [task.id, task.committed_end, task.status, task.not_applicable]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const run = async (action: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await action
    if (error) setMessage({ kind: 'error', text: error.message })
    else {
      setMessage({ kind: 'ok', text: ok })
      setMode('none')
      onChanged()
    }
  }

  const update = (values: Record<string, unknown>, ok: string) => run(supabase.from('project_tasks').update(values).eq('id', task.id), ok)
  const deps = allTasks.filter(item => task.depends_on.includes(item.id))
  const dependents = allTasks.filter(item => item.depends_on.includes(task.id))

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="tarea-titulo">
      <button type="button" className="absolute inset-0 bg-petrol-blue/25 backdrop-blur-[2px]" aria-label="Cerrar" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-[520px] flex-col overflow-hidden bg-[#f7faf9] shadow-2xl" data-testid="panel-tarea">
        <header className="border-b border-petrol-blue/10 bg-white/80 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11.5px] font-medium text-petrol-blue/70">{stageName}{task.code ? ` · Actividad ${task.code}` : ''}{task.is_custom ? ' · Agregada al proyecto' : ''}</p>
              <h2 id="tarea-titulo" className="mt-0.5 text-[17px] font-medium leading-snug text-petrol-blue">{task.title}</h2>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-1.5 text-petrol-blue/70 hover:bg-petrol-blue/[0.06]" aria-label="Cerrar panel"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px]">
            <span className={cn('rounded-full px-2 py-0.5 font-medium', STATE_PILL[task.state])} data-testid="estado-tarea">{STATE_LABEL[task.state]}{task.lateDays ? ` · ${task.lateDays} d` : ''}</span>
            <span className="rounded-full bg-petrol-blue/[0.06] px-2 py-0.5 text-petrol-blue/80">{task.kind === 'milestone' ? 'Hito' : task.kind === 'approval' ? 'Aprobación' : 'Tarea'}</span>
            {task.role && <span className="rounded-full bg-petrol-blue/[0.06] px-2 py-0.5 text-petrol-blue/80">{ROLE_LABEL[task.role as TaskRole] || task.role}</span>}
            {task.optional && <span className="rounded-full bg-petrol-blue/[0.06] px-2 py-0.5 text-petrol-blue/80">Opcional</span>}
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {message && <p role="status" className={cn('rounded-xl px-3 py-2 text-[12.5px]', message.kind === 'ok' ? 'bg-accent-mint/30 text-petrol-blue' : 'bg-red-50 text-red-800')}>{message.text}</p>}

          {task.event_key && (
            <div className="rounded-xl border border-accent-turquoise/40 bg-accent-mint/15 px-3 py-2 text-[12.5px] text-petrol-blue">
              <p className="font-medium">Hito automático: {task.eventLabel}</p>
              <p className="mt-0.5 text-petrol-blue/80">Se cumple cuando el registro real existe en XPEND{task.eventProgress ? ` (${task.eventProgress} procesos formales)` : ''}. No se marca a mano.</p>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
            <div><dt className="text-petrol-blue/70">Original</dt><dd className="font-medium text-petrol-blue">{fmt(task.original_start)} → {fmt(task.original_end)}</dd></div>
            <div><dt className="text-petrol-blue/70">Comprometida</dt><dd className="font-medium text-petrol-blue">{fmt(task.committed_start)} → {fmt(task.committed_end)}</dd></div>
            <div><dt className="text-petrol-blue/70">Fechas reales</dt><dd className="font-medium text-petrol-blue">{task.actual_start ? fmt(task.actual_start) : '—'} → {task.actualEnd ? fmt(task.actualEnd) : '—'}</dd></div>
            <div><dt className="text-petrol-blue/70">Desvío contra el original</dt><dd className={cn('font-medium', task.slipDays > 0 ? 'text-red-700' : 'text-petrol-blue')}>{task.slipDays > 0 ? `+${task.slipDays} días` : task.slipDays < 0 ? `${task.slipDays} días` : 'Sin desvío'}</dd></div>
          </dl>

          <section className="space-y-2">
            <h3 className="text-[13px] font-medium text-petrol-blue">Responsables</h3>
            {canManage && !readOnly ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-[12px] text-petrol-blue/80">Responsable
                  <select className={`${FIELD} mt-1`} value={task.assignee_id || ''} onChange={event => update({ assignee_id: event.target.value || null }, 'Responsable actualizado.')} data-testid="responsable-tarea">
                    <option value="">Sin responsable</option>
                    {people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>
                <label className="text-[12px] text-petrol-blue/80">Agregar colaborador
                  <select className={`${FIELD} mt-1`} value="" onChange={event => event.target.value && update({ collaborator_ids: Array.from(new Set([...task.collaborator_ids, event.target.value])) }, 'Colaborador agregado.')}>
                    <option value="">Elegir…</option>
                    {people.filter(person => person.id !== task.assignee_id && !task.collaborator_ids.includes(person.id)).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>
              </div>
            ) : <p className="text-[12.5px] text-petrol-blue">{name(task.assignee_id)}</p>}
            {task.collaborator_ids.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {task.collaborator_ids.map(id => (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[12px] text-petrol-blue shadow-sm">
                    {name(id)}
                    {canManage && !readOnly && <button type="button" aria-label={`Quitar a ${name(id)}`} onClick={() => update({ collaborator_ids: task.collaborator_ids.filter(item => item !== id) }, 'Colaborador quitado.')}><X className="h-3 w-3" /></button>}
                  </span>
                ))}
              </div>
            )}
          </section>

          {worker && task.state !== 'na' && (
            <section className="space-y-2">
              <h3 className="text-[13px] font-medium text-petrol-blue">Avance</h3>
              <div className="flex flex-wrap gap-2">
                {!task.event_key && task.status !== 'in_progress' && task.status !== 'done' && <Button size="sm" variant="outline" onClick={() => update({ status: 'in_progress' }, 'Tarea en curso.')}>Iniciar</Button>}
                {!task.event_key && task.status !== 'done' && <Button size="sm" onClick={() => update({ status: 'done' }, 'Tarea completada.')} data-testid="completar-tarea"><Check className="mr-1 h-3.5 w-3.5" />Completar</Button>}
                {!task.event_key && task.status === 'done' && <Button size="sm" variant="outline" onClick={() => update({ status: 'in_progress' }, 'Tarea reabierta.')}>Reabrir</Button>}
                {task.status !== 'blocked' && !task.done && <Button size="sm" variant="outline" onClick={() => setMode(mode === 'block' ? 'none' : 'block')}><Lock className="mr-1 h-3.5 w-3.5" />Bloquear</Button>}
                {task.status === 'blocked' && <Button size="sm" variant="outline" onClick={() => update({ status: 'in_progress' }, 'Tarea desbloqueada.')}>Desbloquear</Button>}
                {canManage && task.committed_end && !task.done && <Button size="sm" variant="outline" onClick={() => setMode(mode === 'reschedule' ? 'none' : 'reschedule')} data-testid="reprogramar-tarea"><CalendarClock className="mr-1 h-3.5 w-3.5" />Reprogramar</Button>}
                {canManage && (task.optional || task.is_custom) && <Button size="sm" variant="ghost" onClick={() => setMode(mode === 'na' ? 'none' : 'na')}>No aplica</Button>}
              </div>
              {task.status === 'blocked' && task.block_note && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">Bloqueada ({CAUSE_LABEL[task.block_cause || ''] || 'sin causa'}): {task.block_note}</p>}

              {mode === 'block' && (
                <div className="space-y-2 rounded-xl border border-petrol-blue/10 bg-white/70 p-3">
                  <select className={FIELD} value={form.cause} onChange={event => setForm({ ...form, cause: event.target.value })} aria-label="Causa del bloqueo">
                    <option value="">¿Quién o qué lo bloquea?</option>
                    {CAUSE_OPTIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                  <input className={FIELD} placeholder="Qué falta para seguir" value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} />
                  <Button size="sm" disabled={!form.cause || form.note.trim().length < 3} onClick={() => update({ status: 'blocked', block_cause: form.cause, block_note: form.note }, 'Bloqueo registrado.')}>Registrar bloqueo</Button>
                </div>
              )}
              {mode === 'reschedule' && (
                <div className="space-y-2 rounded-xl border border-petrol-blue/10 bg-white/70 p-3" data-testid="form-reprogramar">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[12px] text-petrol-blue/80">Inicio<input type="date" className={`${FIELD} mt-1`} value={form.start} onChange={event => setForm({ ...form, start: event.target.value })} /></label>
                    <label className="text-[12px] text-petrol-blue/80">Término<input type="date" className={`${FIELD} mt-1`} value={form.end} min={form.start} onChange={event => setForm({ ...form, end: event.target.value })} /></label>
                  </div>
                  <select className={FIELD} value={form.cause} onChange={event => setForm({ ...form, cause: event.target.value })} aria-label="Causa">
                    <option value="">Causa del cambio</option>
                    {CAUSE_OPTIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                  <input className={FIELD} placeholder="Motivo (queda en el historial)" value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} aria-label="Motivo" />
                  <label className="flex items-center gap-2 text-[12px] text-petrol-blue/80"><input type="checkbox" checked={form.shift} onChange={event => setForm({ ...form, shift: event.target.checked })} />Mover también las tareas que dependen de esta ({dependents.length})</label>
                  <Button size="sm" disabled={!form.start || !form.end || !form.cause || form.reason.trim().length < 5}
                    onClick={() => run(supabase.rpc('reschedule_task', { p_task: task.id, p_start: form.start, p_end: form.end, p_cause: form.cause, p_reason: form.reason, p_shift_dependents: form.shift }), 'Tarea reprogramada. La fecha original se conserva.')}>
                    Guardar reprogramación
                  </Button>
                </div>
              )}
              {mode === 'na' && (
                <div className="space-y-2 rounded-xl border border-petrol-blue/10 bg-white/70 p-3">
                  <input className={FIELD} placeholder="Por qué no aplica en este proyecto" value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} />
                  <Button size="sm" disabled={form.reason.trim().length < 5} onClick={() => run(supabase.rpc('set_task_not_applicable', { p_task: task.id, p_value: true, p_reason: form.reason }), 'Marcada como «No aplica».')}>Confirmar</Button>
                </div>
              )}
            </section>
          )}
          {canManage && !readOnly && task.state === 'na' && (
            <div className="rounded-xl bg-petrol-blue/[0.04] px-3 py-2 text-[12.5px] text-petrol-blue">
              No aplica: {task.na_reason}
              <Button size="sm" variant="ghost" className="ml-2" onClick={() => run(supabase.rpc('set_task_not_applicable', { p_task: task.id, p_value: false }), 'La actividad vuelve a aplicar.')}>Volver a aplicar</Button>
            </div>
          )}

          {(deps.length > 0 || dependents.length > 0) && (
            <section className="space-y-1 text-[12.5px] text-petrol-blue">
              <h3 className="text-[13px] font-medium">Dependencias</h3>
              {deps.length > 0 && <p><span className="text-petrol-blue/70">Espera a: </span>{deps.map(item => `${item.code ? `${item.code}. ` : ''}${item.title} (${STATE_LABEL[item.state].toLowerCase()})`).join(' · ')}</p>}
              {dependents.length > 0 && <p><span className="text-petrol-blue/70">Habilita: </span>{dependents.map(item => `${item.code ? `${item.code}. ` : ''}${item.title}`).join(' · ')}</p>}
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-[13px] font-medium text-petrol-blue">Subtareas</h3>
            {subtasks.length === 0 && <p className="text-[12.5px] text-petrol-blue/70">Sin subtareas.</p>}
            <ul className="space-y-1">
              {subtasks.map(sub => {
                const mine = !readOnly && (canManage || sub.assignee_id === userId || sub.collaborator_ids.includes(userId))
                return (
                  <li key={sub.id} className="flex items-center gap-2 rounded-lg bg-white/70 px-2 py-1.5 text-[12.5px] text-petrol-blue">
                    <input type="checkbox" checked={sub.done} disabled={!mine} aria-label={`Completar ${sub.title}`}
                      onChange={() => run(supabase.from('project_tasks').update({ status: sub.done ? 'in_progress' : 'done' }).eq('id', sub.id), sub.done ? 'Subtarea reabierta.' : 'Subtarea completada.')} />
                    <span className={cn('flex-1', sub.done && 'text-petrol-blue/60 line-through')}>{sub.title}</span>
                    <span className="text-[11px] text-petrol-blue/60">{fmt(sub.committed_end)}</span>
                  </li>
                )
              })}
            </ul>
            {canManage && !readOnly && (
              <div className="flex gap-2">
                <input className={FIELD} placeholder="Nueva subtarea" value={newSub} onChange={event => setNewSub(event.target.value)} aria-label="Nueva subtarea" />
                <Button size="sm" variant="outline" disabled={!newSub.trim()} onClick={async () => {
                  await run(supabase.rpc('add_project_task', { p_project: projectId, p_stage_key: task.stage_key, p_title: newSub.trim(), p_parent: task.id, p_start: task.committed_start, p_end: task.committed_end, p_assignee: task.assignee_id }), 'Subtarea agregada.')
                  setNewSub('')
                }}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-[13px] font-medium text-petrol-blue">Comentarios</h3>
            <Comments companyId={companyId} projectId={projectId} taskId={task.id} people={people} canWrite={!readOnly} compact />
          </section>

          <section className="space-y-2">
            <h3 className="text-[13px] font-medium text-petrol-blue">Historial</h3>
            {history.length === 0 ? <p className="text-[12.5px] text-petrol-blue/70">Sin cambios registrados.</p> : (
              <ul className="space-y-1.5 text-[12px] text-petrol-blue" data-testid="historial-tarea">
                {history.map(change => (
                  <li key={change.id} className="rounded-lg bg-white/60 px-2 py-1.5">
                    <p><span className="font-medium">{FIELD_LABEL[change.field] || change.field}:</span> {display(change.field, change.old_value, name)} → {display(change.field, change.new_value, name)}</p>
                    {(change.cause || change.reason) && <p className="text-petrol-blue/75">{change.cause ? `${CAUSE_LABEL[change.cause] || change.cause}. ` : ''}{change.reason}</p>}
                    <p className="text-[11px] text-petrol-blue/60">{change.changed_by ? name(change.changed_by) : 'Sistema'} · {new Date(change.changed_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  )
}

function display(field: string, value: string | null, name: (id: string | null) => string) {
  if (value == null || value === '') return '—'
  if (field === 'assignee') return name(value)
  if (field === 'status' || field === 'not_applicable') return STATUS_TEXT[value] || value
  if (field === 'committed') return value.split(' → ').map(part => fmt(part || null)).join(' → ')
  return value
}
