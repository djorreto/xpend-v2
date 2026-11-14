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
import {
  loadAppSession,
  minimumNextBid,
  modalityName,
  type AppSession,
  type OfferEvent,
} from '@/lib/offer-room'

type Line = { id: string; item_name: string; unit: string | null; quantity: number | null }
type OwnBid = { id: string; amount: number; round_id: string | null }

export default function ParticiparPage() {
  const params = useParams()
  const eventId = params.id as string
  const router = useRouter()
  const { addToast } = useToast()
  const [session, setSession] = useState<AppSession | null>(null)
  const [event, setEvent] = useState<OfferEvent | null>(null)
  const [invited, setInvited] = useState(false)
  const [openRoundId, setOpenRoundId] = useState<string | null>(null)
  const [bids, setBids] = useState<OwnBid[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [amount, setAmount] = useState('')
  const [leading, setLeading] = useState<number | null>(null)
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
    setEvent((room || null) as OfferEvent | null)
    if (!room || !appSession.supplierId) {
      setLoading(false)
      return
    }
    const { data: invitation } = await supabase
      .from('offer_invitations')
      .select('id')
      .eq('event_id', eventId)
      .eq('supplier_id', appSession.supplierId)
      .maybeSingle()
    setInvited(!!invitation)
    const { data: ownBids } = await supabase
      .from('offer_bids')
      .select('id, amount, round_id')
      .eq('event_id', eventId)
      .eq('supplier_id', appSession.supplierId)
    setBids(ownBids || [])
    const { data: roundRows } = await supabase
      .from('offer_rounds')
      .select('id, status')
      .eq('event_id', eventId)
      .eq('status', 'open')
      .limit(1)
    setOpenRoundId(roundRows?.[0]?.id || null)
    if (room.modality === 'adhesion') {
      const { data: lineRows } = await supabase
        .from('adhesion_lines')
        .select('id, item_name, unit, quantity')
        .eq('event_id', eventId)
      setLines(lineRows || [])
    }
    if (room.modality === 'reverse_auction' && room.status === 'open') {
      const response = await fetch(`/api/sala/${eventId}/leading`)
      if (response.ok) {
        const body = await response.json()
        setLeading(body.leading)
      }
    }
    setLoading(false)
  }, [eventId, router])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!event || event.modality !== 'reverse_auction' || event.status !== 'open') return
    const timer = window.setInterval(() => {
      fetch(`/api/sala/${eventId}/leading`)
        .then(response => response.ok ? response.json() : null)
        .then(body => {
          if (body && typeof body.leading === 'number') setLeading(body.leading)
        })
        .catch(() => undefined)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [event, eventId])

  const submitBid = async () => {
    if (!session?.supplierId || !event) return
    const value = Number(amount)
    if (!value || value <= 0) {
      addToast({ type: 'error', title: 'Monto inválido', message: 'Ingresa un precio mayor a cero.' })
      return
    }
    if (event.modality === 'sealed' && bids.length > 0) {
      addToast({ type: 'error', title: 'Sobre ya enviado', message: 'En sobre cerrado hay una sola oferta.' })
      return
    }
    if (event.modality === 'rounds' && bids.some(bid => bid.round_id === openRoundId)) {
      addToast({ type: 'error', title: 'Ronda ya ofertada', message: 'En esta ronda ya enviaste tu precio.' })
      return
    }
    if (event.modality === 'reverse_auction' && leading) {
      const floor = minimumNextBid(leading, event.min_decrement_pct)
      if (value > floor) {
        addToast({
          type: 'error',
          title: 'La oferta no mejora',
          message: `Tiene que ser de ${formatCurrency(floor, event.currency)} o menos.`,
        })
        return
      }
    }
    const { error } = await supabaseBrowser().from('offer_bids').insert({
      event_id: eventId,
      round_id: openRoundId,
      supplier_id: session.supplierId,
      amount: value,
    })
    if (error) {
      addToast({ type: 'error', title: 'No se envió', message: error.message })
      return
    }
    setAmount('')
    addToast({ type: 'success', title: 'Oferta enviada', message: 'Quedó registrada en la sala.' })
    load()
  }

  const submitAdhesion = async () => {
    if (!session?.supplierId) return
    const supabase = supabaseBrowser()
    for (const line of lines) {
      const value = Number(prices[line.id])
      if (!value) continue
      await supabase.from('adhesion_offers').upsert({
        line_id: line.id,
        event_id: eventId,
        supplier_id: session.supplierId,
        unit_price: value,
      }, { onConflict: 'line_id,supplier_id' })
    }
    addToast({ type: 'success', title: 'Adhesión enviada', message: 'El comprador puede aceptar tus precios por ítem.' })
    load()
  }

  if (loading || !session) {
    return (
      <MainLayout>
        <LoadingSpinner />
      </MainLayout>
    )
  }

  if (!event) {
    return (
      <MainLayout user={{ name: session.name, email: session.email, role: session.role }}>
        <p className="text-sm text-petrol-blue/60">Esta sala no está disponible.</p>
      </MainLayout>
    )
  }

  return (
    <MainLayout user={{ name: session.name, email: session.email, role: session.role }} companyName={session.companyName}>
      <div className="mx-auto max-w-xl space-y-5">
        <Button variant="outline" onClick={() => router.push('/sala')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Mis salas
        </Button>
        <div>
          <h1>{event.title}</h1>
          <p className="mt-1 text-[13px] text-petrol-blue/55">{modalityName(event.modality)}</p>
          {event.notes && <p className="mt-2 text-sm text-petrol-blue/70">{event.notes}</p>}
        </div>

        {!session.supplierId && (
          <Card>
            <CardContent className="p-5 text-sm text-petrol-blue/70">
              Tu usuario todavía no está ligado a un proveedor. En Supabase, el perfil necesita `supplier_id`
              para ofertar. El comprador invita a la empresa proveedora, no a un comprador interno.
            </CardContent>
          </Card>
        )}

        {session.supplierId && !invited && (
          <Card>
            <CardContent className="p-5 text-sm text-petrol-blue/70">
              No estás invitado a esta sala.
            </CardContent>
          </Card>
        )}

        {invited && event.status !== 'open' && (
          <Card>
            <CardContent className="p-5 text-sm text-petrol-blue/70">
              La recepción está {event.status === 'draft' ? 'en borrador' : 'cerrada'}.
              {bids.length > 0 && ` Tu última oferta fue ${formatCurrency(bids[bids.length - 1].amount, event.currency)}.`}
            </CardContent>
          </Card>
        )}

        {invited && event.status === 'open' && event.modality !== 'adhesion' && (
          <Card>
            <CardHeader>
              <CardTitle>Tu oferta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {event.modality === 'reverse_auction' && (
                <p className="text-sm text-petrol-blue/70">
                  {leading
                    ? `Mejor precio actual: ${formatCurrency(leading, event.currency)}. La siguiente oferta debe bajar al menos ${event.min_decrement_pct || 0}%.`
                    : 'Todavía no hay un precio líder. Puedes abrir la subasta.'}
                </p>
              )}
              {bids.length > 0 && (
                <p className="text-xs text-petrol-blue/50">
                  Ya enviaste {bids.length} oferta{bids.length === 1 ? '' : 's'}. La última es {formatCurrency(bids[bids.length - 1].amount, event.currency)}.
                </p>
              )}
              <Input
                type="number"
                min="0"
                placeholder={`Monto en ${event.currency}`}
                value={amount}
                onChange={input => setAmount(input.target.value)}
              />
              <Button onClick={submitBid}>Enviar oferta</Button>
            </CardContent>
          </Card>
        )}

        {invited && event.status === 'open' && event.modality === 'adhesion' && (
          <Card>
            <CardHeader>
              <CardTitle>Precios por ítem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lines.map(line => (
                <div key={line.id} className="grid grid-cols-[1fr_140px] items-center gap-3">
                  <p className="text-sm text-petrol-blue">
                    {line.item_name}
                    {line.unit ? ` · ${line.unit}` : ''}
                    {line.quantity ? ` · ${line.quantity}` : ''}
                  </p>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Precio"
                    value={prices[line.id] || ''}
                    onChange={input => setPrices(prev => ({ ...prev, [line.id]: input.target.value }))}
                  />
                </div>
              ))}
              <Button onClick={submitAdhesion}>Enviar adhesión</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
