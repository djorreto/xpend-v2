import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role, supplier_id')
    .eq('id', session.user.id)
    .single()

  const { data: event, error } = await supabase
    .from('offer_events')
    .select('id, company_id, modality, status, currency, show_leading_price, min_decrement_pct')
    .eq('id', params.id)
    .single()

  if (error || !event) return NextResponse.json({ error: 'Sala no encontrada' }, { status: 404 })
  if (event.modality !== 'reverse_auction') {
    return NextResponse.json({ error: 'Esta sala no es una subasta inversa' }, { status: 400 })
  }

  const isBuyer = profile?.company_id === event.company_id && profile?.role !== 'supplier'
  let invited = false
  if (profile?.supplier_id) {
    const { data: invitation } = await supabase
      .from('offer_invitations')
      .select('id')
      .eq('event_id', event.id)
      .eq('supplier_id', profile.supplier_id)
      .maybeSingle()
    invited = !!invitation
  }
  if (!isBuyer && !invited) return NextResponse.json({ error: 'Sin invitación' }, { status: 403 })
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Falta la service role para calcular el mejor precio' }, { status: 503 })
  }

  const { data: bids } = await supabaseAdmin
    .from('offer_bids')
    .select('amount')
    .eq('event_id', event.id)

  const amounts = (bids || []).map(bid => Number(bid.amount)).filter(amount => amount > 0)
  const leading = amounts.length ? Math.min(...amounts) : null

  return NextResponse.json({
    leading: event.show_leading_price || isBuyer ? leading : null,
    rankOnly: !event.show_leading_price && !isBuyer,
    currency: event.currency,
    minDecrementPct: Number(event.min_decrement_pct) || 0,
    bidCount: amounts.length,
  })
}
