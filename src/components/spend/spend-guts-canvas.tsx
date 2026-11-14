'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BRAIN } from '@/lib/spend-brain'
import { SpendRulesPanel } from '@/components/spend/spend-rules-panel'

type Tone = 'flow' | 'local' | 'train'

type Port = {
  id: string
  label: string
  side: 'in' | 'out'
  tone?: Tone
  required?: boolean
}

type GutsNode = {
  id: string
  title: string
  kind: 'source' | 'runner' | 'target'
  x: number
  y: number
  w: number
  status: string
  href?: string
  hrefLabel?: string
  summary: string
  stays: string
  ports: Port[]
}

type Wire = {
  from: string
  fromPort: string
  to: string
  toPort: string
  tone: Tone
  route?: 'under'
}

const PORT_H = 22
const HEAD = 42

const NODES: GutsNode[] = [
  {
    id: 'archivo',
    title: 'Archivo del cliente',
    kind: 'source',
    x: 16,
    y: 16,
    w: 248,
    status: 'Entrada',
    href: '/sourcing-intelligence/upload',
    hrefLabel: 'Cargar un archivo',
    summary: 'Excel o CSV de esta empresa. Entran las columnas mapeadas, no el archivo original.',
    stays: 'Proveedor, monto y centro se quedan en esta empresa. No alimentan la base compartida.',
    ports: [
      { id: 'descripcion', label: 'descripción', side: 'out', required: true },
      { id: 'proveedor', label: 'proveedor', side: 'out', tone: 'local' },
      { id: 'monto', label: 'monto', side: 'out', tone: 'local', required: true },
      { id: 'centro', label: 'centro de costo', side: 'out' },
    ],
  },
  {
    id: 'reglas',
    title: 'Reglas de la empresa',
    kind: 'source',
    x: 16,
    y: 196,
    w: 248,
    status: 'Solo aquí',
    href: '/sourcing-intelligence/learning-rules',
    hrefLabel: 'Abrir reglas',
    summary: 'Un proveedor o una palabra que esta empresa ya etiquetó. No se comparte. Abajo puedes corregir el patrón o la familia.',
    stays: 'Si hay coincidencia, gana sobre el modelo.',
    ports: [{ id: 'patron', label: 'patrón → categoría', side: 'out' }],
  },
  {
    id: 'taxonomia',
    title: 'Taxonomía Xpend',
    kind: 'source',
    x: 16,
    y: 292,
    w: 248,
    status: 'Catálogo',
    href: '/sourcing-intelligence/taxonomia',
    hrefLabel: 'Editar taxonomía',
    summary: 'Una lista para todas las industrias. La rama (salud, agro, minería) solo cambia el vocabulario.',
    stays: `${BRAIN.base.unmapped.toLocaleString()} textos de la base no tienen equivalente y no entrenan taxonomía.`,
    ports: [
      { id: 'familia', label: 'familia', side: 'out', required: true },
      { id: 'rama', label: 'rama por industria', side: 'out' },
    ],
  },
  {
    id: 'base',
    title: 'Base de aprendizaje',
    kind: 'source',
    x: 16,
    y: 412,
    w: 248,
    status: `${BRAIN.base.trainable_rows.toLocaleString()} textos`,
    href: '/sourcing-intelligence/cerebro?tab=base',
    hrefLabel: 'Ver la base',
    summary: 'Textos anónimos con la categoría del consultor. Retail no entra. Salud ya está incluida.',
    stays: 'No recibe el archivo que estás clasificando ahora.',
    ports: [{ id: 'textos', label: 'textos anónimos', side: 'out', tone: 'train' }],
  },
  {
    id: 'runner',
    title: 'Clasificador',
    kind: 'runner',
    x: 400,
    y: 148,
    w: 280,
    status: BRAIN.model.name,
    href: '/sourcing-intelligence/cerebro?tab=modelo',
    hrefLabel: 'Ver el modelo',
    summary: 'Orden fijo: regla de la empresa, modelo propio, LLM solo si un admin lo autorizó. Si la confianza es baja, queda para una persona.',
    stays: `Acierto en textos no vistos: ${Math.round((BRAIN.model.held_out_accuracy || 0) * 100)}%.`,
    ports: [
      { id: 'texto', label: 'descripción', side: 'in', required: true },
      { id: 'regla', label: 'regla local', side: 'in', tone: 'local' },
      { id: 'taxonomia', label: 'taxonomía', side: 'in' },
      { id: 'modelo', label: 'modelo propio', side: 'in', tone: 'train' },
      { id: 'familia', label: 'familia', side: 'out', required: true },
      { id: 'origen', label: 'origen', side: 'out' },
      { id: 'confianza', label: 'confianza', side: 'out' },
    ],
  },
  {
    id: 'linea',
    title: 'Línea clasificada',
    kind: 'target',
    x: 820,
    y: 24,
    w: 250,
    status: 'Salida',
    href: '/sourcing-intelligence',
    hrefLabel: 'Ir a las cargas',
    summary: 'Cada línea queda con familia, subcategoría y de dónde salió: regla, taxonomía, modelo, LLM o persona.',
    stays: 'La confianza baja no se cierra sola. Pasa a revisión.',
    ports: [
      { id: 'familia', label: 'familia', side: 'in', required: true },
      { id: 'origen', label: 'origen', side: 'in' },
      { id: 'confianza', label: 'confianza', side: 'in' },
      { id: 'paquete', label: 'línea lista', side: 'out' },
    ],
  },
  {
    id: 'kraljic',
    title: 'Kraljic',
    kind: 'target',
    x: 820,
    y: 230,
    w: 250,
    status: 'Vista',
    summary: 'Usa la familia ya clasificada y el monto de esta empresa. El monto no vuelve al modelo.',
    stays: 'Sin categoría, la línea no entra a un cuadrante.',
    ports: [
      { id: 'familia', label: 'familia', side: 'in', required: true },
      { id: 'gasto', label: 'monto', side: 'in', tone: 'local', required: true },
      { id: 'cuadrante', label: 'cuadrante', side: 'out' },
    ],
  },
  {
    id: 'excel',
    title: 'Excel de salida',
    kind: 'target',
    x: 820,
    y: 400,
    w: 250,
    status: 'Descarga',
    summary: 'Líneas, resumen, Kraljic, pendientes y notas. El proveedor y el monto van porque es el archivo del cliente.',
    stays: 'Esa descarga no se usa para entrenar.',
    ports: [
      { id: 'lineas', label: 'líneas', side: 'in', required: true },
      { id: 'kraljic', label: 'Kraljic', side: 'in' },
    ],
  },
]

