'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabaseBrowser } from '@/lib/supabase'
import type { RfxProject } from '@/types/rfx-maker'

type Row = { id: string; a: string; b: string; c: string; d: string }

const empty = (): Row => ({ id: crypto.randomUUID(), a: '', b: '', c: '', d: '' })

function rowsOf(value: unknown): Row[] {
  if (!Array.isArray(value) || value.length === 0) return [empty()]
  return value.map(item => {
    const row = item as Partial<Row>
    return { id: row.id || crypto.randomUUID(), a: row.a || '', b: row.b || '', c: row.c || '', d: row.d || '' }
  })
}

export function RfxServiceSheets({
  project,
  disabled,
  onSaved,
}: {
  project: RfxProject
  disabled?: boolean
  onSaved: (patch: Partial<RfxProject>) => void
}) {
  const ctx = (project.project_context || {}) as Record<string, unknown>
  const stored = (ctx.sheets || {}) as { cotizacion?: unknown; propuesta?: unknown }
  const [cotizacion, setCotizacion] = useState<Row[]>(() => rowsOf(stored.cotizacion))
  const [propuesta, setPropuesta] = useState<Row[]>(() => rowsOf(stored.propuesta))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const seed = () => {
    const text = project.technical_base_content || ''
    const lines = text
      .split('\n')
      .map(line => line.replace(/^[-*#\d.\s]+/, '').trim())
      .filter(line => line.length > 8)
      .slice(0, 12)
    const seeded = (lines.length ? lines : ['Ítem principal del servicio']).map(line => ({
      ...empty(),
      a: line.slice(0, 80),
      d: line,
    }))
    setCotizacion(seeded.map(row => ({ ...row, id: crypto.randomUUID(), b: 'unidad', c: '1' })))
    setPropuesta(seeded.map(row => ({ ...row, id: crypto.randomUUID(), b: row.d, c: '', d: '' })))
    setMessage('Formularios armados desde la base técnica. Revísalos y guarda.')
  }

  const save = async () => {
    setSaving(true)
    const project_context = { ...ctx, sheets: { cotizacion, propuesta } }
    const { error } = await supabaseBrowser()
      .from('rfx_projects')
      .update({ project_context })
      .eq('id', project.id)
    setSaving(false)
    if (error) {
      setMessage(error.message)
      return
    }
    onSaved({ project_context } as Partial<RfxProject>)
    setMessage('Formularios guardados. La cotización y la propuesta técnica usan los mismos ítems.')
  }

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Formularios del servicio</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Salen de la misma base técnica. Uno es la cotización. El otro es la propuesta técnica. Se editan como una tabla.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={seed}>
            Armar desde la base técnica
          </Button>
          <Button type="button" size="sm" disabled={disabled || saving} onClick={save}>
            {saving ? 'Guardando…' : 'Guardar tablas'}
          </Button>
        </div>
      </div>
      {message && <p className="text-sm">{message}</p>}
      <Sheet title="Formulario de cotización" columns={['Ítem', 'Unidad', 'Cantidad', 'Especificación']} rows={cotizacion} onChange={setCotizacion} disabled={disabled} />
      <Sheet title="Formulario de propuesta técnica" columns={['Ítem', 'Requisito', 'Cómo lo cumple', 'Evidencia']} rows={propuesta} onChange={setPropuesta} disabled={disabled} />
    </div>
  )
}

function Sheet({
  title,
  columns,
  rows,
  onChange,
  disabled,
}: {
  title: string
  columns: string[]
  rows: Row[]
  onChange: (rows: Row[]) => void
  disabled?: boolean
}) {
  const keys: Array<keyof Row> = ['a', 'b', 'c', 'd']
  const setCell = (id: string, key: keyof Row, value: string) => {
    onChange(rows.map(row => row.id === id ? { ...row, [key]: value } : row))
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange([...rows, empty()])}>
          Agregar fila
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              {columns.map(column => <th key={column} className="p-2 font-medium">{column}</th>)}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="border-b last:border-0">
                {keys.map(key => (
                  <td key={key} className="p-1">
                    <Input
                      value={row[key]}
                      disabled={disabled}
                      onChange={event => setCell(row.id, key, event.target.value)}
                      className="h-8 text-[12px]"
                    />
                  </td>
                ))}
                <td className="p-1">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground"
                    disabled={disabled || rows.length === 1}
                    onClick={() => onChange(rows.filter(item => item.id !== row.id))}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
