'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { supabaseBrowser } from '@/lib/supabase'

type EventRow = {
  id: string
  action: string
  performed_at: string
  metadata?: { body?: string; exception?: string }
}

const LABELS: Record<string, string> = {
  technical_closed: 'Nota técnica cerrada',
  publish: 'Publicación',
  award: 'Adjudicación',
  acta: 'Acta',
  performance: 'Desempeño',
  family_confirmed: 'Familia confirmada',
}

export function ExpedientePanel({ licitacionId, name }: { licitacionId: string; name: string }) {
  const [events, setEvents] = useState<EventRow[]>([])
  const [acta, setActa] = useState('')
  const [letter, setLetter] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const response = await fetch(`/api/process?licitacion_id=${encodeURIComponent(licitacionId)}`)
    const body = await response.json()
    if (response.ok) setEvents(body.events || [])
  }

  useEffect(() => {
    load()
  }, [licitacionId])

  const saveActa = async () => {
    setSaving(true)
    setError('')
    const response = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'acta',
        licitacion_id: licitacionId,
        payload: { body: acta },
      }),
    })
    const body = await response.json()
    setSaving(false)
    if (!response.ok) {
      setError(body.error || 'No se guardó el acta')
      return
    }
    setActa('')
    load()
  }

  const draftLetter = async () => {
    const supabase = supabaseBrowser()
    const { data } = await supabase
      .from('licitacion_suppliers')
      .select('supplier_id, technical_score, administrative_score, suppliers(fantasy_name)')
      .eq('licitacion_id', licitacionId)
    const lines = (data || []).map(row => {
      const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers
      const label = supplier?.fantasy_name || row.supplier_id
      return `${label}: nota técnica ${row.technical_score ?? 'sin nota'}, nota administrativa ${row.administrative_score ?? 'sin nota'}.`
    })
    setLetter([
      `Resultado de ${name}.`,
      'La evaluación usó la nota técnica y la nota administrativa de este proceso.',
      lines.join('\n') || 'Todavía no hay notas por proveedor.',
      'Esta carta no incluye el precio de los demás oferentes.',
    ].join('\n\n'))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expediente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.length === 0 ? (
          <p className="text-sm text-petrol-blue/75">Todavía no hay firmas ni acta en esta licitación.</p>
        ) : (
          <ul className="space-y-2">
            {events.map(event => (
              <li key={event.id} className="text-sm text-petrol-blue">
                <span className="font-medium">{LABELS[event.action] || event.action}</span>
                <span className="ml-2 text-xs text-petrol-blue/75">
                  {new Date(event.performed_at).toLocaleString('es-CL')}
                </span>
                {event.metadata?.exception ? (
                  <span className="mt-1 block text-xs text-petrol-blue/75">Excepción: {event.metadata.exception}</span>
                ) : null}
                {event.metadata?.body ? (
                  <span className="mt-1 block whitespace-pre-wrap text-xs text-petrol-blue/70">{event.metadata.body}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <Textarea
          rows={3}
          value={acta}
          placeholder="Acta: quién decidió, con qué pesos, y a quién se adjudica."
          onChange={event => setActa(event.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={saving || acta.trim().length < 12} onClick={saveActa}>
            Guardar acta
          </Button>
          <Button type="button" variant="outline" onClick={draftLetter}>
            Borrador de carta
          </Button>
        </div>
        {letter && <p className="whitespace-pre-wrap text-sm text-petrol-blue/80">{letter}</p>}
      </CardContent>
    </Card>
  )
}