const WIRES: Wire[] = [
  { from: 'archivo', fromPort: 'descripcion', to: 'runner', toPort: 'texto', tone: 'flow' },
  { from: 'archivo', fromPort: 'proveedor', to: 'runner', toPort: 'regla', tone: 'local' },
  { from: 'reglas', fromPort: 'patron', to: 'runner', toPort: 'regla', tone: 'flow' },
  { from: 'taxonomia', fromPort: 'familia', to: 'runner', toPort: 'taxonomia', tone: 'flow' },
  { from: 'base', fromPort: 'textos', to: 'runner', toPort: 'modelo', tone: 'train' },
  { from: 'runner', fromPort: 'familia', to: 'linea', toPort: 'familia', tone: 'flow' },
  { from: 'runner', fromPort: 'origen', to: 'linea', toPort: 'origen', tone: 'flow' },
  { from: 'runner', fromPort: 'confianza', to: 'linea', toPort: 'confianza', tone: 'flow' },
  { from: 'runner', fromPort: 'familia', to: 'kraljic', toPort: 'familia', tone: 'flow' },
  { from: 'archivo', fromPort: 'monto', to: 'kraljic', toPort: 'gasto', tone: 'local', route: 'under' },
  { from: 'linea', fromPort: 'paquete', to: 'excel', toPort: 'lineas', tone: 'flow' },
  { from: 'kraljic', fromPort: 'cuadrante', to: 'excel', toPort: 'kraljic', tone: 'flow' },
]

const STROKE: Record<Tone, string> = {
  flow: '#128A62',
  local: '#C2410C',
  train: '#0E7490',
}

function nodeHeight(node: GutsNode) {
  const rows = Math.max(
    node.ports.filter(port => port.side === 'in').length,
    node.ports.filter(port => port.side === 'out').length,
    1
  )
  return HEAD + 12 + rows * PORT_H + 8
}

function portPoint(node: GutsNode, portId: string) {
  const port = node.ports.find(item => item.id === portId)
  if (!port) return { x: node.x, y: node.y }
  const same = node.ports.filter(item => item.side === port.side)
  const index = same.findIndex(item => item.id === portId)
  return {
    x: port.side === 'out' ? node.x + node.w : node.x,
    y: node.y + HEAD + 12 + index * PORT_H + 11,
  }
}

