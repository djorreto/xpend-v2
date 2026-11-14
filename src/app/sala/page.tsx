'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import {
  OFFER_MODALITIES,
  loadAppSession,
  missingTable,
  modalityName,
  type AppSession,
  type OfferEvent,
} from '@/lib/offer-room'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  open: 'Abierta',
  closed: 'Cerrada',
  awarded: 'Adjudicada',
  cancelled: 'Cancelada',
}

export default function SalaPage() {
  const router = useRouter()
  const [session, setSession] = useState<AppSession | null>(null)
  const [events, setEvents] = useState<OfferEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [setupNeeded, setSetupNeeded] = useState(false)

  useEffect(() => {
    const load = async () => {
      const appSession = await loadAppSession()
      if (!appSession) {
        router.push('/login')
        return
      }
      setSession(appSession)
      const supabase = supabaseBrowser()
      let query = supabase.from('offer_events').select('*').order('created_at', { ascending: false })
      if (appSession.role === 'supplier') {
        if (!appSession.supplierId) {
          setEvents([])
          setLoading(false)
          return
        }
        const { data: invites, error: inviteError } = await supabase
          .from('offer_invitations')
          .select('event_id')
          .eq('supplier_id', appSession.supplierId)
        if (missingTable(inviteError)) {
          setSetupNeeded(true)
          setLoading(false)
          return
        }
        const ids = (invites || []).map(invite => invite.event_id)
        if (!ids.length) {
          setEvents([])
          setLoading(false)
          return
        }
        query = supabase.from('offer_events').select('*').in('id', ids)
      } else if (appSession.companyId) {
        query = query.eq('company_id', appSession.companyId)
      }

      const { data, error } = await query
      if (missingTable(error)) setSetupNeeded(true)
      else setEvents((data || []) as OfferEvent[])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading || !session) {
    return (
      <MainLayout>
        <LoadingSpinner />
      </MainLayout>
    )
  }

  const isSupplier = session.role === 'supplier'

  return (
    <MainLayout user={{ name: session.name, email: session.email, role: session.role }} companyName={session.companyName}>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1>Sala de Ofertas</h1>
            <p className="mt-1 max-w-2xl text-[13px] text-petrol-blue/55">
              Aquí el proveedor entra a competir. El comprador invita, abre la sala y adjudica.
              No es un catálogo: es el cierre del proceso.
            </p>
          </div>
          {!isSupplier && (
            <Button onClick={() => router.push('/sala/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva sala
            </Button>
          )}
        </div>

        {setupNeeded && (
          <Card>
            <CardContent className="p-5 text-sm text-petrol-blue/70">
              Falta aplicar la migración <span className="font-medium">v3-sala-de-ofertas.sql</span> en el Supabase de V3.
              Sin esas tablas y políticas, los sobres no quedan cerrados de verdad.
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {OFFER_MODALITIES.map(modality => (
            <Card key={modality.id}>
              <CardHeader>
                <CardTitle>{modality.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs leading-relaxed text-petrol-blue/60">{modality.summary}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isSupplier ? 'Invitaciones' : 'Salas de la empresa'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {events.length === 0 && (
              <p className="text-sm text-petrol-blue/50">
                {isSupplier
                  ? 'Todavía no tienes una invitación. El comprador tiene que asociar tu usuario al proveedor.'
                  : 'Todavía no hay salas. Ábrela desde una iniciativa cuando las bases estén listas.'}
              </p>
            )}
            {events.map(event => (
              <button
                key={event.id}
                type="button"
                onClick={() => router.push(isSupplier ? `/sala/${event.id}/participar` : `/sala/${event.id}`)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/70"
              >
                <div>
                  <p className="text-sm text-petrol-blue">{event.title}</p>
                  <p className="text-xs text-petrol-blue/50">{modalityName(event.modality)}</p>
                </div>
                <span className="text-xs text-petrol-blue/60">{STATUS_LABEL[event.status] || event.status}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
