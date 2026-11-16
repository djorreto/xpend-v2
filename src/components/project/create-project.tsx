'use client'

import { useEffect, useState } from 'react'
import { FolderPlus } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import type { AppSession } from '@/lib/offer-room'
import { todayISO } from '@/lib/project'

const FIELD = 'h-9 w-full rounded-xl border border-petrol-blue/15 bg-white/80 px-3 text-[13px] text-petrol-blue'
type Template = { id: string; name: string; version: number; company_id: string | null; kind: string }
type Initiative = { id: string; title: string; responsible_user_id: string | null; backup_user_id: string | null; status: string | null }

// Crea un proyecto de sourcing desde una iniciativa. Sin plantilla elegida, la base usa la de la categoría o la de la empresa.
export function CreateProject({ session, initiativeId, onCreated, compact }: { session: AppSession; initiativeId?: string; onCreated: (id: string) => void; compact?: boolean }) {
  const supabase = supabaseBrowser()
  const [templates, setTemplates] = useState<Template[]>([])
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [form, setForm] = useState({ initiative: initiativeId || '', title: '', template: '', start: todayISO(), priority: '2' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const manager = ['super_admin', 'admin', 'manager'].includes(session.role)

  useEffect(() => {
    supabase.from('methodology_templates').select('id, name, version, company_id, kind').eq('status', 'published').order('kind').then(({ data }) => setTemplates((data || []) as Template[]))
    if (!initiativeId) {
      supabase.from('sourcing_plans').select('id, title, responsible_user_id, backup_user_id, status').eq('company_id', session.companyId).in('status', ['planned', 'in_progress']).order('title').limit(500)
        .then(({ data }) => setInitiatives(((data || []) as Initiative[]).filter(item => manager || [item.responsible_user_id, item.backup_user_id].includes(session.userId))))
    }
  }, [supabase, session, initiativeId, manager])

  if (!initiativeId && initiatives.length === 0) return null

  const create = async () => {
    setBusy(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('create_sourcing_project', {
      p_initiative: form.initiative, p_title: form.title || null, p_template: form.template || null, p_start: form.start || null, p_priority: Number(form.priority),
    })
    setBusy(false)
    if (rpcError) return setError(rpcError.message)
    onCreated(data as string)
  }

  return (
    <details className={compact ? 'rounded-2xl border border-white/70 bg-white/55 p-3' : 'glass-card p-4'} data-testid="crear-proyecto">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[13.5px] font-medium text-petrol-blue"><FolderPlus className="h-4 w-4" />Crear proyecto de sourcing</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {!initiativeId && (
          <label className="text-[12px] text-petrol-blue/80 lg:col-span-2">Iniciativa
            <select className={`${FIELD} mt-1`} value={form.initiative} onChange={event => setForm({ ...form, initiative: event.target.value })}>
              <option value="">Elegir…</option>
              {initiatives.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
        )}
        <label className={`text-[12px] text-petrol-blue/80 ${initiativeId ? 'lg:col-span-2' : ''}`}>Nombre del proyecto
          <input className={`${FIELD} mt-1`} placeholder="Por defecto, el de la iniciativa" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} />
        </label>
        <label className="text-[12px] text-petrol-blue/80">Metodología
          <select className={`${FIELD} mt-1`} value={form.template} onChange={event => setForm({ ...form, template: event.target.value })} data-testid="metodologia-nuevo-proyecto">
            <option value="">Según la configuración de la empresa</option>
            {templates.map(item => <option key={item.id} value={item.id}>{item.name} · v{item.version}{item.company_id ? '' : ' (XPEND)'}</option>)}
          </select>
        </label>
        <label className="text-[12px] text-petrol-blue/80">Inicio
          <input type="date" className={`${FIELD} mt-1`} value={form.start} onChange={event => setForm({ ...form, start: event.target.value })} />
        </label>
        <label className="text-[12px] text-petrol-blue/80">Prioridad
          <select className={`${FIELD} mt-1`} value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })}>
            <option value="1">Alta</option><option value="2">Media</option><option value="3">Baja</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={busy || !form.initiative} onClick={create}>{busy ? 'Creando…' : 'Crear con su plan de trabajo'}</Button>
        <p className="text-[11.5px] text-petrol-blue/65">Se crean las etapas, actividades, hitos y entregables de la metodología, con fechas calculadas desde el inicio. Después puedes ajustarlas con su motivo.</p>
      </div>
      {error && <p role="alert" className="mt-2 text-[12.5px] text-red-700">{error}</p>}
    </details>
  )
}
