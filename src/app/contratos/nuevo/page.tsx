'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { LoadingSpinner } from '@/components/ui/loading'
import { useToast } from '@/components/ui/toast'
import { supabaseBrowser } from '@/lib/supabase'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { errorMessage } from '@/lib/errors'

export default function NuevoContratoPage() {
  return (
    <Suspense fallback={<MainLayout><LoadingSpinner /></MainLayout>}>
      <NuevoContratoForm />
    </Suspense>
  )
}

function NuevoContratoForm() {
  const router = useRouter()
  const params = useSearchParams()
  const { addToast } = useToast()
  const [session, setSession] = useState<AppSession | null>(null)
  const [suppliers, setSuppliers] = useState<{ id: string; fantasy_name: string }[]>([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('Servicio')
  const [supplierId, setSupplierId] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [awardId, setAwardId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadAppSession().then(async appSession => {
      if (!appSession || appSession.role === 'supplier') {
        router.push('/sala')
        return
      }
      setSession(appSession)
      const { data } = await supabaseBrowser().from('suppliers').select('id, fantasy_name').eq('company_id', appSession.companyId)
      setSuppliers(data || [])
      const award = params.get('award')
      if (!award) return
      const { data: won } = await supabaseBrowser().from('process_awards').select('id, supplier_id, amount, currency, scope_summary').eq('id', award).maybeSingle()
      if (!won) return
      setAwardId(won.id)
      setSupplierId(won.supplier_id)
      setName(`Contrato desde adjudicación ${won.currency} ${won.amount}`)
      setNotes(`Borrador copiado de la adjudicación. Monto de origen ${won.currency} ${won.amount}. ${won.scope_summary || ''}`)
    })
  }, [params, router])

  const save = async () => {
    if (!session?.companyId || !code.trim() || !name.trim()) return
    setSaving(true)
    const { data, error } = await supabaseBrowser().from('contracts').insert({
      company_id: session.companyId,
      code: code.trim(),
      name: name.trim(),
      contract_type: type,
      supplier_id: supplierId || null,
      counterparty_name: counterparty.trim() || null,
      origin: awardId ? 'award' : 'upload',
      award_id: awardId,
      owner_id: session.userId,
      notes: notes.trim() || null,
      created_by: session.userId,
      status: 'draft',
    }).select('id').single()
    if (error || !data) {
      setSaving(false)
      addToast({ type: 'error', title: 'No se creó', message: errorMessage(error, 'Revisa el código.') })
      return
    }
    if (file) {
      const body = new FormData()
      body.set('file', file)
      body.set('contractId', data.id)
      body.set('kind', 'original')
      const response = await fetch('/api/contracts/ingest', { method: 'POST', body })
      const payload = await response.json()
      if (!response.ok) {
        addToast({ type: 'error', title: 'El contrato quedó sin archivo', message: payload.error || 'No se procesó el documento.' })
      } else if (payload.processing === 'unprocessable') {
        addToast({ type: 'success', title: 'Archivo guardado', message: 'No se pudo extraer texto. Los campos quedan pendientes de confirmación.' })
      } else {
        addToast({ type: 'success', title: 'Texto extraído', message: 'Los datos encontrados quedan pendientes. Nada se confirmó solo.' })
      }
    }
    setSaving(false)
    router.push(`/contratos/${data.id}`)
  }

  if (!session) return <MainLayout><LoadingSpinner /></MainLayout>

  return (
    <MainLayout user={{ name: session.name, email: session.email, role: session.role }} companyName={session.companyName}>
      <Card>
        <CardHeader><CardTitle>Cargar contrato</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div><Label>Código</Label><Input value={code} onChange={event => setCode(event.target.value)} placeholder="CTR-MANT-2026" /></div>
          <div><Label>Nombre</Label><Input value={name} onChange={event => setName(event.target.value)} /></div>
          <div><Label>Tipo</Label><Input value={type} onChange={event => setType(event.target.value)} /></div>
          <div>
            <Label>Proveedor del catálogo</Label>
            <select className="w-full rounded-md border bg-background p-2" value={supplierId} onChange={event => setSupplierId(event.target.value)}>
              <option value="">Sin ficha</option>
              {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.fantasy_name}</option>)}
            </select>
          </div>
          <div className="md:col-span-2"><Label>Contraparte si no está en el catálogo</Label><Input value={counterparty} onChange={event => setCounterparty(event.target.value)} /></div>
          <div className="md:col-span-2"><Label>Archivo PDF o DOCX</Label><Input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => setFile(event.target.files?.[0] || null)} /></div>
          <div className="md:col-span-2"><Textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Observaciones" /></div>
          <Button disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar contrato'}</Button>
        </CardContent>
      </Card>
    </MainLayout>
  )
}
