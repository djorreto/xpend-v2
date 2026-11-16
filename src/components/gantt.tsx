'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Minus, Plus } from 'lucide-react'
import { daysBetween, STATE_LABEL, type EffectiveState, type GanttRow } from '@/lib/project'
import { cn } from '@/lib/utils'

// Gantt único para el portafolio y para un proyecto: recibe filas ya derivadas de los registros.

const ROW = 34
const LEFT = 320
const ZOOMS = { semana: 26, mes: 9, trimestre: 3.2 } as const
type Zoom = keyof typeof ZOOMS
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export const STATE_BAR: Record<EffectiveState, string> = {
  done: 'bg-accent-turquoise',
  in_progress: 'bg-petrol-blue/80',
  blocked: 'bg-amber-500',
  late: 'bg-red-500',
  at_risk: 'bg-yellow-400',
  pending: 'bg-petrol-blue/30',
  na: 'bg-petrol-blue/10',
}
export const STATE_PILL: Record<EffectiveState, string> = {
  done: 'bg-accent-mint/45 text-petrol-blue',
  in_progress: 'bg-petrol-blue/10 text-petrol-blue',
  blocked: 'bg-amber-100 text-amber-900',
  late: 'bg-red-100 text-red-800',
  at_risk: 'bg-yellow-100 text-yellow-900',
  pending: 'bg-white text-petrol-blue/80 border border-petrol-blue/15',
  na: 'bg-petrol-blue/[0.05] text-petrol-blue/60 line-through',
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function fmt(date: string | null | undefined) {
  if (!date) return 'sin fecha'
  const [y, m, d] = date.split('-')
  return `${d}-${m}-${y}`
}

type Prefs = { zoom: Zoom; collapsed: string[]; deps: boolean }

function loadPrefs(key: string | undefined, fallback: Prefs): Prefs {
  if (!key || typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(`xpend.gantt.${key}`)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

export function Gantt({
  rows,
  today,
  storageKey,
  defaultZoom = 'mes',
  defaultCollapsed = [],
  onOpen,
  empty = 'No hay actividades con fechas para mostrar.',
  testId = 'gantt',
}: {
  rows: GanttRow[]
  today: string
  storageKey?: string
  defaultZoom?: Zoom
  defaultCollapsed?: string[]
  onOpen?: (row: GanttRow) => void
  empty?: string
  testId?: string
}) {
  const [prefs, setPrefs] = useState<Prefs>({ zoom: defaultZoom, collapsed: defaultCollapsed, deps: true })
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => { setPrefs(loadPrefs(storageKey, { zoom: defaultZoom, collapsed: defaultCollapsed, deps: true })) }, [storageKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const save = (next: Prefs) => {
    setPrefs(next)
    if (storageKey) try { window.localStorage.setItem(`xpend.gantt.${storageKey}`, JSON.stringify(next)) } catch { /* sin almacenamiento: vale para esta visita */ }
  }

  const children = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of rows) if (row.parentId) map.set(row.parentId, (map.get(row.parentId) || 0) + 1)
    return map
  }, [rows])

  const visible = useMemo(() => {
    const hidden = new Set<string>()
    const collapsed = new Set(prefs.collapsed)
    return rows.filter(row => {
      if (row.parentId && (hidden.has(row.parentId) || collapsed.has(row.parentId))) {
        hidden.add(row.id)
        return false
      }
      return true
    })
  }, [rows, prefs.collapsed])

  const range = useMemo(() => {
    const dates = rows.flatMap(row => [row.start, row.end, row.originalStart, row.originalEnd, row.actualEnd]).filter(Boolean) as string[]
    if (dates.length === 0) return null
    dates.push(today)
    dates.sort()
    const first = addDays(dates[0], -7)
    const start = `${first.slice(0, 7)}-01`
    const last = addDays(dates[dates.length - 1], 21)
    return { start, end: last, days: daysBetween(start, last) + 1 }
  }, [rows, today])

  const px = ZOOMS[prefs.zoom]
  const x = (date: string) => (range ? daysBetween(range.start, date) * px : 0)

  useEffect(() => {
    if (!range || !scroller.current) return
    scroller.current.scrollLeft = Math.max(0, x(today) - 260)
  }, [range?.start, prefs.zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!range || rows.length === 0) {
    return <div className="rounded-xl border border-dashed border-petrol-blue/15 px-4 py-5 text-[12.5px] text-petrol-blue/75">{empty}</div>
  }

  const width = range.days * px
  const months: { label: string; left: number; width: number }[] = []
  for (let cursor = range.start; cursor <= range.end;) {
    const [y, m] = cursor.split('-').map(Number)
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    const left = x(cursor)
    months.push({ label: `${MONTHS[m - 1]}${prefs.zoom === 'trimestre' && m !== 1 ? '' : ` ${y}`}`, left, width: x(next < range.end ? next : addDays(range.end, 1)) - left })
    cursor = next
  }
  const weeks: { label: string; left: number }[] = []
  if (prefs.zoom === 'semana') {
    let cursor = range.start
    const offset = (new Date(`${cursor}T00:00:00Z`).getUTCDay() + 6) % 7
    cursor = addDays(cursor, offset === 0 ? 0 : 7 - offset)
    for (; cursor <= range.end; cursor = addDays(cursor, 7)) weeks.push({ label: cursor.slice(8, 10), left: x(cursor) })
  }
  const index = new Map(visible.map((row, position) => [row.id, position]))
  const todayX = x(today)

  const toggle = (id: string) => save({ ...prefs, collapsed: prefs.collapsed.includes(id) ? prefs.collapsed.filter(item => item !== id) : [...prefs.collapsed, id] })
  const groups = rows.filter(row => children.has(row.id) && row.level === 0).map(row => row.id)

  return (
    <div className="rounded-2xl border border-white/70 bg-white/55 shadow-[0_20px_40px_-34px_rgba(45,62,61,0.6)] backdrop-blur" data-testid={testId}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-petrol-blue/[0.07] px-3 py-2">
        <div className="flex items-center gap-1" role="group" aria-label="Escala del Gantt">
          {(Object.keys(ZOOMS) as Zoom[]).map(zoom => (
            <button key={zoom} type="button" aria-pressed={prefs.zoom === zoom} onClick={() => save({ ...prefs, zoom })}
              className={cn('rounded-full px-3 py-1 text-[12px] font-medium capitalize', prefs.zoom === zoom ? 'bg-petrol-blue text-white' : 'text-petrol-blue hover:bg-white')}>
              {zoom}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-petrol-blue">
          <button type="button" className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-white" onClick={() => save({ ...prefs, collapsed: groups })}><Minus className="h-3 w-3" aria-hidden />Contraer</button>
          <button type="button" className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-white" onClick={() => save({ ...prefs, collapsed: [] })}><Plus className="h-3 w-3" aria-hidden />Expandir</button>
          <label className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 hover:bg-white">
            <input type="checkbox" checked={prefs.deps} onChange={event => save({ ...prefs, deps: event.target.checked })} />Dependencias
          </label>
          <button type="button" className="rounded-full px-2 py-1 font-medium hover:bg-white" onClick={() => { if (scroller.current) scroller.current.scrollLeft = Math.max(0, todayX - 260) }}>Hoy</button>
        </div>
      </div>

      <div ref={scroller} className="relative max-h-[640px] overflow-auto" role="grid" aria-label="Carta Gantt" aria-rowcount={visible.length}>
        <div className="relative" style={{ width: LEFT + width, minHeight: (visible.length + 1) * ROW + 24 }}>
          <div className="sticky top-0 z-20 flex h-[46px] border-b border-petrol-blue/10 bg-white/90 backdrop-blur">
            <div className="sticky left-0 z-30 flex shrink-0 items-end border-r border-petrol-blue/10 bg-white/95 px-3 pb-1.5 text-[11.5px] font-medium text-petrol-blue/75" style={{ width: LEFT }}>Actividad · responsable</div>
            <div className="relative" style={{ width }}>
              {months.map(month => (
                <div key={month.left} className="absolute top-0 h-[24px] truncate border-l border-petrol-blue/10 px-1.5 pt-1 text-[11.5px] font-medium text-petrol-blue" style={{ left: month.left, width: month.width }}>{month.label}</div>
              ))}
              {weeks.map(week => <div key={week.left} className="absolute top-[24px] border-l border-petrol-blue/[0.06] px-1 text-[10.5px] text-petrol-blue/60" style={{ left: week.left }}>{week.label}</div>)}
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-0 top-[46px] z-0" style={{ left: LEFT, width }} aria-hidden>
            {months.map(month => <div key={month.left} className="absolute bottom-0 top-0 border-l border-petrol-blue/[0.05]" style={{ left: month.left }} />)}
            <div className="absolute bottom-0 top-0 w-[2px] bg-accent-turquoise" style={{ left: todayX }}>
              <span className="absolute -top-0 left-1 rounded bg-accent-turquoise px-1 text-[10px] font-medium text-petrol-blue">Hoy</span>
            </div>
          </div>

          {prefs.deps && (
            <svg className="pointer-events-none absolute z-[5]" style={{ left: LEFT, top: 46, width, height: visible.length * ROW }} aria-hidden>
              {visible.flatMap(row => (row.depends || []).map(dep => {
                const from = index.get(dep)
                const to = index.get(row.id)
                const pred = visible[from ?? -1]
                if (from == null || to == null || !pred?.end || !row.start) return null
                const x1 = x(pred.end) + px
                const y1 = from * ROW + ROW / 2
                const x2 = x(row.start)
                const y2 = to * ROW + ROW / 2
                const mid = Math.max(x1 + 6, x2 - 6)
                return <path key={`${dep}-${row.id}`} d={`M${x1},${y1} H${mid} V${y2} H${x2}`} fill="none" stroke="rgba(45,62,61,0.28)" strokeWidth="1" markerEnd="url(#gantt-arrow)" />
              }))}
              <defs><marker id="gantt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="rgba(45,62,61,0.4)" /></marker></defs>
            </svg>
          )}

          {visible.map((row, position) => {
            const hasChildren = children.has(row.id)
            const collapsed = prefs.collapsed.includes(row.id)
            const late = row.state === 'late' && row.end && row.end < today
            const title = `${row.label} · ${STATE_LABEL[row.state]} · comprometida ${fmt(row.start)} → ${fmt(row.end)}${row.originalEnd && row.originalEnd !== row.end ? ` · original ${fmt(row.originalStart)} → ${fmt(row.originalEnd)}` : ''}${row.actualEnd ? ` · real ${fmt(row.actualEnd)}` : ''}${row.owner ? ` · ${row.owner}` : ''}`
            return (
              <div key={row.id} role="row" aria-rowindex={position + 1} className={cn('relative flex border-b border-petrol-blue/[0.045]', row.level === 0 && 'bg-petrol-blue/[0.025]')} style={{ height: ROW }} data-testid={`${testId}-fila`} data-state={row.state}>
                <div role="gridcell" className="sticky left-0 z-10 flex shrink-0 items-center gap-1 border-r border-petrol-blue/10 bg-white/90 pr-2 backdrop-blur" style={{ width: LEFT, paddingLeft: 8 + row.level * 16 }}>
                  {hasChildren ? (
                    <button type="button" aria-expanded={!collapsed} aria-label={collapsed ? `Expandir ${row.label}` : `Contraer ${row.label}`} onClick={() => toggle(row.id)} className="rounded p-0.5 text-petrol-blue/70 hover:bg-petrol-blue/10">
                      {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  ) : <span className="w-[18px]" />}
                  <button type="button" onClick={() => onOpen?.(row)} disabled={!onOpen} title={title}
                    className={cn('min-w-0 flex-1 truncate text-left text-[12.5px] text-petrol-blue', row.level === 0 ? 'font-medium' : '', row.state === 'na' && 'text-petrol-blue/50 line-through', onOpen && 'hover:underline')}>
                    {row.label}
                  </button>
                  {row.meta && <span className="hidden shrink-0 text-[10.5px] text-petrol-blue/60 xl:inline">{row.meta}</span>}
                  {row.owner && <span className="max-w-[86px] shrink-0 truncate rounded-full bg-petrol-blue/[0.06] px-1.5 text-[10.5px] text-petrol-blue/75" title={row.owner}>{row.owner.split(' ')[0]}</span>}
                </div>
                <div role="gridcell" className="relative" style={{ width }}>
                  {row.originalStart && row.originalEnd && (row.originalStart !== row.start || row.originalEnd !== row.end) && (
                    <span className="absolute h-[3px] rounded-full bg-petrol-blue/25" style={{ left: x(row.originalStart), width: Math.max(px, x(row.originalEnd) - x(row.originalStart) + px), top: ROW - 8 }} title={`Original: ${fmt(row.originalStart)} → ${fmt(row.originalEnd)}`} />
                  )}
                  {row.start && row.end && (row.milestone ? (
                    <span className={cn('absolute h-3.5 w-3.5 rotate-45 rounded-[3px] border-2 border-white shadow', STATE_BAR[row.state])} style={{ left: x(row.end) + px / 2 - 7, top: ROW / 2 - 7 }} title={title} />
                  ) : (
                    <button type="button" onClick={() => onOpen?.(row)} disabled={!onOpen} title={title} aria-label={title}
                      className={cn('absolute overflow-hidden rounded-full shadow-sm transition-transform hover:scale-y-110', row.summary ? 'h-2.5 bg-petrol-blue/25' : 'h-4', !row.summary && STATE_BAR[row.state])}
                      style={{ left: x(row.start), width: Math.max(px, x(row.end) - x(row.start) + px), top: row.summary ? ROW / 2 - 5 : ROW / 2 - 8 }}>
                      {row.summary && <span className={cn('block h-full', STATE_BAR[row.state === 'pending' ? 'in_progress' : row.state])} style={{ width: `${Math.round((row.progress || 0) * 100)}%` }} />}
                    </button>
                  ))}
                  {late && row.end && !row.summary && (
                    <span className="absolute h-4 rounded-r-full bg-[repeating-linear-gradient(45deg,rgba(239,68,68,0.35)_0_4px,transparent_4px_8px)]" style={{ left: x(row.end) + px, width: Math.max(0, todayX - x(row.end) - px), top: ROW / 2 - 8 }} title="Atraso respecto de la fecha comprometida" />
                  )}
                  {row.actualEnd && !row.milestone && (
                    <span className="absolute h-2 w-2 rounded-full border border-white bg-petrol-blue" style={{ left: x(row.actualEnd) + px / 2 - 4, top: ROW / 2 - 4 }} title={`Real: ${fmt(row.actualEnd)}`} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-petrol-blue/[0.07] px-3 py-2 text-[11.5px] text-petrol-blue/75">
        {(['done', 'in_progress', 'at_risk', 'late', 'blocked', 'pending'] as EffectiveState[]).map(state => (
          <span key={state} className="inline-flex items-center gap-1.5"><span className={cn('h-2.5 w-4 rounded-full', STATE_BAR[state])} />{STATE_LABEL[state]}</span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="h-[3px] w-4 rounded-full bg-petrol-blue/25" />Fecha original</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-petrol-blue" />Término real</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-petrol-blue/60" />Hito</span>
      </div>
    </div>
  )
}
