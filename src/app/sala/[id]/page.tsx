'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { LoadingSpinner } from '@/components/ui/loading'
import { formatCurrency } from '@/lib/utils'
import { awardSavings, syncPlanFromLicitacion } from '@/lib/procurement-flow'
import { saveDossier } from '@/lib/dossier-store'
import { errorMessage } from '@/lib/errors'
import { licitacionDocumentPath } from '@/lib/storage-paths'
import { DossierThread } from '@/components/dossier-thread'
import {
  buyerCanReadBidContent,
  loadAppSession,
  modalityName,
  type AppSession,
  type OfferEvent,
} from '@/lib/offer-room'

type Round = { id: string; round_number: number; status: string }
type Invite = { id: string; supplier_id: string; status: string; contact_email: string | null; supplier?: { fantasy_name: string } | { fantasy_name: string }[] | null }
type Bid = { id: string; supplier_id: string; amount: number; round_id: string | null; submitted_at: string }
type Line = { id: string; item_name: string; unit: string | null; quantity: number | null; reference_price: number | null }
type AdhesionOffer = { id: string; line_id: string; supplier_id: string; unit_price: number; accepted: boolean }

export default function SalaDetailPage() {
  const params = useParams()
  const eventId = params.id as string
  const router = useRouter()
  const { addToast } = useToast()
  const [session, setSession] = useState<AppSession | null>(null)
  const [event, setEvent] = useState<OfferEvent | null>(null)
  const [rounds, setRounds] = useState<Round[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [catalog, setCatalog] = useState<{ id: string; fantasy_name: string }[]>([])
  const [bids, setBids] = useState<Bid[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [offers, setOffers] = useState<AdhesionOffer[]>([])
  const [lineName, setLineName] = useState('')
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({})
  const [accessLink, setAccessLink] = useState<string | null>(null)
  const [submissions, setSubmissions] = useState<{ supplier_id: string; status: string; version: number }[]>([])
  const [ndaText, setNdaText] = useState('')
  const [newSupplier, setNewSupplier] = useState({ fantasy: '', legal: '', rut: '', email: '' })
  const [notice, setNotice] = useState('Bases confidenciales del proceso.')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const appSession = await loadAppSession()
    if (!appSession) {
      router.push('/login')
      return
    }
    if (appSession.role === 'supplier') {
      router.push(`/sala/${eventId}/participar`)
      return
    }
    setSession(appSession)
    const supabase = supabaseBrowser()
    const { data: room } = await supabase.from('offer_events').select('*').eq('id', eventId).single()
    if (!room) {
      setLoading(false)
      return
    }
    const current = room as OfferEvent
    setEvent(current)
    setNdaText(current.nda_text || '')
    const contentVisible = buyerCanReadBidContent(current)
    const [roundRes, inviteRes, supplierRes, bidRes, lineRes, offerRes, submissionRes] = await Promise.all([
      supabase.from('offer_rounds').select('id, round_number, status').eq('event_id', eventId).order('round_number'),
      supabase.from('offer_invitations').select('id, supplier_id, status, contact_email, supplier:suppliers(fantasy_name)').eq('event_id', eventId),
      appSession.companyId
        ? supabase.from('suppliers').select('id, fantasy_name').eq('company_id', appSession.companyId).order('fantasy_name')
        : Promise.resolve({ data: [] }),
      contentVisible
        ? supabase.from('offer_bids').select('id, supplier_id, amount, round_id, submitted_at').eq('event_id', eventId).eq('status', 'submitted')
        : Promise.resolve({ data: [] }),
      supabase.from('adhesion_lines').select('id, item_name, unit, quantity, reference_price').eq('event_id', eventId),
      contentVisible
        ? supabase.from('adhesion_offers').select('id, line_id, supplier_id, unit_price, accepted').eq('event_id', eventId)
        : Promise.resolve({ data: [] }),
      supabase.rpc('list_offer_submissions', { target_event: eventId }),
    ])
    setRounds(roundRes.data || [])
    setInvites((inviteRes.data || []) as Invite[])
    setCatalog(supplierRes.data || [])
    setBids(bidRes.data || [])
    setLines(lineRes.data || [])
    setOffers(offerRes.data || [])
    setSubmissions(submissionRes.data || [])
    setLoading(false)
  }, [eventId, router])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!event || event.modality !== 'reverse_auction' || event.status !== 'open') return
    const timer = window.setInterval(() => {
      load()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [event, load])

  const supplierName = (id: string) => {
    const invite = invites.find(item => item.supplier_id === id)
    const linked = invite?.supplier
    const row = Array.isArray(linked) ? linked[0] : linked
    return row?.fantasy_name || catalog.find(item => item.id === id)?.fantasy_name || id
  }

  const setStatus = async (status: OfferEvent['status']) => {
    const supabase = supabaseBrowser()
    const patch: Record<string, string> = { status, updated_at: new Date().toISOString() }
    if (status === 'open') {
      await supabase.from('offer_rounds').update({ status: 'open' }).eq('event_id', eventId).eq('round_number', 1)
    }
    if (status === 'closed') {
      await supabase.from('offer_rounds').update({ status: 'closed' }).eq('event_id', eventId).eq('status', 'open')
    }
    const { error } = await supabase.from('offer_events').update(patch).eq('id', eventId)
    if (error) {
      addToast({ type: 'error', title: 'No se pudo actualizar', message: error.message })
      return
    }
    load()
  }

  const invite = async (supplierId: string, emailOverride?: string) => {
    const email = (emailOverride || inviteEmail[supplierId] || '').trim()
    const supabase = supabaseBrowser()
    if (!email) {
      const { error } = await supabase.from('offer_invitations').insert({ event_id: eventId, supplier_id: supplierId })
      if (error) addToast({ type: 'error', title: 'No se pudo invitar', message: error.message })
      else load()
      return
    }
    const { data: { session: authSession } } = await supabase.auth.getSession()
    const response = await fetch('/api/sala/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession?.access_token || ''}` },
      body: JSON.stringify({ eventId, supplierId, email }),
    })
    const body = await response.json()
    if (!response.ok) {
      addToast({ type: 'error', title: 'No se pudo crear el acceso', message: body.error || 'Error' })
      return
    }
    setAccessLink(body.link || null)
    addToast({
      type: 'success',
      title: body.mailed ? 'Correo enviado' : 'Acceso creado',
      message: body.mailed
        ? `Se envió el acceso a ${email}.`
        : body.link
          ? 'Todavía no hay correo configurado. Copia el enlace y pásalo al proveedor.'
          : `Quedó invitado ${email}.`,
    })
    load()
  }

  const openEnvelopes = async () => {
    const supabase = supabaseBrowser()
    const { error } = await supabase.from('offer_events').update({
      offers_opened_at: new Date().toISOString(),
      offers_opened_by: session?.userId,
      updated_at: new Date().toISOString(),
    }).eq('id', eventId)
    if (error) {
      addToast({ type: 'error', title: 'No se abrieron', message: errorMessage(error, 'Cierra la recepción antes de abrir los sobres.') })
      return
    }
    addToast({ type: 'success', title: 'Sobres abiertos', message: 'Las ofertas quedan disponibles para evaluar.' })
    load()
  }

  const publishNotice = async () => {
    if (!session?.companyId || !event?.licitacion_id || !notice.trim()) return
    const supabase = supabaseBrowser()
    const file = new File([notice], 'aclaracion.txt', { type: 'text/plain' })
    const path = licitacionDocumentPath(session.companyId, event.licitacion_id, file.name)
    const uploaded = await supabase.storage.from('documents').upload(path, file, { upsert: false })
    if (uploaded.error) {
      addToast({ type: 'error', title: 'No se publicó', message: uploaded.error.message })
      return
    }
    const { error } = await supabase.from('licitaciones').update({
      tender_document_path: path,
      tender_document_name: file.name,
      tender_document_size: file.size,
    }).eq('id', event.licitacion_id)
    if (error) addToast({ type: 'error', title: 'No se vinculó el documento', message: error.message })
    else addToast({ type: 'success', title: 'Documento publicado', message: 'Queda en el historial del almacenamiento.' })
  }

  const saveNda = async (required: boolean) => {
    const { error } = await supabaseBrowser().from('offer_events').update({
      nda_required: required,
      nda_text: ndaText,
      updated_at: new Date().toISOString(),
    }).eq('id', eventId)
    if (error) addToast({ type: 'error', title: 'No se guardó el NDA', message: error.message })
    else load()
  }

  const createSupplier = async () => {
    if (!session?.companyId || !newSupplier.fantasy.trim() || !newSupplier.legal.trim() || !newSupplier.rut.trim() || !newSupplier.email.includes('@')) {
      addToast({ type: 'error', title: 'Faltan datos', message: 'Nombre, razón social, RUT y correo son obligatorios.' })
      return
    }
    const supabase = supabaseBrowser()
    const supplierId = `supplier-${Date.now()}`
    const { error } = await supabase.from('suppliers').insert({
      id: supplierId,
      company_id: session.companyId,
      fantasy_name: newSupplier.fantasy.trim(),
      legal_name: newSupplier.legal.trim(),
      rut: newSupplier.rut.trim(),
      service_type: 'Mantenimiento industrial',
      is_active: true,
      created_by: session.userId,
    })
    if (error) {
      addToast({ type: 'error', title: 'No se creó el proveedor', message: errorMessage(error, 'No se pudo crear el proveedor.') })
      return
    }
    setInviteEmail(prev => ({ ...prev, [supplierId]: newSupplier.email.trim() }))
    setNewSupplier({ fantasy: '', legal: '', rut: '', email: '' })
    await invite(supplierId, newSupplier.email.trim())
  }

  const nextRound = async () => {
    const supabase = supabaseBrowser()
    await supabase.from('offer_rounds').update({ status: 'closed' }).eq('event_id', eventId).eq('status', 'open')
    const next = rounds.reduce((max, round) => Math.max(max, round.round_number), 0) + 1
    await supabase.from('offer_rounds').insert({ event_id: eventId, round_number: next, status: 'open' })
    load()
  }

  const addLine = async () => {
    if (!lineName.trim()) return
    const supabase = supabaseBrowser()
    await supabase.from('adhesion_lines').insert({ event_id: eventId, item_name: lineName.trim() })
    setLineName('')
    load()
  }

  const award = async (supplierId: string, amount: number) => {
    if (!event) return
    const supabase = supabaseBrowser()
    const { error } = await supabase
      .from('offer_events')
      .update({
        status: 'awarded',
        winning_supplier_id: supplierId,
        winning_amount: amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId)
    if (error) {
      addToast({ type: 'error', title: 'No se pudo adjudicar', message: error.message })
      return
    }
    let savingsAmount: number | null = null
    if (event.licitacion_id) {
      const { data: lic } = await supabase
        .from('licitaciones')
        .select('baseline_amount')
        .eq('id', event.licitacion_id)
        .limit(1)
      const savings = awardSavings(lic?.[0]?.baseline_amount, amount)
      savingsAmount = savings.savings_amount
      await supabase
        .from('licitaciones')
        .update({
          status: 'awarded',
          awarded_amount: amount,
          award_date: new Date().toISOString().slice(0, 10),
          savings_amount: savings.savings_amount,
          savings_percentage: savings.savings_percentage,
        })
        .eq('id', event.licitacion_id)
      await syncPlanFromLicitacion(supabase, event.licitacion_id, 'awarded')
    }
    if (session?.companyId) {
      await saveDossier(supabase, {
        companyId: session.companyId,
        userId: session.userId,
        title: event.title,
        licitacionId: event.licitacion_id,
        offerEventId: eventId,
        stage: 'adjudicada',
        award: { supplier_id: supplierId, amount, savings_amount: savingsAmount },
      })
    }
    addToast({
      type: 'success',
      title: 'Adjudicada',
      message: 'El ahorro volvió a la licitación y queda visible en el comité.',
    })
    load()
  }

  const acceptOffer = async (offerId: string, accepted: boolean) => {
    await supabaseBrowser().from('adhesion_offers').update({ accepted }).eq('id', offerId)
    load()
  }

  if (loading || !session || !event) {
    return (
      <MainLayout>
        <LoadingSpinner />
      </MainLayout>
    )
  }

  const showAmounts = buyerCanReadBidContent(event)
  const invitedIds = new Set(invites.map(item => item.supplier_id))
  const ranking = [...bids].sort((a, b) => a.amount - b.amount)

  return (
    <MainLayout user={{ name: session.name, email: session.email, role: session.role }} companyName={session.companyName}>
      <div className="space-y-5">
        {session.companyId && session.role !== 'supplier' && (
          <DossierThread match={{ companyId: session.companyId, offerEventId: eventId, licitacionId: event.licitacion_id || undefined }} />
        )}
        <Button variant="outline" onClick={() => router.push('/sala')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Salas
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1>{event.title}</h1>
            <p className="mt-1 text-[13px] text-petrol-blue/55">
              {modalityName(event.modality)} · {event.currency}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {event.status === 'draft' && <Button onClick={() => setStatus('open')}>Abrir sala</Button>}
            {event.status === 'open' && <Button variant="outline" onClick={() => setStatus('closed')}>Cerrar recepción</Button>}
            {event.modality === 'sealed' && event.status === 'closed' && !event.offers_opened_at && (
              <Button onClick={openEnvelopes}>Abrir sobres</Button>
            )}
            {event.modality === 'rounds' && event.status === 'open' && (
              <Button variant="secondary" onClick={nextRound}>Abrir siguiente ronda</Button>
            )}
          </div>
        </div>

        {!showAmounts && (
          <Card>
            <CardContent className="p-5 text-sm text-petrol-blue/70">
              Los sobres siguen cerrados. Hay {submissions.length} oferta{submissions.length === 1 ? '' : 's'} presentada{submissions.length === 1 ? '' : 's'}. El contenido se ve después de la apertura.
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Invitados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {invites.map(inviteRow => (
                <div key={inviteRow.id} className="flex items-center justify-between gap-2">
                  <p className="text-sm text-petrol-blue">
                    {supplierName(inviteRow.supplier_id)} · {inviteRow.status}
                  </p>
                  {inviteRow.contact_email && (
                    <Button type="button" size="sm" variant="outline" onClick={() => invite(inviteRow.supplier_id, inviteRow.contact_email || '')}>
                      Reenviar acceso
                    </Button>
                  )}
                </div>
              ))}
              {invites.length === 0 && <p className="text-xs text-petrol-blue/50">Nadie invitado todavía.</p>}
              {accessLink && (
                <div className="rounded-xl bg-white/60 p-3">
                  <p className="text-xs text-petrol-blue/60">Enlace de acceso, por si el correo no sale:</p>
                  <p className="mt-1 break-all text-xs text-petrol-blue">{accessLink}</p>
                </div>
              )}
              {event.licitacion_id && (
                <div className="space-y-2 rounded-xl bg-white/50 p-3">
                  <p className="text-xs text-petrol-blue/60">Aclaración o bases. Cada publicación deja un archivo nuevo.</p>
                  <textarea className="min-h-16 w-full rounded-md border bg-background p-2 text-sm" value={notice} onChange={input => setNotice(input.target.value)} />
                  <Button type="button" variant="outline" onClick={publishNotice}>Publicar documento</Button>
                </div>
              )}
              <div className="space-y-2 rounded-xl bg-white/50 p-3">
                <p className="text-xs text-petrol-blue/60">NDA para ver documentos confidenciales. Aceptarlo no es una firma electrónica.</p>
                <textarea className="min-h-20 w-full rounded-md border bg-background p-2 text-sm" value={ndaText} onChange={input => setNdaText(input.target.value)} placeholder="Texto del NDA" />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => saveNda(true)}>Exigir NDA</Button>
                  <Button type="button" variant="outline" onClick={() => saveNda(false)}>No exigirlo</Button>
                </div>
              </div>
              <div className="grid gap-2 pt-2 md:grid-cols-2">
                <Input placeholder="Nombre" value={newSupplier.fantasy} onChange={input => setNewSupplier(prev => ({ ...prev, fantasy: input.target.value }))} />
                <Input placeholder="Razón social" value={newSupplier.legal} onChange={input => setNewSupplier(prev => ({ ...prev, legal: input.target.value }))} />
                <Input placeholder="RUT" value={newSupplier.rut} onChange={input => setNewSupplier(prev => ({ ...prev, rut: input.target.value }))} />
                <Input type="email" placeholder="Correo" value={newSupplier.email} onChange={input => setNewSupplier(prev => ({ ...prev, email: input.target.value }))} />
                <Button type="button" variant="outline" onClick={createSupplier}>Agregar e invitar</Button>
              </div>
              <div className="space-y-2 pt-2">
                {catalog.filter(supplier => !invitedIds.has(supplier.id)).slice(0, 8).map(supplier => (
                  <div key={supplier.id} className="flex gap-2">
                    <Input
                      type="email"
                      placeholder={`Correo de ${supplier.fantasy_name}`}
                      value={inviteEmail[supplier.id] || ''}
                      onChange={input => setInviteEmail(prev => ({ ...prev, [supplier.id]: input.target.value }))}
                    />
                    <Button type="button" variant="outline" onClick={() => invite(supplier.id)}>
                      Invitar
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{event.modality === 'rounds' ? 'Rondas' : 'Ofertas'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rounds.map(round => (
                <p key={round.id} className="text-sm text-petrol-blue">
                  Ronda {round.round_number}: {round.status}
                </p>
              ))}
              {showAmounts && ranking.map(bid => (
                <div key={bid.id} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2">
                  <div>
                    <p className="text-sm text-petrol-blue">{supplierName(bid.supplier_id)}</p>
                    <p className="text-xs text-petrol-blue/50">{formatCurrency(bid.amount, event.currency)}</p>
                  </div>
                  {event.status !== 'awarded' && (event.status === 'closed' || event.modality === 'reverse_auction') && (
                    <Button size="sm" variant="outline" onClick={() => award(bid.supplier_id, bid.amount)}>
                      Adjudicar
                    </Button>
                  )}
                </div>
              ))}
              {showAmounts && ranking.length === 0 && event.modality !== 'adhesion' && (
                <p className="text-xs text-petrol-blue/50">Todavía no hay ofertas visibles.</p>
              )}
              {event.winning_supplier_id && (
                <p className="text-sm text-petrol-blue">
                  Adjudicada a {supplierName(event.winning_supplier_id)} por {formatCurrency(event.winning_amount || 0, event.currency)}.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {event.modality === 'adhesion' && (
          <Card>
            <CardHeader>
              <CardTitle>Tabla de adhesión</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={lineName} placeholder="Ítem" onChange={input => setLineName(input.target.value)} />
                <Button variant="outline" onClick={addLine}>Agregar ítem</Button>
              </div>
              {lines.map(line => (
                <div key={line.id} className="rounded-xl bg-white/50 px-3 py-3">
                  <p className="text-sm text-petrol-blue">{line.item_name}</p>
                  {offers.filter(offer => offer.line_id === line.id).map(offer => (
                    <div key={offer.id} className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-xs text-petrol-blue/70">
                        {supplierName(offer.supplier_id)} · {formatCurrency(offer.unit_price, event.currency)}
                        {offer.accepted ? ' · aceptada' : ''}
                      </p>
                      <Button size="sm" variant="outline" onClick={() => acceptOffer(offer.id, !offer.accepted)}>
                        {offer.accepted ? 'Quitar' : 'Aceptar'}
                      </Button>
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
