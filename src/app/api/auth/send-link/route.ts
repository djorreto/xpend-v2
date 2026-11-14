import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { accessEmail, mailConfigured, sendMail } from '@/lib/mail'

export const runtime = 'nodejs'

function appBase(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && /^https?:\/\//.test(origin)) return origin.replace(/\/$/, '')
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/$/, '')
  return new URL(request.url).origin
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'No se pudo preparar el correo de recuperación.' }, { status: 503 })
  }
  if (!mailConfigured()) {
    return NextResponse.json({ error: 'El correo de recuperación no está configurado.' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  if (!email.includes('@')) {
    return NextResponse.json({ error: 'Escribe un correo válido.' }, { status: 400 })
  }

  const redirectBase = appBase(request)
  const linkResult = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${redirectBase}/reset-password` },
  })

  const tokenHash = linkResult.data?.properties?.hashed_token
  if (!tokenHash) {
    // Misma respuesta si el correo no existe, para no revelar cuentas.
    return NextResponse.json({ ok: true, mailed: true })
  }

  const link = `${redirectBase}/reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`
  const message = accessEmail({
    title: 'Cambia tu contraseña',
    intro: 'Recibimos una solicitud para entrar de nuevo a Xpend. El enlace caduca pronto y la nueva contraseña debe tener al menos 6 caracteres.',
    link,
  })
  const mailed = await sendMail({
    to: email,
    subject: 'Recupera tu contraseña de Xpend',
    ...message,
  })

  if (!mailed.sent) {
    return NextResponse.json({ error: 'No se pudo enviar el correo. Intenta de nuevo en unos minutos.' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, mailed: true })
}
