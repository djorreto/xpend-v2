'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

type Row = {
  paramKey: string
  label: string
  type: 'text' | 'number' | 'textarea'
  placeholder?: string
}

const ROWS: Row[] = [
  { paramKey: 'currency', label: 'Moneda', type: 'text', placeholder: 'CLP' },
  { paramKey: 'proposal_validity_days', label: 'Vigencia de la oferta (días)', type: 'number' },
  { paramKey: 'performance_bond_percent', label: 'Garantía de seriedad (%)', type: 'number' },
  { paramKey: 'payment_terms', label: 'Condiciones de pago', type: 'textarea', placeholder: 'Ej: 30 días contra entrega' },
  { paramKey: 'delivery_timeline', label: 'Plazo de entrega / ejecución', type: 'text' },
  { paramKey: 'penalties_summary', label: 'Penalidades o multas', type: 'textarea' },
]

function stringifyVal(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

export function RfxQuickAdminForm({
  initialParams,
  onApply,
  disabled,
}: {
  initialParams: Record<string, unknown>
  onApply: (merged: Record<string, unknown>) => Promise<void>
  disabled?: boolean
}) {
  const [rows, setRows] = useState(() =>
    ROWS.map((r) => {
      const raw = initialParams[r.paramKey]
      const has = raw !== undefined && raw !== null && String(raw).trim() !== ''
      return {
        ...r,
        enabled: has,
        value: has ? stringifyVal(raw) : '',
      }
    })
  )
  const [saving, setSaving] = useState(false)

  const canSave = useMemo(() => rows.some((r) => r.enabled), [rows])

  const handleApply = async () => {
    const next = { ...initialParams }
    for (const r of rows) {
      if (!r.enabled) {
        delete next[r.paramKey]
        continue
      }
      if (r.type === 'number') {
        const n = parseFloat(r.value)
        next[r.paramKey] = Number.isFinite(n) ? n : r.value
      } else {
        next[r.paramKey] = r.value.trim()
      }
    }
    setSaving(true)
    try {
      await onApply(next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-4 border-dashed bg-slate-50/80">
      <h4 className="font-semibold text-gray-900 mb-1">Base administrativa rápida</h4>
      <p className="text-sm text-muted-foreground mb-4">
        Marca lo que quieres incluir y completa el valor. Se fusiona con el resto de parámetros al guardar.
      </p>
      <div className="space-y-4">
        {rows.map((r, i) => (
          <div key={r.paramKey} className="flex flex-col sm:flex-row sm:items-start gap-3 border-b border-slate-200/80 pb-3 last:border-0">
            <div className="flex items-center gap-2 sm:w-48 flex-shrink-0 pt-2">
              <Checkbox
                id={`qa-${r.paramKey}`}
                checked={r.enabled}
                disabled={disabled}
                onCheckedChange={(c) => {
                  const on = c === true
                  setRows((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, enabled: on } : x))
                  )
                }}
              />
              <Label htmlFor={`qa-${r.paramKey}`} className="text-sm font-normal cursor-pointer leading-snug">
                {r.label}
              </Label>
            </div>
            <div className="flex-1 min-w-0">
              {r.type === 'textarea' ? (
                <textarea
                  className="w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={disabled || !r.enabled}
                  placeholder={r.placeholder}
                  value={r.value}
                  onChange={(e) =>
                    setRows((prev) => prev.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
                  }
                />
              ) : (
                <Input
                  type={r.type === 'number' ? 'number' : 'text'}
                  disabled={disabled || !r.enabled}
                  placeholder={r.placeholder}
                  value={r.value}
                  onChange={(e) =>
                    setRows((prev) => prev.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
                  }
                />
              )}
            </div>
          </div>
        ))}
      </div>
      <Button className="mt-4" type="button" disabled={disabled || !canSave || saving} onClick={handleApply}>
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Guardando…
          </>
        ) : (
          'Aplicar a parámetros administrativos'
        )}
      </Button>
    </Card>
  )
}
