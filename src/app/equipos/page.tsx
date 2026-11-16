'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading'
import { BlockCard, EmptyHint } from '@/components/workspace-blocks'
import { supabaseBrowser } from '@/lib/supabase'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { can } from '@/lib/navigation'
import { loadHistory, loadPortfolio, personName, type PortfolioData } from '@/lib/portfolio-data'
import { assignmentGaps, describeHistory, normalizeName, suggestCategoryLinks, type CategoryAssignment, type HistoryEntry, type PlanLike } from '@/lib/portfolio'

type PlanRow = PlanLike & { title: string; category: string | null; plan_year: number | null; status: string | null }

const FIELD = 'h-9 rounded-xl border border-petrol-blue/15 bg-white/80 px-3 text-[13px] text-petrol-blue'
const TABS = [
  { id: 'categorias', label: 'Categorías' },
  { id: 'equipos', label: 'Equipos' },
  { id: 'iniciativas', label: 'Iniciativas sin categoría' },
  { id: 'historial', label: 'Historial' },
] as const
type TabId = (typeof TABS)[number]['id']

export default function EquiposPage() {
  const router = useRouter()
  const [session, setSession] = useState<AppSession | null>(null)
  const [data, setData] = useState<PortfolioData | null>(null)
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('categorias')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const refresh = useCallback(async (companyId: string) => {
    const supabase = supabaseBrowser()
    const [portfolio, planRows, historyRows] = await Promise.all([
      loadPortfolio(supabase, companyId),
      supabase.from('sourcing_plans').select('id, title, category, category_id, plan_year, status, responsible_user_id, backup_user_id, team_id').eq('company_id', companyId).limit(1000),
      loadHistory(supabase, companyId),
    ])
    setData(portfolio)
    setPlans((planRows.data || []) as PlanRow[])
    setHistory(historyRows)
  }, [])

  useEffect(() => {
    loadAppSession().then(async appSession => {
      if (!appSession) return router.replace('/login')
      if (appSession.role === 'supplier') return router.replace('/sala')
      setSession(appSession)
      if (appSession.companyId) await refresh(appSession.companyId)
      setLoading(false)
    })
  }, [router, refresh])

  const writable = !!session && can(session.role, 'manageTeams')
  const assignments = useMemo(() => new Map((data?.assignments || []).map(item => [item.category_id, item])), [data])
  const people = data?.people || []
  const names = useMemo(() => {
    const map: Record<string, string> = {}
    for (const person of people) map[person.id] = personName(person)
    for (const team of data?.teams || []) map[team.id] = team.name
    for (const category of data?.categories || []) map[category.id] = category.name
    return map
  }, [people, data])

  if (loading || !session || !data) return <MainLayout><LoadingSpinner /></MainLayout>
  const layoutUser = { name: session.name, email: session.email, role: session.role }
  const companyId = session.companyId as string
  const supabase = supabaseBrowser()

  const run = async (action: () => PromiseLike<{ error: { message: string } | null }>, success: string) => {
    const { error } = await action()
    if (error) setMessage({ kind: 'error', text: error.message })
    else {
      setMessage({ kind: 'ok', text: success })
      await refresh(companyId)
    }
    return !error
  }

  const gaps = assignmentGaps(plans, assignments)

  return (
    <MainLayout user={layoutUser} companyName={session.companyName}>
      <div className="space-y-5">
        <div>
          <h1>Equipos y categorías</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-petrol-blue/75">
            Cada categoría tiene un Category Manager y un suplente. Es una asignación, no un rol nuevo. Los equipos de compras son distintos de las
            gerencias solicitantes. Cada reasignación queda en el historial con su motivo.
            {!writable && ' Tu perfil puede ver esta información, pero no modificarla.'}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3" aria-label="Resumen de asignaciones">
          <Summary label="Categorías" value={data.categories.filter(item => item.is_active).length} />
          <Summary label="Iniciativas abiertas sin responsable" value={gaps.withoutOwner.length} />
          <Summary label="Iniciativas abiertas sin categoría" value={gaps.withoutCategory.length} />
        </div>

        {message && (
          <p role="status" className={`rounded-xl px-3 py-2 text-[13px] ${message.kind === 'ok' ? 'bg-accent-mint/30 text-petrol-blue' : 'bg-red-50 text-red-800'}`}>{message.text}</p>
        )}

        <div role="tablist" className="flex flex-wrap gap-1.5">
          {TABS.map(item => (
            <button
              key={item.id}
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${tab === item.id ? 'bg-petrol-blue text-white' : 'border border-petrol-blue/15 bg-white/70 text-petrol-blue hover:bg-white'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'categorias' && (
          <CategoriesTab
            data={data}
            plans={plans}
            assignments={assignments}
            writable={writable}
            userId={session.userId}
            companyId={companyId}
            run={run}
          />
        )}
        {tab === 'equipos' && <TeamsTab data={data} writable={writable} userId={session.userId} companyId={companyId} run={run} />}
        {tab === 'iniciativas' && <UnlinkedTab data={data} plans={plans} writable={writable} run={run} />}
        {tab === 'historial' && (
          <BlockCard title="Cambios de asignación" description="Los más recientes primero. No se pueden editar ni borrar.">
            {history.length === 0 ? (
              <EmptyHint>Todavía no hay asignaciones registradas.</EmptyHint>
            ) : (
              <ul className="divide-y divide-petrol-blue/[0.06]">
                {history.map(entry => (
                  <li key={entry.id} className="py-2.5 text-[13px] text-petrol-blue">
                    <p className="font-medium">{names[entry.entity_id] || (entry.entity_type === 'category' ? 'Categoría' : 'Iniciativa')}</p>
                    <p className="text-petrol-blue/80">{describeHistory(entry, names)}</p>
                    <p className="text-[12px] text-petrol-blue/70">
                      {new Date(entry.changed_at).toLocaleString('es-CL')}
                      {entry.changed_by ? ` · por ${names[entry.changed_by] || 'otro usuario'}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </BlockCard>
        )}
      </div>
    </MainLayout>
  )
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-card p-4">
      <p className="text-[12px] font-medium tracking-wide text-petrol-blue/75">{label}</p>
      <p className="mt-2 text-[1.6rem] font-medium tracking-tight text-petrol-blue">{value}</p>
    </div>
  )
}

type Run = (action: () => PromiseLike<{ error: { message: string } | null }>, success: string) => Promise<boolean>

function CategoriesTab({ data, plans, assignments, writable, userId, companyId, run }: {
  data: PortfolioData
  plans: PlanRow[]
  assignments: Map<string, CategoryAssignment>
  writable: boolean
  userId: string
  companyId: string
  run: Run
}) {
  const supabase = supabaseBrowser()
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ manager: '', backup: '', team: '', reason: '' })
  const [importable, setImportable] = useState<string[] | null>(null)

  const countByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const plan of plans) if (plan.category_id) map.set(plan.category_id, (map.get(plan.category_id) || 0) + 1)
    return map
  }, [plans])

  const startEdit = (categoryId: string) => {
    const current = assignments.get(categoryId)
    setDraft({ manager: current?.manager_user_id || '', backup: current?.backup_user_id || '', team: current?.team_id || '', reason: '' })
    setEditing(categoryId)
  }

  const preview = async () => {
    const [items, initiatives] = await Promise.all([
      supabase.from('si_plan_items').select('category').eq('company_id', companyId).limit(1000),
      supabase.from('sourcing_plans').select('category').eq('company_id', companyId).limit(1000),
    ])
    const known = new Set(data.categories.map(category => normalizeName(category.name)))
    const found = new Map<string, string>()
    for (const row of [...(items.data || []), ...(initiatives.data || [])]) {
      const key = normalizeName(row.category)
      if (key && !known.has(key) && !found.has(key)) found.set(key, String(row.category).trim().replace(/\s+/g, ' '))
    }
    setImportable(Array.from(found.values()).sort())
  }

  return (
    <div className="space-y-4">
      {writable && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <label className="text-[12px] font-medium text-petrol-blue/80">
              Nueva categoría
              <input className={`${FIELD} mt-1 block w-64`} value={newName} onChange={event => setNewName(event.target.value)} placeholder="Ej.: Mantenimiento industrial" />
            </label>
            <Button
              size="sm"
              disabled={!newName.trim()}
              onClick={async () => {
                const ok = await run(() => supabase.from('procurement_categories').insert({ company_id: companyId, name: newName.trim(), source: 'manual', created_by: userId }), 'Categoría creada.')
                if (ok) setNewName('')
              }}
            >
              Crear categoría
            </Button>
            <Button size="sm" variant="outline" onClick={preview}>Traer desde el gasto y el plan</Button>
          </CardContent>
          {importable && (
            <CardContent className="border-t border-petrol-blue/[0.06] p-4 text-[13px] text-petrol-blue">
              {importable.length === 0 ? (
                <p>No hay nombres nuevos en el análisis de gasto ni en el plan.</p>
              ) : (
                <>
                  <p className="font-medium">{importable.length} nombres existentes que aún no son categorías:</p>
                  <p className="mt-1 text-petrol-blue/80">{importable.slice(0, 12).join(' · ')}{importable.length > 12 ? ' …' : ''}</p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={async () => {
                      const rows = importable.map(name => ({ company_id: companyId, name, source: 'taxonomia_spend', taxonomy_ref: name, created_by: userId }))
                      const ok = await run(() => supabase.from('procurement_categories').insert(rows), `${rows.length} categorías creadas desde nombres existentes.`)
                      if (ok) setImportable(null)
                    }}
                  >
                    Crear estas categorías
                  </Button>
                </>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {data.categories.length === 0 ? (
        <EmptyHint>Todavía no hay categorías. {writable ? 'Crea una o tráelas desde el análisis de gasto.' : 'Un gerente o administrador puede crearlas.'}</EmptyHint>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-petrol-blue/[0.06]">
              {data.categories.map(category => {
                const current = assignments.get(category.id)
                const person = (id?: string | null) => personName(data.people.find(item => item.id === id))
                return (
                  <li key={category.id} className="px-4 py-3" data-testid="categoria-fila">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-petrol-blue">{category.name}{!category.is_active && ' (inactiva)'}</p>
                        <p className="text-[12.5px] text-petrol-blue/80">
                          Category Manager: {current?.manager_user_id ? person(current.manager_user_id) : 'Sin asignar'}
                          {' · '}Suplente: {current?.backup_user_id ? person(current.backup_user_id) : 'Sin asignar'}
                          {' · '}Equipo: {data.teams.find(team => team.id === current?.team_id)?.name || 'Sin equipo'}
                        </p>
                        <p className="text-[12px] text-petrol-blue/70">{countByCategory.get(category.id) || 0} iniciativas vinculadas</p>
                      </div>
                      {writable && editing !== category.id && (
                        <Button size="sm" variant="outline" onClick={() => startEdit(category.id)}>{current ? 'Reasignar' : 'Asignar'}</Button>
                      )}
                    </div>
                    {writable && editing === category.id && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-4">
                        <PersonSelect label="Category Manager" value={draft.manager} onChange={value => setDraft({ ...draft, manager: value })} people={data.people} />
                        <PersonSelect label="Suplente" value={draft.backup} onChange={value => setDraft({ ...draft, backup: value })} people={data.people} />
                        <label className="text-[12px] font-medium text-petrol-blue/80">
                          Equipo
                          <select className={`${FIELD} mt-1 block w-full`} value={draft.team} onChange={event => setDraft({ ...draft, team: event.target.value })}>
                            <option value="">Sin equipo</option>
                            {data.teams.filter(team => team.is_active).map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                          </select>
                        </label>
                        <label className="text-[12px] font-medium text-petrol-blue/80">
                          Motivo {current ? '(obligatorio al reasignar)' : '(opcional)'}
                          <input className={`${FIELD} mt-1 block w-full`} value={draft.reason} onChange={event => setDraft({ ...draft, reason: event.target.value })} />
                        </label>
                        <div className="flex gap-2 sm:col-span-4">
                          <Button
                            size="sm"
                            onClick={async () => {
                              const ok = await run(
                                () => supabase.rpc('assign_category', { p_category: category.id, p_manager: draft.manager || null, p_backup: draft.backup || null, p_team: draft.team || null, p_reason: draft.reason || null }),
                                'Asignación guardada.'
                              )
                              if (ok) setEditing(null)
                            }}
                          >
                            Guardar asignación
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function PersonSelect({ label, value, onChange, people }: { label: string; value: string; onChange: (value: string) => void; people: PortfolioData['people'] }) {
  return (
    <label className="text-[12px] font-medium text-petrol-blue/80">
      {label}
      <select className={`${FIELD} mt-1 block w-full`} value={value} onChange={event => onChange(event.target.value)}>
        <option value="">Sin asignar</option>
        {people.map(person => <option key={person.id} value={person.id}>{personName(person)}</option>)}
      </select>
    </label>
  )
}

function TeamsTab({ data, writable, userId, companyId, run }: { data: PortfolioData; writable: boolean; userId: string; companyId: string; run: Run }) {
  const supabase = supabaseBrowser()
  const [name, setName] = useState('')
  const [adding, setAdding] = useState<Record<string, string>>({})
  return (
    <div className="space-y-4">
      {writable && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <label className="text-[12px] font-medium text-petrol-blue/80">
              Nuevo equipo de compras
              <input className={`${FIELD} mt-1 block w-64`} value={name} onChange={event => setName(event.target.value)} placeholder="Ej.: Compras industriales" />
            </label>
            <Button
              size="sm"
              disabled={!name.trim()}
              onClick={async () => {
                const ok = await run(() => supabase.from('procurement_teams').insert({ company_id: companyId, name: name.trim(), created_by: userId }), 'Equipo creado.')
                if (ok) setName('')
              }}
            >
              Crear equipo
            </Button>
          </CardContent>
        </Card>
      )}
      {data.teams.length === 0 ? (
        <EmptyHint>Todavía no hay equipos de compras. No son lo mismo que las gerencias solicitantes.</EmptyHint>
      ) : (
        data.teams.map(team => {
          const members = data.members.filter(member => member.team_id === team.id)
          const available = data.people.filter(person => !members.some(member => member.user_id === person.id))
          return (
            <BlockCard key={team.id} title={`${team.name}${team.is_active ? '' : ' (inactivo)'}`} description={`${members.length} integrantes`}>
              {members.length === 0 ? (
                <EmptyHint>Sin integrantes.</EmptyHint>
              ) : (
                <ul className="divide-y divide-petrol-blue/[0.06]">
                  {members.map(member => (
                    <li key={member.user_id} className="flex items-center justify-between gap-3 py-2 text-[13px] text-petrol-blue">
                      <span>{personName(data.people.find(person => person.id === member.user_id))}{member.member_role === 'lead' ? ' · Líder' : ''}</span>
                      {writable && (
                        <span className="flex gap-2">
                          {member.member_role !== 'lead' && (
                            <Button size="sm" variant="outline" onClick={() => run(async () => {
                              const first = await supabase.from('procurement_team_members').update({ member_role: 'member' }).eq('team_id', team.id).eq('member_role', 'lead')
                              if (first.error) return first
                              const second = await supabase.from('procurement_team_members').update({ member_role: 'lead' }).eq('team_id', team.id).eq('user_id', member.user_id)
                              if (second.error) return second
                              return supabase.from('procurement_teams').update({ lead_user_id: member.user_id }).eq('id', team.id)
                            }, 'Líder actualizado.')}>Hacer líder</Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => run(() => supabase.from('procurement_team_members').delete().eq('team_id', team.id).eq('user_id', member.user_id), 'Integrante retirado.')}>Retirar</Button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {writable && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <select aria-label={`Agregar integrante a ${team.name}`} className={`${FIELD} w-56`} value={adding[team.id] || ''} onChange={event => setAdding({ ...adding, [team.id]: event.target.value })}>
                    <option value="">Agregar integrante…</option>
                    {available.map(person => <option key={person.id} value={person.id}>{personName(person)}</option>)}
                  </select>
                  <Button size="sm" variant="outline" disabled={!adding[team.id]} onClick={async () => {
                    const ok = await run(() => supabase.from('procurement_team_members').insert({ team_id: team.id, company_id: companyId, user_id: adding[team.id], added_by: userId }), 'Integrante agregado.')
                    if (ok) setAdding({ ...adding, [team.id]: '' })
                  }}>Agregar</Button>
                  <Button size="sm" variant="ghost" onClick={() => run(() => supabase.from('procurement_teams').update({ is_active: !team.is_active }).eq('id', team.id), team.is_active ? 'Equipo desactivado. Su historial se conserva.' : 'Equipo reactivado.')}>
                    {team.is_active ? 'Desactivar equipo' : 'Reactivar equipo'}
                  </Button>
                </div>
              )}
            </BlockCard>
          )
        })
      )}
    </div>
  )
}

function UnlinkedTab({ data, plans, writable, run }: { data: PortfolioData; plans: PlanRow[]; writable: boolean; run: Run }) {
  const supabase = supabaseBrowser()
  const unlinked = plans.filter(plan => !plan.category_id && plan.status !== 'completed' && plan.status !== 'cancelled')
  const suggestions = useMemo(() => new Map(suggestCategoryLinks(unlinked, data.categories).map(item => [item.planId, item])), [unlinked, data.categories])
  const exact = Array.from(suggestions.values()).filter(item => item.kind === 'exact')
  const [choice, setChoice] = useState<Record<string, string>>({})

  if (unlinked.length === 0) return <EmptyHint>Todas las iniciativas abiertas tienen categoría vinculada.</EmptyHint>
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-[13px] text-petrol-blue/80">
        Estas iniciativas guardan la categoría como texto libre. Solo se sugiere vincular cuando el nombre coincide exactamente; el resto lo decide una persona y nada se reasigna solo.
      </p>
      {writable && exact.length > 0 && (
        <Button size="sm" onClick={async () => {
          for (const item of exact) {
            if (item.kind !== 'exact') continue
            const result = await supabase.rpc('assign_initiative', { ...assignArgs(plans.find(plan => plan.id === item.planId)!), p_category: item.categoryId, p_reason: 'Vínculo por coincidencia exacta de nombre' })
            if (result.error) return run(async () => result, '')
          }
          await run(async () => ({ error: null }), `${exact.length} iniciativas vinculadas por coincidencia exacta.`)
        }}>
          Vincular {exact.length} coincidencias exactas
        </Button>
      )}
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-petrol-blue/[0.06]">
            {unlinked.map(plan => {
              const suggestion = suggestions.get(plan.id)
              const selected = choice[plan.id] ?? (suggestion?.kind === 'exact' ? suggestion.categoryId : '')
              return (
                <li key={plan.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" data-testid="iniciativa-sin-categoria">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-petrol-blue">{plan.title}</p>
                    <p className="text-[12.5px] text-petrol-blue/80">
                      Categoría escrita: {plan.category || 'ninguna'}
                      {suggestion?.kind === 'exact' && ' · coincidencia exacta'}
                      {suggestion?.kind === 'ambiguous' && ' · coincidencia ambigua, elige una persona'}
                    </p>
                  </div>
                  {writable && (
                    <div className="flex items-center gap-2">
                      <select aria-label={`Categoría para ${plan.title}`} className={`${FIELD} w-56`} value={selected} onChange={event => setChoice({ ...choice, [plan.id]: event.target.value })}>
                        <option value="">Elegir categoría…</option>
                        {data.categories.filter(category => category.is_active).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                      <Button size="sm" variant="outline" disabled={!selected} onClick={() => run(
                        () => supabase.rpc('assign_initiative', { ...assignArgs(plan), p_category: selected, p_reason: 'Vínculo manual con categoría' }),
                        'Iniciativa vinculada.'
                      )}>Vincular</Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function assignArgs(plan: PlanRow) {
  return { p_plan: plan.id, p_responsible: plan.responsible_user_id || null, p_backup: plan.backup_user_id || null, p_team: plan.team_id || null }
}
