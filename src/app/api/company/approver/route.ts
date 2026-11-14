import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!supabaseAdmin) return NextResponse.json({ error: 'Falta la clave de administración local' }, { status: 503 })

  const { data: caller } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', session.user.id)
    .single()
  if (!caller?.company_id || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Solo un administrador de la empresa puede agregar un aprobador' }, { status: 403 })
  }

  const body = await request.json()
  const email = String(body.email || '').trim().toLowerCase()
  const fullName = String(body.fullName || '').trim()
  const password = String(body.password || '')
  const role = body.role === 'admin' ? 'admin' : 'manager'
  if (!email.includes('@') || fullName.length < 3 || password.length < 8) {
    return NextResponse.json({ error: 'Nombre, correo y una contraseña de al menos 8 caracteres son obligatorios' }, { status: 400 })
  }

  const created = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (created.error || !created.data.user) {
    return NextResponse.json({ error: created.error?.message || 'No se pudo crear el aprobador' }, { status: 400 })
  }

  const userId = created.data.user.id
  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: userId,
    email,
    full_name: fullName,
    role,
    company_id: caller.company_id,
    updated_at: new Date().toISOString(),
  })
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })

  await supabaseAdmin.from('company_user_roles').upsert({
    user_id: userId,
    company_id: caller.company_id,
    role,
  }, { onConflict: 'user_id,company_id' })

  return NextResponse.json({
    id: userId,
    email,
    role,
    mailed: false,
  })
}
