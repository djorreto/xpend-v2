'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { BlockCard, EmptyHint } from '@/components/workspace-blocks'
import { supabaseBrowser } from '@/lib/supabase'
import { loadPortfolio, personName, type PortfolioData } from '@/lib/portfolio-data'
import { describeHistory, effectiveOwner, type HistoryEntry } from '@/lib/portfolio'

type PlanOwners = {
  id: string
  company_id: string
  category_id?: string | null
  responsible_user_id?: string | null
  backup_user_id?: string | null
  team_id?: string | null
}

const FIELD = 'h-9 w-full rounded-xl border border-petrol-blue/15 bg-white/80 px-3 text-[13px] text-petrol-blue'

// Responsable, suplente, equipo y categoría de una iniciativa, con historial. Solo quien puede gestionar equipos reasigna.
export function InitiativeOwners({ plan, canManage, onChanged }: { plan: PlanOwners; canManage: boolean; onChanged?: () => void }) {
  const [data, setData] = useState<PortfolioData | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ responsible: '', backup: '', team: '', category: '', reason: '' })
  const [message, setMessage] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const supabase = supabaseBrowser()
    Promise.all([
      loadPortfolio(supabase, plan.company_id),
      supabase.from('assignment_history').select('id, entity_type, entity_id, role_kind, from_value, to_value, reason, changed_by, changed_at').eq('entity_id', plan.id).order('changed_at', { ascending: false }).limit(20),
    ]).then(([portfolio, rows]) => {
      setData(portfolio)
      setHistory((rows.data || []) as HistoryEntry[])
    })
  }, [plan.id, plan.company_id, plan.responsible_user_id, plan.backup_user_id, plan.team_id, plan.category_id, version])

  if (!data) return null
  const assignments = new Map(data.assignments.map(item => [item.category_id, item]))
  const owner = effectiveOwner(plan, assignments)
  const person = (id?: string | null) => personName(data.people.find(item => item.id === id))
  const names: Record<string, string> = {}
  for (const item of data.people) names[item.id] = personName(item)
  for (const team of data.teams) names[team.id] = team.name
  for (const category of data.categories) names[category.id] = category.name

  const startEdit = () => {
    setDraft({ responsible: plan.responsible_user_id || '', backup: plan.backup_user_id || '', team: plan.team_id || '', category: plan.category_id || '', reason: '' })
    setEditing(true)
  }

  const save = async () => {
    const { error } = await supabaseBrowser().rpc('assign_initiative', {
      p_plan: plan.id,
      p_responsible: draft.responsible || null,
      p_backup: draft.backup || null,
      p_team: draft.team || null,
      p_category: draft.category || null,
      p_reason: draft.reason || null,
    })
    if (error) {
      setMessage(error.message)
      return
    }
    setMessage('Asignación guardada.')
    setEditing(false)
    setVersion(value => value + 1)
    onChanged?.()
  }

  const team = data.teams.find(item => item.id === (plan.team_id || assignments.get(plan.category_id || '')?.team_id))
  const category = data.categories.find(item => item.id === plan.category_id)

  return (
    <BlockCard title="Responsables" description="Quién lleva esta iniciativa. Los cambios quedan en el historial.">
      <dl className="grid gap-x-6 gap-y-2 text-[13px] text-petrol-blue sm:grid-cols-2" data-testid="iniciativa-responsables">
        <div><dt className="text-[12px] text-petrol-blue/75">Responsable</dt><dd>{owner.userId ? `${person(owner.userId)}${owner.source === 'categoria' ? ' (Category Manager de la categoría)' : ''}` : 'Sin responsable'}</dd></div>
        <div><dt className="text-[12px] text-petrol-blue/75">Suplente</dt><dd>{plan.backup_user_id ? person(plan.backup_user_id) : 'Sin suplente'}</dd></div>
        <div><dt className="text-[12px] text-petrol-blue/75">Equipo de compras</dt><dd>{team?.name || 'Sin equipo'}</dd></div>
        <div><dt className="text-[12px] text-petrol-blue/75">Categoría</dt><dd>{category?.name || 'Sin categoría vinculada'}</dd></div>
      </dl>
      {message && <p role="status" className="mt-2 text-[12.5px] text-petrol-blue">{message}</p>}
      {canManage && !editing && <Button size="sm" variant="outline" className="mt-3" onClick={startEdit}>Cambiar asignación</Button>}
      {canManage && editing && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-[12px] font-medium text-petrol-blue/80">Responsable
            <select className={`${FIELD} mt-1`} value={draft.responsible} onChange={event => setDraft({ ...draft, responsible: event.target.value })}>
              <option value="">Sin responsable</option>
              {data.people.map(item => <option key={item.id} value={item.id}>{personName(item)}</option>)}
            </select>
          </label>
          <label className="text-[12px] font-medium text-petrol-blue/80">Suplente
            <select className={`${FIELD} mt-1`} value={draft.backup} onChange={event => setDraft({ ...draft, backup: event.target.value })}>
              <option value="">Sin suplente</option>
              {data.people.map(item => <option key={item.id} value={item.id}>{personName(item)}</option>)}
            </select>
          </label>
          <label className="text-[12px] font-medium text-petrol-blue/80">Equipo
            <select className={`${FIELD} mt-1`} value={draft.team} onChange={event => setDraft({ ...draft, team: event.target.value })}>
              <option value="">Sin equipo</option>
              {data.teams.filter(item => item.is_active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="text-[12px] font-medium text-petrol-blue/80">Categoría
            <select className={`${FIELD} mt-1`} value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}>
              <option value="">Sin categoría vinculada</option>
              {data.categories.filter(item => item.is_active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="text-[12px] font-medium text-petrol-blue/80 sm:col-span-2">Motivo (obligatorio al reasignar)
            <input className={`${FIELD} mt-1`} value={draft.reason} onChange={event => setDraft({ ...draft, reason: event.target.value })} />
          </label>
          <div className="flex gap-2 sm:col-span-3">
            <Button size="sm" onClick={save}>Guardar asignación</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </div>
      )}
      <div className="mt-4">
        <p className="text-[12px] font-medium text-petrol-blue/75">Historial</p>
        {history.length === 0 ? (
          <EmptyHint>Sin cambios de asignación registrados.</EmptyHint>
        ) : (
          <ul className="mt-1 space-y-1 text-[12.5px] text-petrol-blue/85">
            {history.map(entry => (
              <li key={entry.id}>{describeHistory(entry, names)} · {new Date(entry.changed_at).toLocaleDateString('es-CL')}</li>
            ))}
          </ul>
        )}
      </div>
    </BlockCard>
  )
}
