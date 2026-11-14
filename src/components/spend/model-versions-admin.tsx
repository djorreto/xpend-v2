'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Version = {
  id: string
  name: string
  status: 'base' | 'candidata' | 'publicada' | 'archivada'
  is_active: boolean
  trained_at: string | null
  holdout_accuracy: number | null
  rows_count: number | null
  class_count: number | null
  notes: string | null
  created_at: string
}

const STATUS_LABEL = {
  base: 'Base',
  candidata: 'Candidata',
  publicada: 'Publicada',
  archivada: 'Archivada',
}

export function ModelVersionsAdmin() {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [missingTable, setMissingTable] = useState(false)

  const load = async () => {
    setLoading(true)
    const response = await fetch('/api/admin/model-versions')
    const body = await response.json()
    setLoading(false)
    if (!response.ok) {
      setMissingTable(Boolean(body.missing_table))
      setMessage(body.error || 'No se pudieron leer las versiones.')
      setVersions([])
      return
    }
    setMissingTable(false)
    setMessage(null)
    setVersions(body.versions || [])
  }

  useEffect(() => {
    void load()
  }, [])

  const act = async (action: 'register-base' | 'activate', name?: string) => {
    setBusy(true)
    const response = await fetch('/api/admin/model-versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, name }),
    })
    const body = await response.json()
    setBusy(false)
    if (!response.ok) {
      setMessage(body.error || 'No se pudo guardar.')
      return
    }
    setMessage(action === 'activate' ? `Xpend ahora opera con ${name}.` : 'La versión base quedó guardada.')
    await load()
  }

  const hasBase = versions.some(version => version.name === 'xpend-taxonomia-v1')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Versiones del modelo</CardTitle>
        <CardDescription>
          La base no se pisa. Aquí se elige con cuál opera la clasificación. El cambio llega a los servidores en unos treinta segundos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && <p className="text-sm">{message}</p>}
        {!missingTable && !hasBase && !loading && (
          <Button disabled={busy} onClick={() => act('register-base')}>
            Guardar modelo base en la base de datos
          </Button>
        )}
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando versiones…</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay versiones guardadas.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2 font-medium">Versión</th>
                  <th className="p-2 font-medium">Estado</th>
                  <th className="p-2 font-medium">Entrenada</th>
                  <th className="p-2 font-medium">Acierto</th>
                  <th className="p-2 font-medium">Textos</th>
                  <th className="p-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {versions.map(version => (
                  <tr key={version.id} className="border-b last:border-0">
                    <td className="p-2">
                      <div className="font-medium">{version.name}</div>
                      {version.notes && <div className="text-xs text-muted-foreground">{version.notes}</div>}
                    </td>
                    <td className="p-2">{STATUS_LABEL[version.status] || version.status}{version.is_active ? ' · en uso' : ''}</td>
                    <td className="p-2">{version.trained_at || '—'}</td>
                    <td className="p-2">{version.holdout_accuracy == null ? '—' : `${Math.round(Number(version.holdout_accuracy) * 100)}%`}</td>
                    <td className="p-2">{version.rows_count?.toLocaleString() || '—'}</td>
                    <td className="p-2">
                      <Button
                        size="sm"
                        variant={version.is_active ? 'outline' : 'default'}
                        disabled={busy || version.is_active}
                        onClick={() => act('activate', version.name)}
                      >
                        {version.is_active ? 'Operando' : 'Usar esta'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
