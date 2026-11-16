'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Eye, FileUp, MessageSquare, Send, XCircle } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Comments, type PersonOption } from '@/components/project/comments'
import { projectDocumentPath } from '@/lib/storage-paths'
import { DELIVERABLE_LABEL, type DeliverableView, type TaskView } from '@/lib/project'
import type { ApprovalRequest } from '@/lib/project-data'
import { cn } from '@/lib/utils'

const FIELD = 'h-9 w-full rounded-xl border border-petrol-blue/15 bg-white/80 px-3 text-[13px] text-petrol-blue'
export const DELIVERABLE_PILL: Record<DeliverableView['status'], string> = {
  pending: 'bg-white text-petrol-blue/80 border border-petrol-blue/15',
  draft: 'bg-petrol-blue/10 text-petrol-blue',
  in_review: 'bg-yellow-100 text-yellow-900',
  approved: 'bg-accent-mint/45 text-petrol-blue',
  rejected: 'bg-red-100 text-red-800',
  not_applicable: 'bg-petrol-blue/[0.05] text-petrol-blue/60',
}

type Version = { id: string; deliverable_id: string; version: number; storage_path: string; file_name: string; size_bytes: number | null; note: string | null; uploaded_by: string | null; uploaded_at: string }

function fmt(date: string | null) {
  if (!date) return 'sin fecha'
  const [y, m, d] = date.slice(0, 10).split('-')
  return `${d}-${m}-${y}`
}

