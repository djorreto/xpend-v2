'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function ReprocessButton({
  uploadId,
  size = 'sm',
}: {
  uploadId: string
  size?: 'sm' | 'default'
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (!confirm('Se borran las categorías, Kraljic y el plan de este archivo. Las líneas cargadas se mantienen. Después hay que clasificar de nuevo.')) return
    setBusy(true)
    try {
      const response = await fetch('/api/si/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upload_id: uploadId }),
      })
      const body = await response.json()
      if (!response.ok) {
        alert(body.error || 'No se pudo reprocesar')
        return
      }
      router.push(`/sourcing-intelligence/${uploadId}/classify?paso=clasificar`)
      router.refresh()
    } catch {
      alert('No se pudo reprocesar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" size={size} disabled={busy} onClick={run}>
      {busy ? 'Reprocesando…' : 'Reprocesar'}
    </Button>
  )
}
