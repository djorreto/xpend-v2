'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { LoadingSpinner } from '@/components/ui/loading'
import { formatCurrency } from '@/lib/utils'
import { errorMessage } from '@/lib/errors'
import { bidTotal, ndaBlocksDocuments, technicalIsComplete } from '@/lib/offer-bid'
import { offerFilePath } from '@/lib/storage-paths'
import {
  loadAppSession,
  modalityName,
  type AppSession,
  type OfferEvent,
} from '@/lib/offer-room'

type Partida = { description: string; quantity: string; unit: string; unitPrice: string }
type OwnBid = { id: string; amount: number | null; status: string; technical_summary: string | null; version: number }

const EMPTY_LINE: Partida = { description: '', quantity: '1', unit: 'mes', unitPrice: '' }

export default function ParticiparPage() {
  const params = useParams()
  const eventId = params.id as string
  const router = useRouter()
  const { addToast } = useToast()
  const [session, setSession] = useState<AppSession | null>(null)
  const [event, setEvent] = useState<OfferEvent | null>(null)
  const [invitationStatus, setInvitationStatus] = useState<string | null>(null)
  const [acceptedVersion, setAcceptedVersion] = useState<string | null>(null)
  const [draft, setDraft] = useState<OwnBid | null>(null)
  const [technical, setTechnical] = useState('')
  const [requirement, setRequirement] = useState('')
  const [partidas, setPartidas] = useState<Partida[]>([{ ...EMPTY_LINE }, { ...EMPTY_LINE, unit: 'gl' }])
  const [file, setFile] = useState<File | null>(null)
  const [documentName, setDocumentName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const appSession = await loadAppSession()
    if (!appSession) {
      router.push('/login')
      return
    }
    setSession(appSession)
    const supabase = supabaseBrowser()
    const { data: room } = await supabase.from('offer_events').select('*').eq('id', eventId).single()
    const current = (room || null) as OfferEvent | null
    setEvent(current)
    if (!current || !appSession.supplierId) {
      setLoading(false)
      return
    }
    const [{ data: invitation }, { data: acceptance }, { data: ownBids }] = await Promise.all([
      supabase.from('offer_invitations').select('status').eq('event_id', eventId).eq('supplier_id', appSession.supplierId).maybeSingle(),
      supabase.from('nda_acceptances').select('document_version').eq('event_id', eventId).eq('supplier_id', appSession.supplierId).order('accepted_at', { ascending: false }).limit(1),
      supabase.from('offer_bids').select('id, amount, status, technical_summary, version').eq('event_id', eventId).eq('supplier_id', appSession.supplierId).limit(1),
    ])
    setInvitationStatus(invitation?.status || null)
    setAcceptedVersion(acceptance?.[0]?.document_version || null)
    const currentBid = (ownBids?.[0] || null) as OwnBid | null
    setDraft(currentBid)
    if (currentBid?.technical_summary) setTechnical(currentBid.technical_summary)
    if (currentBid && currentBid.status === 'draft') {
      const { data: savedLines } = await supabase
        .from('offer_bid_lines')
        .select('description, quantity, unit, unit_price')
        .eq('bid_id', currentBid.id)
        .order('position')
      if (savedLines?.length) {
        setPartidas(savedLines.map(line => ({
          description: line.description,
          quantity: String(line.quantity),
          unit: line.unit,
          unitPrice: String(line.unit_price),
        })))
      }
    }
    if (current?.licitacion_id) {
      const { data: licitacion } = await supabase
        .from('licitaciones')
        .select('tender_document_name')
        .eq('id', current.licitacion_id)
        .maybeSingle()
      setDocumentName(licitacion?.tender_document_name || null)
    }
    setLoading(false)
  }, [eventId, router])

  useEffect(() => {
    load()
  }, [load])

  const blockedByNda = event
    ? ndaBlocksDocuments({
      required: Boolean(event.nda_required),
      acceptedVersion,
      currentVersion: event.nda_version || '1',
    })
    : false

  const parsedLines = partidas.map(line => ({
    description: line.description,
    quantity: Number(line.quantity),
    unit: line.unit,
    unitPrice: Number(line.unitPrice),
  }))
  const total = bidTotal(parsedLines)

  const acceptInvitation = async () => {
    if (!session?.supplierId) return
    const { error } = await supabaseBrowser()
      .from('offer_invitations')
      .update({ status: 'accepted' })
      .eq('event_id', eventId)
      .eq('supplier_id', session.supplierId)
    if (error) {
      addToast({ type: 'error', title: 'No se aceptó', message: errorMessage(error, 'No se pudo aceptar la invitación.') })
      return
    }
    addToast({ type: 'success', title: 'Invitación aceptada', message: 'Ya puedes preparar tu propuesta.' })
    load()
  }

  const acceptNda = async () => {
    if (!session?.supplierId || !event) return
    const { error } = await supabaseBrowser().from('nda_acceptances').insert({
      company_id: event.company_id,
      event_id: eventId,
      supplier_id: session.supplierId,
      user_id: session.userId,
      document_version: event.nda_version || '1',
      method: 'accepted',
    })
    if (error) {
      addToast({ type: 'error', title: 'No se registró', message: errorMessage(error, 'No se pudo aceptar el NDA.') })
      return
    }
    addToast({ type: 'success', title: 'NDA aceptado', message: 'Esta aceptación no es una firma electrónica.' })
    load()
  }

  const downloadBases = async () => {
    if (!event?.licitacion_id || blockedByNda) return
    const supabase = supabaseBrowser()
    const { data: licitacion } = await supabase
      .from('licitaciones')
      .select('tender_document_path, tender_document_name')
      .eq('id', event.licitacion_id)
      .maybeSingle()
    if (!licitacion?.tender_document_path) {
      addToast({ type: 'error', title: 'Sin archivo', message: 'El comprador todavía no publicó un documento.' })
      return
    }
    const { data, error } = await supabase.storage.from('documents').download(licitacion.tender_document_path)
    if (error || !data) {
      addToast({ type: 'error', title: 'Acceso bloqueado', message: errorMessage(error, 'No puedes descargar este documento.') })
      return
    }
    const url = URL.createObjectURL(data)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = licitacion.tender_document_name || 'bases'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const persist = async (present: boolean) => {
    if (!session?.supplierId || !event) return
    if (present && (!technicalIsComplete(technical) || total == null)) {
      addToast({
        type: 'error',
        title: 'Falta completar la propuesta',
        message: 'Escribe la oferta técnica y al menos una partida con cantidad, unidad y precio.',
      })
      return
    }
    setSaving(true)
    const supabase = supabaseBrowser()
    try {
      let bidId = draft?.status === 'draft' ? draft.id : null
      if (!bidId) {
        const { data, error } = await supabase.from('offer_bids').insert({
          event_id: eventId,
          supplier_id: session.supplierId,
          status: 'draft',
          currency: event.currency,
          technical_summary: technical,
        }).select('id').single()
        if (error) throw error
        bidId = data.id
      } else {
        const { error } = await supabase.from('offer_bids').update({
          technical_summary: technical,
          currency: event.currency,
        }).eq('id', bidId)
        if (error) throw error
      }
      await supabase.from('offer_bid_lines').delete().eq('bid_id', bidId)
      const rows = parsedLines.filter(line => line.description.trim() && line.quantity > 0 && line.unitPrice >= 0 && line.unit.trim())
      if (rows.length) {
        const { error } = await supabase.from('offer_bid_lines').insert(rows.map((line, index) => ({
          bid_id: bidId,
          event_id: eventId,
          supplier_id: session.supplierId,
          position: index + 1,
          description: line.description.trim(),
          quantity: line.quantity,
          unit: line.unit.trim(),
          unit_price: line.unitPrice,
          currency: event.currency,
        })))
        if (error) throw error
      }
      if (requirement.trim()) {
        await supabase.from('offer_bid_answers').delete().eq('bid_id', bidId).eq('requirement_key', 'requisitos')
        const { error } = await supabase.from('offer_bid_answers').insert({
          bid_id: bidId,
          event_id: eventId,
          supplier_id: session.supplierId,
          requirement_key: 'requisitos',
          response: requirement.trim(),
        })
        if (error) throw error
      }
      if (file && session.companyId) {
        const path = offerFilePath(session.companyId, eventId, session.supplierId, file.name)
        const uploaded = await supabase.storage.from('documents').upload(path, file, { upsert: false })
        if (uploaded.error) throw uploaded.error
        const { error } = await supabase.from('offer_bid_files').insert({
          bid_id: bidId,
          event_id: eventId,
          supplier_id: session.supplierId,
          kind: 'technical',
          storage_path: path,
          file_name: file.name,
        })
        if (error) throw error
        setFile(null)
      }
      if (present) {
        const { error } = await supabase.from('offer_bids').update({
          status: 'submitted',
          technical_summary: technical,
          currency: event.currency,
        }).eq('id', bidId)
        if (error) throw error
      }
      addToast({
        type: 'success',
        title: present ? 'Oferta presentada' : 'Borrador guardado',
        message: present
          ? `Quedó presentada por ${formatCurrency(total || 0, event.currency)}.`
          : 'Puedes seguir editándola antes del cierre.',
      })
      load()
    } catch (error) {
      addToast({ type: 'error', title: 'No se guardó', message: errorMessage(error, 'No se pudo guardar la oferta.') })
    } finally {
      setSaving(false)
    }
  }

  if (loading || !session) {
    return <MainLayout><LoadingSpinner /></MainLayout>
  }

  if (!event) {
    return (
      <MainLayout user={{ name: session.name, email: session.email, role: session.role }}>
        <p className="text-sm text-petrol-blue/60">Esta sala no está disponible.</p>
      </MainLayout>
    )
  }

  const presented = draft?.status === 'submitted'
  const canEdit = invitationStatus != null && event.status === 'open' && !presented && !blockedByNda

  return (
    <MainLayout user={{ name: session.name, email: session.email, role: session.role }} companyName={session.companyName}>
      <div className="mx-auto max-w-3xl space-y-5">
        <Button variant="outline" onClick={() => router.push('/sala')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Mis salas
        </Button>
        <div>
          <h1>{event.title}</h1>
          <p className="mt-1 text-[13px] text-petrol-blue/55">
            {modalityName(event.modality)} · {event.currency}
            {event.closes_at ? ` · cierra ${new Date(event.closes_at).toLocaleString('es-CL')}` : ''}
          </p>
        </div>

        {!session.supplierId && (
          <Card><CardContent className="p-5 text-sm">Tu usuario no está ligado a un proveedor.</CardContent></Card>
        )}
        {session.supplierId && !invitationStatus && (
          <Card><CardContent className="p-5 text-sm">No estás invitado a esta sala.</CardContent></Card>
        )}

        {invitationStatus === 'invited' && (
          <Card>
            <CardHeader><CardTitle>Invitación</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">Puedes aceptar participar o rechazar la invitación.</p>
              <div className="flex gap-2">
                <Button onClick={acceptInvitation}>Aceptar invitación</Button>
                <Button variant="outline" onClick={async () => {
                  await supabaseBrowser().from('offer_invitations').update({ status: 'declined' }).eq('event_id', eventId).eq('supplier_id', session.supplierId)
                  load()
                }}>Rechazar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {invitationStatus && event.nda_required && (
          <Card>
            <CardHeader><CardTitle>Acuerdo de confidencialidad</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm whitespace-pre-wrap">{event.nda_text || 'El comprador exige aceptar el NDA antes de ver los documentos.'}</p>
              <p className="text-xs text-muted-foreground">Versión {event.nda_version || '1'}. Aceptar deja constancia. No es una firma electrónica.</p>
              {blockedByNda ? (
                <Button onClick={acceptNda}>Aceptar NDA</Button>
              ) : (
                <p className="text-sm">NDA aceptado para esta versión.</p>
              )}
            </CardContent>
          </Card>
        )}

        {invitationStatus && (
          <Card>
            <CardHeader><CardTitle>Documentos del proceso</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {blockedByNda && <p className="text-sm">Los documentos confidenciales están bloqueados hasta aceptar el NDA.</p>}
              {!blockedByNda && (
                <Button variant="outline" onClick={downloadBases} disabled={!documentName}>
                  {documentName ? `Descargar ${documentName}` : 'Todavía no hay bases publicadas'}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {invitationStatus && invitationStatus !== 'declined' && (
          <Card>
            <CardHeader><CardTitle>{presented ? 'Oferta presentada' : 'Tu propuesta'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {presented && (
                <p className="text-sm">
                  Versión {draft?.version}. Total {formatCurrency(draft?.amount || 0, event.currency)}. Ya no se puede modificar.
                </p>
              )}
              {!presented && event.status !== 'open' && (
                <p className="text-sm">La recepción está cerrada. No se puede presentar una oferta nueva.</p>
              )}
              <div className="space-y-2">
                <Label htmlFor="technical">Oferta técnica</Label>
                <Textarea id="technical" rows={4} disabled={!canEdit} value={technical} onChange={eventInput => setTechnical(eventInput.target.value)} placeholder="Cómo ejecutarías el servicio, equipo y plazos." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requirement">Respuesta al requisito</Label>
                <Textarea id="requirement" rows={3} disabled={!canEdit} value={requirement} onChange={eventInput => setRequirement(eventInput.target.value)} placeholder="Respuesta al requisito técnico pedido en las bases." />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Oferta económica</p>
                {partidas.map((line, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-4">
                    <Input disabled={!canEdit} placeholder="Partida" value={line.description} onChange={eventInput => setPartidas(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, description: eventInput.target.value } : item))} />
                    <Input disabled={!canEdit} type="number" min="0" placeholder="Cantidad" value={line.quantity} onChange={eventInput => setPartidas(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: eventInput.target.value } : item))} />
                    <Input disabled={!canEdit} placeholder="Unidad" value={line.unit} onChange={eventInput => setPartidas(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, unit: eventInput.target.value } : item))} />
                    <Input disabled={!canEdit} type="number" min="0" placeholder="Precio" value={line.unitPrice} onChange={eventInput => setPartidas(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, unitPrice: eventInput.target.value } : item))} />
                  </div>
                ))}
                {canEdit && <Button type="button" variant="outline" onClick={() => setPartidas(current => [...current, { ...EMPTY_LINE }])}>Agregar partida</Button>}
                <p className="text-sm">Total {total == null ? 'incompleto' : formatCurrency(total, event.currency)}</p>
              </div>
              {canEdit && (
                <div className="space-y-2">
                  <Label htmlFor="annex">Anexo técnico o económico</Label>
                  <Input id="annex" type="file" onChange={eventInput => setFile(eventInput.target.files?.[0] || null)} />
                </div>
              )}
              {canEdit && (
                <div className="flex gap-2">
                  <Button variant="outline" disabled={saving} onClick={() => persist(false)}>Guardar borrador</Button>
                  <Button disabled={saving} onClick={() => persist(true)}>Presentar oferta</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
