'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, CheckCircle2, Copy, Eye, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { MainLayout } from '@/components/layout/main-layout'
import { LoadingSpinner } from '@/components/ui/loading'
import { Button } from '@/components/ui/button'
import { BlockCard, EmptyHint } from '@/components/workspace-blocks'
import { supabaseBrowser } from '@/lib/supabase'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { ROLE_LABEL, STANDARD_EVENTS, REQUIRED_EVENTS, validateDefinition, type MethodologyDefinition, type StandardEvent, type TaskDef, type TaskRole } from '@/lib/methodology'
import { cn } from '@/lib/utils'

const FIELD = 'h-8 w-full rounded-lg border border-petrol-blue/15 bg-white/85 px-2 text-[12.5px] text-petrol-blue'
const KIND_LABEL = { task: 'Tarea', milestone: 'Hito', approval: 'Aprobación' } as const
const STATUS_LABEL: Record<string, string> = { draft: 'Borrador', published: 'Publicada', archived: 'Versión anterior' }

type Template = { id: string; company_id: string | null; template_key: string; kind: 'light' | 'complete' | 'custom'; name: string; description: string | null; version: number; status: string; definition: MethodologyDefinition; based_on_id: string | null; published_at: string | null }
type Assignment = { category_id: string | null; template_key: string; template_company_id: string | null }
type Category = { id: string; name: string; parent_id: string | null }

