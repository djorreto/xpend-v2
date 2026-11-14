import { supabaseBrowser } from '@/lib/supabase'

export const OFFER_MODALITIES = [
  {
    id: 'sealed',
    name: 'Sobre cerrado',
    summary: 'Cada proveedor envía un precio. Nadie ve los montos hasta el cierre.',
  },
  {
    id: 'rounds',
    name: 'Múltiples rondas',
    summary: 'Hay varias vueltas. La ronda abierta queda cerrada hasta que el comprador la cierra.',
  },
  {
    id: 'reverse_auction',
    name: 'Subasta inversa',
    summary: 'Durante la ventana, el precio baja. Cada oferta tiene que mejorar el mejor precio.',
  },
  {
    id: 'adhesion',
    name: 'Tabla de adhesión',
    summary: 'Varios proveedores adhieren precios por ítem. No hay un solo ganador.',
  },
] as const

export type OfferModality = (typeof OFFER_MODALITIES)[number]['id']

export type OfferEvent = {
  id: string
  company_id: string
  licitacion_id: string | null
  sourcing_plan_id: string | null
  title: string
  modality: OfferModality
  status: 'draft' | 'open' | 'closed' | 'awarded' | 'cancelled'
  currency: string
  opens_at: string | null
  closes_at: string | null
  min_decrement_pct: number | null
  show_leading_price: boolean
  notes: string | null
  winning_supplier_id: string | null
  winning_amount: number | null
  nda_required?: boolean
  nda_text?: string | null
  nda_version?: string
  offers_opened_at?: string | null
}

export type AppSession = {
  userId: string
  name: string
  email: string
  role: string
  companyId: string | null
  companyName?: string
  supplierId: string | null
}

export function modalityName(id: string) {
  return OFFER_MODALITIES.find(item => item.id === id)?.name || id
}

export function buyerCanSeeOpenAmounts(modality: string) {
  return modality === 'reverse_auction' || modality === 'adhesion'
}

export function buyerCanReadBidContent(event: { modality: string; status: string; offers_opened_at?: string | null }) {
  if (event.modality === 'sealed') return Boolean(event.offers_opened_at)
  if (event.modality === 'reverse_auction' || event.modality === 'adhesion') return true
  return event.status === 'closed' || event.status === 'awarded'
}

export function minimumNextBid(leading: number, decrementPct: number | null) {
  const pct = Number(decrementPct) || 0
  return leading * (1 - pct / 100)
}

export async function loadAppSession(): Promise<AppSession | null> {
  const supabase = supabaseBrowser()
  if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token })
      window.history.replaceState(null, '', window.location.pathname)
    }
  }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  let supplierId: string | null = null
  const withSupplier = await supabase
    .from('profiles')
    .select('id, full_name, role, company_id, supplier_id')
    .eq('id', session.user.id)
    .single()

  let profile = withSupplier.data
  if (withSupplier.error) {
    const fallback = await supabase
      .from('profiles')
      .select('id, full_name, role, company_id')
      .eq('id', session.user.id)
      .single()
    profile = fallback.data ? { ...fallback.data, supplier_id: null } : null
  } else {
    supplierId = profile?.supplier_id || null
  }

  if (!profile) return null

  let companyName: string | undefined
  if (profile.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', profile.company_id)
      .single()
    companyName = company?.name
  }

  return {
    userId: profile.id,
    name: profile.full_name || session.user.email || 'Usuario',
    email: session.user.email || '',
    role: profile.role || 'viewer',
    companyId: profile.company_id,
    companyName,
    supplierId,
  }
}

export function missingTable(error: { message?: string; code?: string } | null) {
  if (!error) return false
  const message = error.message || ''
  return error.code === '42P01' || /offer_events|schema cache|does not exist/i.test(message)
}
