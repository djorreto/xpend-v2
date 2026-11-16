'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { LoadingSpinner } from '@/components/ui/loading'
import { OFFER_MODALITIES, loadAppSession, type AppSession, type OfferModality } from '@/lib/offer-room'
import { salaSeedFromDossier } from '@/lib/dossier'
import { saveDossier } from '@/lib/dossier-store'

export default function NewSalaPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [session, setSession] = useState<AppSession | null>(null)
  const [saving, setSaving] = useState(false)
  const [planId, setPlanId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    modality: 'sealed' as OfferModality,
    currency: 'CLP',
    opens_at: '',
    closes_at: '',
    min_decrement_pct: '1',
    show_leading_price: true,
    licitacion_id: '',
    notes: '',
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const linkedPlan = params.get('planId')
    const linkedLicitacion = params.get('licitacionId')
    if (linkedPlan) setPlanId(linkedPlan)
    if (linkedLicitacion) setForm(prev => ({ ...prev, licitacion_id: linkedLicitacion }))
    loadAppSession().then(async appSession => {
      if (!appSession) {
        router.push('/login')
        return
      }
      if (appSession.role === 'supplier') {
        router.push('/sala')
        return
      }
      setSession(appSession)
      const supabase = supabaseBrowser()
      const [{ data: plans }, { data: lics }] = await Promise.all([
        linkedPlan
          ? supabase.from('sourcing_plans').select('title, currency, estimated_spend').eq('id', linkedPlan).limit(1)
          : Promise.resolve({ data: [] as { title: string; currency: string | null; estimated_spend: number | null }[] }),
        linkedLicitacion
          ? supabase.from('licitaciones').select('name, baseline_currency, baseline_amount').eq('id', linkedLicitacion).limit(1)
          : Promise.resolve({ data: [] as { name: string; baseline_currency: string | null; baseline_amount: number | null }[] }),
      ])
      const seed = salaSeedFromDossier({ plan: plans?.[0], licitacion: lics?.[0] })
      if (seed.title || seed.currency) {
        setForm(prev => ({
          ...prev,
          title: prev.title || seed.title,
          currency: seed.currency || prev.currency,
        }))
      }
    })
  }, [router])

  const createRoom = async () => {
    if (!session?.companyId || !form.title.trim()) {
      addToast({ type: 'error', title: 'Falta el título', message: 'La sala necesita un nombre.' })
      return
    }
    setSaving(true)
    const supabase = supabaseBrowser()
    const { data, error } = await supabase
      .from('offer_events')
      .insert({
        company_id: session.companyId,
        sourcing_plan_id: planId,
        licitacion_id: form.licitacion_id.trim() || null,
        title: form.title.trim(),
        modality: form.modality,
        status: 'draft',
        currency: form.currency || 'CLP',
        opens_at: form.opens_at ? new Date(form.opens_at).toISOString() : null,
        closes_at: form.closes_at ? new Date(form.closes_at).toISOString() : null,
        min_decrement_pct: form.modality === 'reverse_auction' ? Number(form.min_decrement_pct) || 0 : 0,
        show_leading_price: form.show_leading_price,
        notes: form.notes || null,
        created_by: session.userId,
      })
      .select('id')
      .single()

    setSaving(false)
    if (error || !data) {
      addToast({
        type: 'error',
        title: 'No se pudo crear la sala',
        message: error?.message || 'Revisa que la migración de Sala de Ofertas esté aplicada.',
      })
      return
    }

    if (form.modality === 'sealed' || form.modality === 'reverse_auction' || form.modality === 'rounds') {
      await supabase.from('offer_rounds').insert({
        event_id: data.id,
        round_number: 1,
        status: 'scheduled',
        opens_at: form.opens_at ? new Date(form.opens_at).toISOString() : null,
        closes_at: form.closes_at ? new Date(form.closes_at).toISOString() : null,
      })
    }

    if (session.companyId) {
      await saveDossier(supabase, {
        companyId: session.companyId,
        userId: session.userId,
        title: form.title.trim(),
        sourcingPlanId: planId,
        licitacionId: form.licitacion_id.trim() || null,
        offerEventId: data.id,
        currency: form.currency,
        stage: 'sala',
      })
    }

    router.push(`/sala/${data.id}`)
  }

  if (!session) {
    return (
      <MainLayout>
        <LoadingSpinner />
      </MainLayout>
    )
  }

  return (
    <MainLayout user={{ name: session.name, email: session.email, role: session.role }} companyName={session.companyName}>
      <div className="mx-auto max-w-2xl space-y-5">
        <Button variant="outline" onClick={() => router.push('/sala')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <div>
          <h1>Nueva sala</h1>
          <p className="mt-1 text-[13px] text-petrol-blue/75">Elige cómo van a competir los proveedores.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Modalidad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {OFFER_MODALITIES.map(modality => (
              <label key={modality.id} className="flex cursor-pointer gap-3 rounded-xl px-3 py-3 hover:bg-white/60">
                <input
                  type="radio"
                  name="modality"
                  checked={form.modality === modality.id}
                  onChange={() => setForm(prev => ({ ...prev, modality: modality.id }))}
                />
                <span>
                  <span className="block text-sm text-petrol-blue">{modality.name}</span>
                  <span className="block text-xs text-petrol-blue/75">{modality.summary}</span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4 p-5">
            <div>
              <Label>Título</Label>
              <Input value={form.title} onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Apertura</Label>
                <Input type="datetime-local" value={form.opens_at} onChange={event => setForm(prev => ({ ...prev, opens_at: event.target.value }))} />
              </div>
              <div>
                <Label>Cierre</Label>
                <Input type="datetime-local" value={form.closes_at} onChange={event => setForm(prev => ({ ...prev, closes_at: event.target.value }))} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Moneda</Label>
                <Input value={form.currency} onChange={event => setForm(prev => ({ ...prev, currency: event.target.value.toUpperCase() }))} />
              </div>
              {form.modality === 'reverse_auction' && (
                <div>
                  <Label>Mejora mínima (%)</Label>
                  <Input value={form.min_decrement_pct} onChange={event => setForm(prev => ({ ...prev, min_decrement_pct: event.target.value }))} />
                </div>
              )}
            </div>
            <div>
              <Label>ID de licitación, si ya existe</Label>
              <Input value={form.licitacion_id} onChange={event => setForm(prev => ({ ...prev, licitacion_id: event.target.value }))} />
            </div>
            <div>
              <Label>Notas para los invitados</Label>
              <Textarea value={form.notes} onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))} />
            </div>
            <Button onClick={createRoom} disabled={saving}>
              {saving ? 'Creando…' : 'Crear sala'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