export function DeliverablesPanel({
  deliverables,
  stages,
  tasks,
  approvals,
  people,
  approvers,
  companyId,
  projectId,
  userId,
  canManage,
  readOnly,
  focusId,
  onChanged,
}: {
  deliverables: DeliverableView[]
  stages: { key: string; name: string }[]
  tasks: TaskView[]
  approvals: ApprovalRequest[]
  people: PersonOption[]
  approvers: PersonOption[]
  companyId: string
  projectId: string
  userId: string
  canManage: boolean
  readOnly: boolean
  focusId?: string | null
  onChanged: () => void
}) {
  const supabase = supabaseBrowser()
  const [versions, setVersions] = useState<Version[]>([])
  const [open, setOpen] = useState<string | null>(focusId || null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [request, setRequest] = useState({ approver: '', note: '' })
  const [decision, setDecision] = useState('')
  const name = (id: string | null) => people.find(person => person.id === id)?.name || 'Persona del equipo'

  const loadVersions = useCallback(async () => {
    const { data } = await supabase.from('deliverable_versions').select('id, deliverable_id, version, storage_path, file_name, size_bytes, note, uploaded_by, uploaded_at').eq('project_id', projectId).order('version', { ascending: false })
    setVersions((data || []) as Version[])
  }, [supabase, projectId])
  useEffect(() => { loadVersions() }, [loadVersions])
  useEffect(() => { if (focusId) setOpen(focusId) }, [focusId])

  const done = (text: string) => {
    setMessage({ kind: 'ok', text })
    loadVersions()
    onChanged()
  }
  const fail = (text: string) => setMessage({ kind: 'error', text })

  const upload = async (item: DeliverableView, file: File) => {
    if (file.size > 20 * 1024 * 1024) return fail('El archivo supera 20 MB.')
    setBusy(item.id)
    try {
      const path = projectDocumentPath(companyId, projectId, item.deliverable_key, item.current_version + 1, file.name)
      const stored = await supabase.storage.from('documents').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
      if (stored.error) return fail(`No se pudo subir el documento: ${stored.error.message}`)
      const { error } = await supabase.rpc('add_deliverable_version', { p_deliverable: item.id, p_path: path, p_file_name: file.name, p_mime: file.type || null, p_size: file.size })
      if (error) {
        await supabase.storage.from('documents').remove([path])
        return fail(error.message)
      }
      done(`Versión v${item.current_version + 1} de «${item.title}» guardada.`)
    } catch (error) {
      fail(error instanceof Error ? error.message : 'No se pudo subir el documento.')
    } finally {
      setBusy(null)
    }
  }

  const view = async (version: Version) => {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(version.storage_path, 120)
    if (error || !data) return fail('No tienes acceso a este documento o ya no existe.')
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  const call = async (action: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await action
    if (error) fail(error.message)
    else done(ok)
  }

  return (
    <div className="space-y-4" data-testid="entregables">
      {message && <p role="status" className={cn('rounded-xl px-3 py-2 text-[12.5px]', message.kind === 'ok' ? 'bg-accent-mint/30 text-petrol-blue' : 'bg-red-50 text-red-800')}>{message.text}</p>}
      {stages.map(stage => {
        const items = deliverables.filter(item => item.stage_key === stage.key)
        if (items.length === 0) return null
        return (
          <section key={stage.key} className="space-y-2">
            <h3 className="text-[12.5px] font-medium uppercase tracking-[0.12em] text-petrol-blue/60">{stage.name}</h3>
            <ul className="space-y-2">
              {items.map(item => {
                const itemVersions = versions.filter(version => version.deliverable_id === item.id)
                const pending = approvals.find(row => row.subject_id === item.id && row.status === 'pending')
                const history = approvals.filter(row => row.subject_id === item.id && row.status !== 'pending')
                const responsibleTask = tasks.find(task => task.deliverable_key === item.deliverable_key && !task.parent_id)
                const canUpload = !readOnly && (canManage || responsibleTask?.assignee_id === userId) && !['in_review', 'approved', 'not_applicable'].includes(item.status)
                const isOpen = open === item.id
                return (
                  <li key={item.id} className={cn('rounded-2xl border bg-white/70 transition-shadow', isOpen ? 'border-petrol-blue/20 shadow-md' : 'border-white/70')} data-testid="entregable" data-key={item.deliverable_key}>
                    <button type="button" onClick={() => setOpen(isOpen ? null : item.id)} aria-expanded={isOpen} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left">
                      <span className="min-w-0">
                        <span className="block text-[14px] font-medium text-petrol-blue">{item.title}</span>
                        <span className="block text-[12px] text-petrol-blue/70">
                          {item.current_version ? `v${item.current_version}` : 'Sin versión'} · vence {fmt(item.due_date)}{item.requires_approval ? ' · requiere aprobación' : ''}
                          {item.overdue && <span className="ml-1 font-medium text-red-700">· vencido</span>}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        {item.waitingMe && <span className="rounded-full bg-petrol-blue px-2 py-0.5 text-[11px] font-medium text-white">Te espera</span>}
                        <span className={cn('rounded-full px-2.5 py-0.5 text-[11.5px] font-medium', DELIVERABLE_PILL[item.status])}>{DELIVERABLE_LABEL[item.status]}</span>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="space-y-4 border-t border-petrol-blue/[0.07] px-4 py-3">
                        {item.description && <p className="text-[12.5px] text-petrol-blue/80">{item.description}</p>}
                        {item.status === 'approved' && (
                          <p className="flex items-center gap-1.5 rounded-xl bg-accent-mint/25 px-3 py-2 text-[12.5px] text-petrol-blue"><CheckCircle2 className="h-4 w-4" />Aprobado por {name(item.approved_by)} el {fmt(item.approved_at)}{item.approved_version ? ` (versión v${item.approved_version})` : ''}{item.decision_note ? `: ${item.decision_note}` : ''}</p>
                        )}
                        {item.status === 'rejected' && <p className="rounded-xl bg-red-50 px-3 py-2 text-[12.5px] text-red-800">Rechazado: {item.decision_note}. Sube una nueva versión y vuelve a pedir la aprobación.</p>}

                        <div className="space-y-1.5">
                          <p className="text-[12.5px] font-medium text-petrol-blue">Versiones</p>
                          {itemVersions.length === 0 ? <p className="text-[12.5px] text-petrol-blue/70">Todavía no hay documentos.</p> : (
                            <ul className="divide-y divide-petrol-blue/[0.06] rounded-xl bg-white/80">
                              {itemVersions.map(version => (
                                <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[12.5px] text-petrol-blue">
                                  <span className="min-w-0"><span className="font-medium">v{version.version}</span> · {version.file_name}<span className="block text-[11.5px] text-petrol-blue/65">{name(version.uploaded_by)} · {new Date(version.uploaded_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}{version.size_bytes ? ` · ${Math.max(1, Math.round(version.size_bytes / 1024))} KB` : ''}</span></span>
                                  <Button size="sm" variant="outline" onClick={() => view(version)} data-testid="ver-documento"><Eye className="mr-1 h-3.5 w-3.5" />Ver</Button>
                                </li>
                              ))}
                            </ul>
                          )}
                          {canUpload && (
                            <label className={cn('inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-petrol-blue/15 bg-white px-3 py-1.5 text-[12.5px] font-medium text-petrol-blue hover:bg-petrol-blue/[0.04]', busy === item.id && 'opacity-60')}>
                              <FileUp className="h-3.5 w-3.5" />{busy === item.id ? 'Subiendo…' : item.current_version ? 'Subir nueva versión' : 'Subir documento'}
                              <input type="file" className="sr-only" disabled={busy === item.id} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) upload(item, file) }} data-testid="subir-entregable" />
                            </label>
                          )}
                        </div>

                        {item.requires_approval && !readOnly && canManage && ['draft', 'rejected'].includes(item.status) && (
                          <div className="space-y-2 rounded-xl border border-petrol-blue/10 bg-white/70 p-3" data-testid="pedir-aprobacion">
                            <p className="text-[12.5px] font-medium text-petrol-blue">Pedir aprobación</p>
                            <select className={FIELD} value={request.approver} onChange={event => setRequest({ ...request, approver: event.target.value })} aria-label="Quién aprueba">
                              <option value="">¿Quién aprueba?</option>
                              {approvers.filter(person => person.id !== userId).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                            </select>
                            <input className={FIELD} placeholder="Nota para quien aprueba (opcional)" value={request.note} onChange={event => setRequest({ ...request, note: event.target.value })} />
                            <Button size="sm" disabled={!request.approver} onClick={async () => { await call(supabase.rpc('request_approval', { p_kind: 'deliverable', p_subject: item.id, p_approver: request.approver, p_note: request.note || null }), 'Aprobación pedida. Quien aprueba recibió un aviso.'); setRequest({ approver: '', note: '' }) }}>
                              <Send className="mr-1 h-3.5 w-3.5" />Enviar a aprobación
                            </Button>
                            <p className="text-[11.5px] text-petrol-blue/65">Quien aprueba no puede ser quien pidió ni quien subió la versión.</p>
                          </div>
                        )}
                        {pending && (
                          <div className="space-y-2 rounded-xl border border-yellow-200 bg-yellow-50/70 p-3">
                            <p className="text-[12.5px] text-petrol-blue">Pedida por {name(pending.requested_by)} a <span className="font-medium">{name(pending.approver_id)}</span> el {fmt(pending.created_at)} (versión v{pending.subject_version}).{pending.request_note ? ` «${pending.request_note}»` : ''}</p>
                            {pending.approver_id === userId && !readOnly && (
                              <div className="space-y-2" data-testid="decidir-aprobacion">
                                <input className={FIELD} placeholder="Comentario (obligatorio para rechazar)" value={decision} onChange={event => setDecision(event.target.value)} />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={async () => { await call(supabase.rpc('decide_approval', { p_request: pending.id, p_decision: 'approved', p_note: decision || null }), 'Entregable aprobado.'); setDecision('') }}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Aprobar</Button>
                                  <Button size="sm" variant="outline" disabled={decision.trim().length < 5} onClick={async () => { await call(supabase.rpc('decide_approval', { p_request: pending.id, p_decision: 'rejected', p_note: decision }), 'Entregable rechazado con comentario.'); setDecision('') }}><XCircle className="mr-1 h-3.5 w-3.5" />Rechazar</Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {history.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[12.5px] font-medium text-petrol-blue">Decisiones anteriores</p>
                            <ul className="space-y-1 text-[12px] text-petrol-blue/80">
                              {history.map(row => <li key={row.id}>{row.status === 'approved' ? 'Aprobada' : row.status === 'rejected' ? 'Rechazada' : 'Reemplazada'} v{row.subject_version} por {name(row.approver_id)} el {fmt(row.decided_at)}{row.decision_note ? ` · ${row.decision_note}` : ''}</li>)}
                            </ul>
                          </div>
                        )}
                        {!item.requires_approval && canManage && !readOnly && item.status === 'pending' && (
                          <NotApplicable onConfirm={reason => call(supabase.from('project_deliverables').update({ status: 'not_applicable', na_reason: reason }).eq('id', item.id), 'Entregable marcado como «No aplica».')} />
                        )}
                        <details className="group">
                          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12.5px] font-medium text-petrol-blue"><MessageSquare className="h-3.5 w-3.5" />Comentarios del entregable</summary>
                          <div className="mt-2"><Comments companyId={companyId} projectId={projectId} deliverableId={item.id} people={people} canWrite={!readOnly} compact /></div>
                        </details>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function NotApplicable({ onConfirm }: { onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  return (
    <div className="flex gap-2">
      <input className={FIELD} placeholder="Si no aplica, explica por qué" value={reason} onChange={event => setReason(event.target.value)} />
      <Button size="sm" variant="ghost" disabled={reason.trim().length < 5} onClick={() => onConfirm(reason)}>No aplica</Button>
    </div>
  )
}