export default function MethodologyPage() {
  const router = useRouter()
  const [session, setSession] = useState<AppSession | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [usage, setUsage] = useState<Map<string, number>>(new Map())
  const [preview, setPreview] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; name: string; definition: MethodologyDefinition } | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [create, setCreate] = useState({ from: '', name: '' })

  const refresh = useCallback(async (companyId: string) => {
    const supabase = supabaseBrowser()
    const [tpl, asg, cats, projects] = await Promise.all([
      supabase.from('methodology_templates').select('id, company_id, template_key, kind, name, description, version, status, definition, based_on_id, published_at').order('kind').order('version', { ascending: false }),
      supabase.from('methodology_assignments').select('category_id, template_key, template_company_id').eq('company_id', companyId),
      supabase.from('procurement_categories').select('id, name, parent_id').eq('company_id', companyId).eq('is_active', true).order('name'),
      supabase.from('sourcing_projects').select('template_id').eq('company_id', companyId).limit(2000),
    ])
    setTemplates((tpl.data || []) as Template[])
    setAssignments((asg.data || []) as Assignment[])
    setCategories((cats.data || []) as Category[])
    const counts = new Map<string, number>()
    for (const row of (projects.data || []) as { template_id: string | null }[]) if (row.template_id) counts.set(row.template_id, (counts.get(row.template_id) || 0) + 1)
    setUsage(counts)
  }, [])

  useEffect(() => {
    loadAppSession().then(async appSession => {
      if (!appSession) return router.replace('/login')
      if (appSession.role === 'supplier') return router.replace('/sala')
      setSession(appSession)
      if (appSession.companyId) await refresh(appSession.companyId)
    })
  }, [router, refresh])

  const published = useMemo(() => templates.filter(item => item.status === 'published'), [templates])
  if (!session) return <MainLayout><LoadingSpinner /></MainLayout>
  const companyId = session.companyId as string
  const isAdmin = ['super_admin', 'admin'].includes(session.role)
  const isManager = isAdmin || session.role === 'manager'
  const supabase = supabaseBrowser()
  const companyDefault = assignments.find(item => item.category_id === null)
  const effective = (key: string | undefined, owner: string | null | undefined) => published.find(item => item.template_key === (key || 'light') && item.company_id === (key ? owner ?? null : null))
  const defaultTemplate = effective(companyDefault?.template_key, companyDefault?.template_company_id)

  const run = async (action: PromiseLike<{ error: { message: string } | null; data?: unknown }>, ok: string) => {
    const result = await action
    if (result.error) { setMessage({ kind: 'error', text: result.error.message }); return null }
    setMessage({ kind: 'ok', text: ok })
    await refresh(companyId)
    return result.data ?? true
  }

  const assign = (category: string | null, value: string) => {
    if (!value) return run(supabase.rpc('set_methodology', { p_category: category, p_template_key: null, p_template_company: null }), 'La categoría vuelve a usar la metodología de la empresa.')
    const tpl = published.find(item => item.id === value)!
    return run(supabase.rpc('set_methodology', { p_category: category, p_template_key: tpl.template_key, p_template_company: tpl.company_id }), `${category ? 'La categoría' : 'La empresa'} usa ahora «${tpl.name}». Los proyectos ya iniciados conservan su versión.`)
  }

  return (
    <MainLayout user={{ name: session.name, email: session.email, role: session.role }} companyName={session.companyName}>
      <div className="space-y-5" data-testid="metodologia">
        <header>
          <h1>Metodología de Procurement</h1>
          <p className="mt-1 max-w-3xl text-[13px] text-petrol-blue/75">
            Define cómo trabaja tu equipo: etapas, actividades, hitos, entregables y aprobaciones. Cada proyecto nuevo toma la metodología de su categoría o la de la empresa, y guarda la versión con la que nació: cambiar la plantilla no modifica en silencio un proyecto en curso.
          </p>
        </header>
        {message && <p role="status" className={cn('rounded-xl px-3 py-2 text-[12.5px]', message.kind === 'ok' ? 'bg-accent-mint/30 text-petrol-blue' : 'bg-red-50 text-red-800')}>{message.text}</p>}

        <section className="grid gap-3 lg:grid-cols-3" aria-label="Plantillas publicadas">
          {published.map(item => {
            const isDefault = defaultTemplate?.id === item.id
            const def = item.definition
            return (
              <div key={item.id} className={cn('glass-card flex flex-col p-4', isDefault && 'ring-2 ring-petrol-blue')} data-testid="plantilla">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[15px] font-medium text-petrol-blue">{item.name}</p>
                    <p className="text-[11.5px] text-petrol-blue/65">v{item.version} · {item.company_id ? 'De tu empresa' : 'Plantilla XPEND'}{usage.get(item.id) ? ` · ${usage.get(item.id)} proyecto${usage.get(item.id) === 1 ? '' : 's'}` : ''}</p>
                  </div>
                  {isDefault && <span className="rounded-full bg-petrol-blue px-2 py-0.5 text-[11px] font-medium text-white">De la empresa</span>}
                </div>
                {item.description && <p className="mt-2 text-[12.5px] text-petrol-blue/80">{item.description}</p>}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[['Etapas', def.stages.length], ['Actividades', def.tasks.length], ['Entregables', def.deliverables.length]].map(([label, value]) => (
                    <div key={label as string} className="rounded-xl bg-petrol-blue/[0.04] py-2"><p className="text-[17px] font-medium text-petrol-blue">{value}</p><p className="text-[11px] text-petrol-blue/65">{label}</p></div>
                  ))}
                </div>
                <p className="mt-2 text-[11.5px] text-petrol-blue/70">Línea base: {def.rules.baselineApproval === 'formal' ? 'formal, versionada y aprobada antes de usarla' : 'referencia documentada con aprobación simple'}{def.rules.technicalBeforeEconomic ? ' · evaluación técnica antes de la económica' : ''}.</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-3">
                  <Button size="sm" variant="outline" onClick={() => setPreview(preview === item.id ? null : item.id)}><Eye className="mr-1 h-3.5 w-3.5" />{preview === item.id ? 'Ocultar' : 'Ver etapas'}</Button>
                  {isAdmin && !isDefault && <Button size="sm" onClick={() => assign(null, item.id)} data-testid="usar-empresa">Usar para la empresa</Button>}
                </div>
              </div>
            )
          })}
        </section>
        {!companyDefault && <p className="text-[12px] text-petrol-blue/70">La empresa no tiene una metodología elegida: los proyectos usan Light, la plantilla más simple.</p>}

        {preview && <Preview template={templates.find(item => item.id === preview)!} />}

        <BlockCard title="Por categoría" description="Una categoría puede usar otra metodología que la empresa; una subcategoría hereda la de su categoría si no tiene una propia.">
          {categories.length === 0 ? <EmptyHint>La empresa aún no tiene categorías.</EmptyHint> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[12.5px] text-petrol-blue" data-testid="metodologia-categorias">
                <tbody>
                  {categories.filter(item => !item.parent_id).flatMap(top => [top, ...categories.filter(item => item.parent_id === top.id)]).map(category => {
                    const own = assignments.find(item => item.category_id === category.id)
                    const parent = category.parent_id ? assignments.find(item => item.category_id === category.parent_id) : null
                    const ownTpl = own ? effective(own.template_key, own.template_company_id) : null
                    const inherited = parent ? effective(parent.template_key, parent.template_company_id) : defaultTemplate
                    return (
                      <tr key={category.id} className="border-b border-petrol-blue/[0.05]">
                        <td className={cn('py-2 pr-3', category.parent_id ? 'pl-6 text-petrol-blue/85' : 'font-medium')}>{category.name}</td>
                        <td className="w-[320px] py-2">
                          {isManager ? (
                            <select className={FIELD} value={ownTpl?.id || ''} onChange={event => assign(category.id, event.target.value)} aria-label={`Metodología de ${category.name}`}>
                              <option value="">Hereda: {inherited?.name || 'Light'}</option>
                              {published.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                          ) : <span>{ownTpl?.name || `Hereda: ${inherited?.name || 'Light'}`}</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </BlockCard>

        <BlockCard title="Metodologías personalizadas" description="Parten de Light, de Completa o de otra personalizada. Se editan en borrador y se publican; publicar crea una versión que los proyectos nuevos usan.">
          {isAdmin && (
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <label className="text-[12px] text-petrol-blue/80">Partir de
                <select className={`${FIELD} mt-1 w-64`} value={create.from} onChange={event => setCreate({ ...create, from: event.target.value })}>
                  <option value="">Elegir…</option>
                  {published.map(item => <option key={item.id} value={item.id}>{item.name} v{item.version}</option>)}
                </select>
              </label>
              <label className="text-[12px] text-petrol-blue/80">Nombre
                <input className={`${FIELD} mt-1 w-64`} value={create.name} onChange={event => setCreate({ ...create, name: event.target.value })} placeholder="Ej.: Servicios críticos" />
              </label>
              <Button size="sm" disabled={!create.from} onClick={async () => {
                const id = await run(supabase.rpc('create_custom_methodology', { p_from: create.from, p_name: create.name || null }), 'Borrador creado. Edítalo y publícalo cuando esté listo.')
                if (typeof id === 'string') { const tpl = (await supabase.from('methodology_templates').select('id, name, definition').eq('id', id).single()).data; if (tpl) setEditing({ id, name: tpl.name, definition: tpl.definition }) ; setCreate({ from: '', name: '' }) }
              }}><Copy className="mr-1 h-3.5 w-3.5" />Crear borrador</Button>
            </div>
          )}
          {templates.filter(item => item.company_id).length === 0 ? <EmptyHint>No hay metodologías personalizadas.</EmptyHint> : (
            <ul className="divide-y divide-petrol-blue/[0.06]">
              {templates.filter(item => item.company_id).map(item => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[12.5px] text-petrol-blue">
                  <span><span className="font-medium">{item.name}</span> · v{item.version} · {STATUS_LABEL[item.status]}{usage.get(item.id) ? ` · ${usage.get(item.id)} proyectos` : ''}</span>
                  {isAdmin && (
                    <span className="flex gap-1.5">
                      {item.status === 'draft' && <Button size="sm" variant="outline" onClick={() => setEditing({ id: item.id, name: item.name, definition: structuredClone(item.definition) })}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button>}
                      {item.status === 'draft' && <Button size="sm" onClick={() => run(supabase.rpc('publish_methodology', { p_template: item.id }), `«${item.name}» v${item.version} publicada.`)}><Upload className="mr-1 h-3.5 w-3.5" />Publicar</Button>}
                      {item.status === 'published' && !templates.some(other => other.template_key === item.template_key && other.company_id === item.company_id && other.status === 'draft') && (
                        <Button size="sm" variant="outline" onClick={async () => {
                          const id = await run(supabase.rpc('new_methodology_version', { p_template: item.id }), 'Nueva versión en borrador.')
                          if (typeof id === 'string') setEditing({ id, name: item.name, definition: structuredClone(item.definition) })
                        }}>Nueva versión</Button>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </BlockCard>

        {editing && isAdmin && (
          <Editor key={editing.id} value={editing} onCancel={() => setEditing(null)} onSave={async (definition, name) => {
            const ok = await run(supabase.rpc('save_methodology_draft', { p_template: editing.id, p_definition: definition, p_name: name }), 'Borrador guardado.')
            if (ok) setEditing({ ...editing, definition, name })
          }} />
        )}
      </div>
    </MainLayout>
  )
}

function Preview({ template }: { template: Template }) {
  const def = template.definition
  return (
    <section className="glass-card space-y-3 p-4" data-testid="vista-plantilla">
      <p className="text-[14px] font-medium text-petrol-blue">{template.name} · v{template.version}</p>
      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {def.stages.map((stage, index) => (
          <li key={stage.key} className="rounded-2xl bg-white/70 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-petrol-blue/55">Etapa {index + 1}</p>
            <p className="text-[13px] font-medium text-petrol-blue">{stage.name}</p>
            <ul className="mt-2 space-y-1">
              {def.tasks.filter(task => task.stage === stage.key).map(task => (
                <li key={task.key} className="text-[12px] text-petrol-blue/85">
                  <span className="text-petrol-blue/55">{task.code}.</span> {task.title}
                  {task.kind !== 'task' && <span className="ml-1 rounded bg-accent-mint/40 px-1 text-[10.5px]">{KIND_LABEL[task.kind]}</span>}
                  {task.optional && <span className="ml-1 rounded bg-petrol-blue/[0.06] px-1 text-[10.5px]">opcional</span>}
                  {task.deliverable && <span className="block pl-4 text-[11px] text-petrol-blue/60">Entregable: {def.deliverables.find(item => item.key === task.deliverable)?.title}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Editor({ value, onSave, onCancel }: { value: { id: string; name: string; definition: MethodologyDefinition }; onSave: (definition: MethodologyDefinition, name: string) => void; onCancel: () => void }) {
  const [def, setDef] = useState<MethodologyDefinition>(value.definition)
  const [name, setName] = useState(value.name)
  const errors = validateDefinition(def)
  const codeOf = new Map(def.tasks.map(task => [task.key, task.code]))
  const keyOf = new Map(def.tasks.map(task => [task.code, task.key]))
  const setTask = (key: string, patch: Partial<TaskDef>) => setDef({ ...def, tasks: def.tasks.map(task => task.key === key ? { ...task, ...patch } : task) })
  const move = (index: number, delta: number) => {
    const tasks = [...def.tasks]
    const [item] = tasks.splice(index, 1)
    tasks.splice(index + delta, 0, item)
    setDef({ ...def, tasks })
  }
  const nextCode = String(Math.max(0, ...def.tasks.map(task => Number(task.code) || 0)) + 1)

  return (
    <section className="glass-card space-y-4 p-4" data-testid="editor-metodologia">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input className="h-9 min-w-[280px] rounded-xl border border-petrol-blue/15 bg-white px-3 text-[15px] font-medium text-petrol-blue" value={name} onChange={event => setName(event.target.value)} aria-label="Nombre de la metodología" />
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>Cerrar</Button>
          <Button size="sm" disabled={errors.length > 0} onClick={() => onSave(def, name)}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Guardar borrador</Button>
        </div>
      </div>
      {errors.length > 0 ? (
        <ul className="rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-800" role="alert">{errors.map(error => <li key={error}>{error}</li>)}</ul>
      ) : <p className="rounded-xl bg-accent-mint/25 px-3 py-2 text-[12px] text-petrol-blue">La metodología es válida. Los eventos estándar ({REQUIRED_EVENTS.map(event => STANDARD_EVENTS[event]).join(', ')}) siguen presentes: los indicadores comparan proyectos de cualquier metodología.</p>}

      <div className="space-y-2">
        <p className="text-[13px] font-medium text-petrol-blue">Etapas</p>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {def.stages.map((stage, index) => (
            <div key={stage.key} className="flex items-center gap-1.5 rounded-xl bg-white/70 p-2">
              <span className="w-8 text-[11px] font-medium text-petrol-blue/55">{stage.key}</span>
              <input className={FIELD} value={stage.name} onChange={event => setDef({ ...def, stages: def.stages.map((item, position) => position === index ? { ...item, name: event.target.value } : item) })} aria-label={`Nombre de la etapa ${stage.key}`} />
              {!def.tasks.some(task => task.stage === stage.key) && !def.deliverables.some(item => item.stage === stage.key) && <button type="button" aria-label={`Quitar etapa ${stage.key}`} onClick={() => setDef({ ...def, stages: def.stages.filter(item => item.key !== stage.key) })}><Trash2 className="h-3.5 w-3.5 text-petrol-blue/60" /></button>}
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => { const key = `C${def.stages.length + 1}`; setDef({ ...def, stages: [...def.stages, { key: def.stages.some(item => item.key === key) ? `C${Date.now() % 1000}` : key, name: 'Nueva etapa' }] }) }}><Plus className="mr-1 h-3.5 w-3.5" />Etapa</Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[13px] font-medium text-petrol-blue">Actividades</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-[12px] text-petrol-blue">
            <thead><tr className="text-[11px] text-petrol-blue/65">{['', 'N°', 'Actividad', 'Etapa', 'Tipo', 'Días', 'Depende de (N°)', 'Rol', 'Entregable', 'Evento', 'Subtareas (separadas por ;)', 'Opc.', ''].map(label => <th key={label} className="px-1 py-1 font-medium">{label}</th>)}</tr></thead>
            <tbody>
              {def.tasks.map((task, index) => (
                <tr key={task.key} className="border-t border-petrol-blue/[0.05] align-top">
                  <td className="px-1 py-1"><div className="flex flex-col">{index > 0 && <button type="button" aria-label="Subir" onClick={() => move(index, -1)}><ArrowUp className="h-3 w-3" /></button>}{index < def.tasks.length - 1 && <button type="button" aria-label="Bajar" onClick={() => move(index, 1)}><ArrowDown className="h-3 w-3" /></button>}</div></td>
                  <td className="px-1 py-1 text-petrol-blue/60">{task.code}</td>
                  <td className="px-1 py-1"><input className={FIELD} value={task.title} onChange={event => setTask(task.key, { title: event.target.value })} aria-label={`Actividad ${task.code}`} /></td>
                  <td className="px-1 py-1"><select className={FIELD} value={task.stage} onChange={event => setTask(task.key, { stage: event.target.value })}>{def.stages.map(stage => <option key={stage.key} value={stage.key}>{stage.key}</option>)}</select></td>
                  <td className="px-1 py-1"><select className={FIELD} value={task.kind} onChange={event => setTask(task.key, { kind: event.target.value as TaskDef['kind'] })}>{Object.entries(KIND_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></td>
                  <td className="w-16 px-1 py-1"><input type="number" min="0" max="730" className={FIELD} value={task.duration} onChange={event => setTask(task.key, { duration: Number(event.target.value) })} /></td>
                  <td className="w-24 px-1 py-1"><input className={FIELD} defaultValue={task.depends.map(dep => codeOf.get(dep)).join(', ')} onBlur={event => setTask(task.key, { depends: event.target.value.split(/[,\s]+/).filter(Boolean).map(code => keyOf.get(code) || `?${code}`) })} aria-label={`Dependencias de ${task.code}`} /></td>
                  <td className="px-1 py-1"><select className={FIELD} value={task.role} onChange={event => setTask(task.key, { role: event.target.value as TaskRole })}>{Object.entries(ROLE_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></td>
                  <td className="px-1 py-1"><select className={FIELD} value={task.deliverable || ''} onChange={event => setTask(task.key, { deliverable: event.target.value || undefined })}><option value="">—</option>{def.deliverables.map(item => <option key={item.key} value={item.key}>{item.title}</option>)}</select></td>
                  <td className="px-1 py-1"><select className={FIELD} value={task.event || ''} onChange={event => setTask(task.key, { event: (event.target.value || undefined) as StandardEvent | undefined })}><option value="">—</option>{Object.entries(STANDARD_EVENTS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></td>
                  <td className="px-1 py-1"><input className={FIELD} defaultValue={(task.subtasks || []).join('; ')} onBlur={event => setTask(task.key, { subtasks: event.target.value.split(';').map(item => item.trim()).filter(Boolean) })} /></td>
                  <td className="px-1 py-1 text-center"><input type="checkbox" checked={!!task.optional} onChange={event => setTask(task.key, { optional: event.target.checked })} aria-label={`Opcional ${task.code}`} /></td>
                  <td className="px-1 py-1">{!def.tasks.some(other => other.depends.includes(task.key)) && <button type="button" aria-label={`Quitar ${task.title}`} onClick={() => setDef({ ...def, tasks: def.tasks.filter(item => item.key !== task.key) })}><Trash2 className="h-3.5 w-3.5 text-petrol-blue/60" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button size="sm" variant="outline" onClick={() => setDef({ ...def, tasks: [...def.tasks, { key: `c${Date.now().toString(36)}`, code: nextCode, stage: def.stages[def.stages.length - 1].key, title: 'Nueva actividad', kind: 'task', duration: 5, depends: def.tasks.length ? [def.tasks[def.tasks.length - 1].key] : [], role: 'category_manager' }] })}><Plus className="mr-1 h-3.5 w-3.5" />Actividad</Button>
      </div>

      <div className="space-y-2">
        <p className="text-[13px] font-medium text-petrol-blue">Entregables</p>
        <ul className="grid gap-2 md:grid-cols-2">
          {def.deliverables.map((item, index) => (
            <li key={item.key} className="space-y-1.5 rounded-xl bg-white/70 p-2">
              <input className={FIELD} value={item.title} onChange={event => setDef({ ...def, deliverables: def.deliverables.map((row, position) => position === index ? { ...row, title: event.target.value } : row) })} aria-label="Nombre del entregable" />
              <div className="flex flex-wrap items-center gap-3 text-[12px] text-petrol-blue">
                <select className={`${FIELD} w-20`} value={item.stage} onChange={event => setDef({ ...def, deliverables: def.deliverables.map((row, position) => position === index ? { ...row, stage: event.target.value } : row) })}>{def.stages.map(stage => <option key={stage.key} value={stage.key}>{stage.key}</option>)}</select>
                <label className="inline-flex items-center gap-1"><input type="checkbox" checked={item.approval} onChange={event => setDef({ ...def, deliverables: def.deliverables.map((row, position) => position === index ? { ...row, approval: event.target.checked, approverRole: event.target.checked ? 'manager' : undefined } : row) })} />Requiere aprobación</label>
                <label className="inline-flex items-center gap-1"><input type="checkbox" checked={item.documentRequired} onChange={event => setDef({ ...def, deliverables: def.deliverables.map((row, position) => position === index ? { ...row, documentRequired: event.target.checked } : row) })} />Exige documento</label>
                {!def.tasks.some(task => task.deliverable === item.key) && <button type="button" aria-label="Quitar entregable" onClick={() => setDef({ ...def, deliverables: def.deliverables.filter(row => row.key !== item.key) })}><Trash2 className="h-3.5 w-3.5 text-petrol-blue/60" /></button>}
              </div>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="outline" onClick={() => setDef({ ...def, deliverables: [...def.deliverables, { key: `d${Date.now().toString(36)}`, title: 'Nuevo entregable', stage: def.stages[0].key, description: '', approval: false, documentRequired: true }] })}><Plus className="mr-1 h-3.5 w-3.5" />Entregable</Button>
      </div>

      <div className="flex flex-wrap gap-4 text-[12.5px] text-petrol-blue">
        <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={def.rules.baselineRequired} onChange={event => setDef({ ...def, rules: { ...def.rules, baselineRequired: event.target.checked } })} />Exigir línea base para validar ahorros</label>
        <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={def.rules.baselineApproval === 'formal'} onChange={event => setDef({ ...def, rules: { ...def.rules, baselineApproval: event.target.checked ? 'formal' : 'simple' } })} />Línea base formal (versionada)</label>
        <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={def.rules.technicalBeforeEconomic} onChange={event => setDef({ ...def, rules: { ...def.rules, technicalBeforeEconomic: event.target.checked } })} />Evaluación técnica antes de la económica</label>
      </div>
      <p className="text-[11.5px] text-petrol-blue/65">Las reglas de seguridad no se configuran aquí: separación de funciones, aprobaciones por otra persona, NDA y confidencialidad de ofertas aplican siempre.</p>
    </section>
  )
}
