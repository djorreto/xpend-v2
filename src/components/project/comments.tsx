'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AtSign, Send } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

export type PersonOption = { id: string; name: string; role: string }
type Comment = { id: string; body: string; mentions: string[]; author_id: string; created_at: string; task_id: string | null; deliverable_id: string | null }

// Comentarios con menciones. La base valida que la persona mencionada sea interna y le crea la notificación.
export function Comments({
  companyId,
  projectId,
  taskId = null,
  deliverableId = null,
  people,
  canWrite,
  compact,
}: {
  companyId: string
  projectId: string
  taskId?: string | null
  deliverableId?: string | null
  people: PersonOption[]
  canWrite: boolean
  compact?: boolean
}) {
  const supabase = supabaseBrowser()
  const [items, setItems] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [mentions, setMentions] = useState<string[]>([])
  const [picker, setPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const input = useRef<HTMLTextAreaElement>(null)
  const name = useMemo(() => new Map(people.map(person => [person.id, person.name])), [people])

  const load = useCallback(async () => {
    let query = supabase.from('work_comments').select('id, body, mentions, author_id, created_at, task_id, deliverable_id').eq('project_id', projectId).order('created_at', { ascending: true }).limit(200)
    if (taskId) query = query.eq('task_id', taskId)
    else if (deliverableId) query = query.eq('deliverable_id', deliverableId)
    else query = query.is('task_id', null).is('deliverable_id', null)
    const { data } = await query
    setItems((data || []) as Comment[])
  }, [supabase, projectId, taskId, deliverableId])

  useEffect(() => { load() }, [load])

  const send = async () => {
    if (!body.trim()) return
    setSending(true)
    setError(null)
    const kept = mentions.filter(id => body.includes(`@${name.get(id)}`))
    const { error: insertError } = await supabase.from('work_comments').insert({ company_id: companyId, project_id: projectId, task_id: taskId, deliverable_id: deliverableId, body: body.trim(), mentions: kept })
    setSending(false)
    if (insertError) return setError(insertError.message)
    setBody('')
    setMentions([])
    load()
  }

  const mention = (person: PersonOption) => {
    setBody(current => `${current}${current && !current.endsWith(' ') ? ' ' : ''}@${person.name} `)
    setMentions(current => Array.from(new Set([...current, person.id])))
    setPicker(false)
    input.current?.focus()
  }

  return (
    <div className="space-y-3" data-testid="comentarios">
      {items.length === 0 ? (
        <p className="text-[12.5px] text-petrol-blue/70">Sin comentarios todavía.</p>
      ) : (
        <ul className={compact ? 'max-h-64 space-y-2 overflow-y-auto pr-1' : 'space-y-2'}>
          {items.map(item => (
            <li key={item.id} className="rounded-xl bg-white/70 px-3 py-2">
              <p className="text-[11.5px] text-petrol-blue/70"><span className="font-medium text-petrol-blue">{name.get(item.author_id) || 'Persona del equipo'}</span> · {new Date(item.created_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-petrol-blue">{highlight(item.body, item.mentions.map(id => name.get(id)).filter(Boolean) as string[])}</p>
            </li>
          ))}
        </ul>
      )}
      {canWrite && (
        <div className="relative rounded-xl border border-petrol-blue/15 bg-white/80 p-2">
          <textarea ref={input} value={body} onChange={event => setBody(event.target.value)} rows={2} maxLength={4000} aria-label="Escribe un comentario"
            placeholder="Escribe un comentario. Usa @ para mencionar a alguien del equipo."
            onKeyDown={event => { if (event.key === '@') setPicker(true); if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send() }}
            className="w-full resize-none bg-transparent text-[13px] text-petrol-blue outline-none placeholder:text-petrol-blue/50" />
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setPicker(!picker)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] text-petrol-blue/80 hover:bg-petrol-blue/[0.06]" aria-expanded={picker}>
              <AtSign className="h-3.5 w-3.5" aria-hidden />Mencionar
            </button>
            <Button size="sm" onClick={send} disabled={sending || !body.trim()}><Send className="mr-1 h-3.5 w-3.5" aria-hidden />Comentar</Button>
          </div>
          {picker && (
            <ul className="absolute bottom-full left-2 z-30 mb-1 max-h-56 w-64 overflow-y-auto rounded-xl border border-petrol-blue/10 bg-white p-1 shadow-lg" role="listbox" aria-label="Personas">
              {people.map(person => (
                <li key={person.id}><button type="button" onClick={() => mention(person)} className="w-full rounded-lg px-2 py-1.5 text-left text-[12.5px] text-petrol-blue hover:bg-petrol-blue/[0.06]">{person.name}</button></li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-[12px] text-red-700">{error}</p>}
      {canWrite && <p className="text-[11.5px] text-petrol-blue/60">La persona mencionada recibe un aviso en XPEND. No se envían correos.</p>}
    </div>
  )
}

function highlight(text: string, names: string[]) {
  if (names.length === 0) return text
  const pattern = new RegExp(`(${names.map(item => `@${item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).join('|')})`, 'g')
  return text.split(pattern).map((part, index) => names.some(item => `@${item}` === part) ? <span key={index} className="rounded bg-accent-mint/40 px-0.5 font-medium">{part}</span> : part)
}