function wirePath(wire: Wire, nodes: Map<string, GutsNode>) {
  const from = nodes.get(wire.from)
  const to = nodes.get(wire.to)
  if (!from || !to) return ''
  const a = portPoint(from, wire.fromPort)
  const b = portPoint(to, wire.toPort)
  if (wire.route === 'under') {
    const low = 548
    return `M ${a.x} ${a.y} C ${a.x + 40} ${low}, ${b.x - 40} ${low}, ${b.x} ${b.y}`
  }
  const dx = Math.max(48, (b.x - a.x) / 2)
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`
}

const KIND_STYLE = {
  source: 'border-teal-200 bg-white',
  runner: 'border-[#1B4D3E] bg-white',
  target: 'border-violet-200 bg-white',
}

const KIND_HEAD = {
  source: 'bg-teal-50 text-teal-900',
  runner: 'bg-[#1B4D3E] text-white',
  target: 'bg-violet-50 text-violet-950',
}

export function SpendGutsCanvas() {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState('runner')
  const inspector = useRef<HTMLDivElement>(null)
  const nodes = useMemo(() => new Map(NODES.map(node => [node.id, node])), [])

  useEffect(() => {
    inspector.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedId])
  const selected = nodes.get(selectedId) || NODES[4]
  const retail = BRAIN.base.industries.find(item => item.name === 'Retail')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {NODES.filter(node => ['archivo', 'runner', 'base'].includes(node.id)).map(node => (
          <button
            key={node.id}
            type="button"
            onClick={() => setSelectedId(node.id)}
            className={`rounded-full border px-3 py-1 text-sm ${selectedId === node.id ? 'border-[#1B4D3E] bg-[#1B4D3E] text-white' : 'bg-white'}`}
          >
            {node.title}
            <span className="ml-2 opacity-70">{node.status}</span>
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        El flujo del cliente está conectado. Avisos de la base: Retail no entrena
        {retail?.reason ? ` (${retail.reason})` : ''}. {BRAIN.base.unmapped.toLocaleString()} textos sin equivalente en la taxonomía.
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <div
          className="relative"
          style={{
            width: 1100,
            height: 580,
            backgroundImage: 'linear-gradient(to right, #eef2f2 1px, transparent 1px), linear-gradient(to bottom, #eef2f2 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            {WIRES.map(wire => (
              <path
                key={`${wire.from}.${wire.fromPort}-${wire.to}.${wire.toPort}`}
                d={wirePath(wire, nodes)}
                fill="none"
                stroke={STROKE[wire.tone]}
                strokeWidth={2}
                strokeDasharray={wire.tone === 'local' ? '6 4' : undefined}
                opacity={selectedId === wire.from || selectedId === wire.to ? 1 : 0.55}
              />
            ))}
          </svg>

          {NODES.map(node => {
            const height = nodeHeight(node)
            const active = node.id === selectedId
            const ins = node.ports.filter(port => port.side === 'in')
            const outs = node.ports.filter(port => port.side === 'out')
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedId(node.id)}
                className={`absolute rounded-lg border text-left shadow-sm ${KIND_STYLE[node.kind]} ${active ? 'ring-2 ring-[#2AD4D2]' : ''}`}
                style={{ left: node.x, top: node.y, width: node.w, height }}
              >
                <div className={`flex items-center justify-between rounded-t-lg px-3 py-2 ${KIND_HEAD[node.kind]}`}>
                  <span className="text-sm font-medium">{node.title}</span>
                  <span className="text-[11px] opacity-80">{node.status}</span>
                </div>
                <div className="relative px-3 pt-2">
                  {Array.from({ length: Math.max(ins.length, outs.length) }).map((_, index) => (
                    <div key={index} className="flex h-[22px] items-center justify-between text-[12px] text-slate-700">
                      <span>{ins[index]?.label || ''}</span>
                      <span>{outs[index]?.label || ''}</span>
                    </div>
                  ))}
                </div>
                {node.ports.map(port => {
                  const point = portPoint(node, port.id)
                  const linked = WIRES.some(wire =>
                    (wire.from === node.id && wire.fromPort === port.id) ||
                    (wire.to === node.id && wire.toPort === port.id)
                  )
                  return (
                    <span
                      key={port.id}
                      className="absolute h-2.5 w-2.5 rounded-full border-2 border-white"
                      style={{
                        left: port.side === 'out' ? node.w - 5 : -5,
                        top: point.y - node.y - 5,
                        background: linked ? STROKE[port.tone || 'flow'] : '#cbd5e1',
                      }}
                    />
                  )
                })}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2"><i className="inline-block h-0.5 w-6 bg-[#128A62]" /> Viaja al clasificador</span>
        <span className="inline-flex items-center gap-2"><i className="inline-block h-0.5 w-6 border-t-2 border-dashed border-[#C2410C]" /> Se queda en la empresa</span>
        <span className="inline-flex items-center gap-2"><i className="inline-block h-0.5 w-6 bg-[#0E7490]" /> Entrena el modelo, no ve este archivo</span>
      </div>

      <div ref={inspector} className="rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-medium">{selected.title}</p>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{selected.summary}</p>
            <p className="mt-2 text-sm">{selected.stays}</p>
          </div>
          {selected.href && selected.id !== 'reglas' && (
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-sm"
              onClick={() => router.push(selected.href!)}
            >
              {selected.hrefLabel || 'Abrir'}
            </button>
          )}
        </div>
        {selected.id === 'reglas' && <SpendRulesPanel />}
      </div>
    </div>
  )
}
