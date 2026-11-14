import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { accessEmail, sendMail } from '@/lib/mail'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 })
  }

  const body = await request.json()
  const eventId = String(body.eventId || '')
  const supplierId = String(body.supplierId || '')
  const email = String(body.email || '').trim().toLowerCase()
  if (!eventId || !supplierId || !email.includes('@')) {
    return NextResponse.json({ error: 'Faltan la sala, el proveedor o un correo válido' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', session.user.id)
    .single()
  if (!profile || profile.role === 'supplier') {
    return NextResponse.json({ error: 'Sin permiso para invitar' }, { status: 403 })
  }

  const { data: event } = await supabase
    .from('offer_events')
    .select('id, company_id, title')
    .eq('id', eventId)
    .single()
  if (!event || event.company_id !== profile.company_id) {
    return NextResponse.json({ error: 'La sala no es de tu empresa' }, { status: 404 })
  }

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, fantasy_name')
    .eq('id', supplierId)
    .eq('company_id', profile.company_id)
    .single()
  if (!supplier) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sala`
  const linkResult = await supabaseAdmin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo,
      data: { full_name: supplier.fantasy_name, supplier_id: supplierId },
    },
  })

  let userId = linkResult.data.user?.id
  let actionLink = linkResult.data.properties?.action_link
  if (!userId) {
    const magic = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    })
    userId = magic.data.user?.id
    actionLink = magic.data.properties?.action_link || actionLink
    if (!userId) {
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      userId = existing?.id
    }
  }
  if (!userId) {
    return NextResponse.json({
      error: linkResult.error?.message || 'No se pudo crear el acceso del proveedor',
    }, { status: 400 })
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: userId,
    email,
    full_name: supplier.fantasy_name,
    role: 'supplier',
    company_id: profile.company_id,
    supplier_id: supplierId,
    updated_at: new Date().toISOString(),
  })
  if (profileError) {
    return NextResponse.json({
      error: /supplier_id|schema cache|column/i.test(profileError.message)
        ? 'Falta la columna supplier_id. Aplica v3-sala-de-ofertas.sql en el Supabase de V3.'
        : profileError.message,
    }, { status: 409 })
  }

  const { error: inviteError } = await supabaseAdmin.from('offer_invitations').upsert({
    event_id: eventId,
    supplier_id: supplierId,
    contact_email: email,
    status: 'invited',
  }, { onConflict: 'event_id,supplier_id' })
  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 })
  }

  if (!actionLink) {
    return NextResponse.json({ ok: true, email, mailed: false })
  }

  const message = accessEmail({
    title: 'Te invitaron a una sala de ofertas',
    intro: `${supplier.fantasy_name} quedó invitado a “${event.title}” en Xpend. Entra con este enlace para ofertar.`,
    link: actionLink,
  })
  const mailed = await sendMail({
    to: email,
    subject: `Invitación a ${event.title}`,
    ...message,
  })

  return NextResponse.json({
    ok: true,
    email,
    mailed: mailed.sent,
    link: mailed.sent ? undefined : actionLink,
    mailError: mailed.sent ? undefined : mailed.reason === 'rejected' ? mailed.message : undefined,
  })
}
