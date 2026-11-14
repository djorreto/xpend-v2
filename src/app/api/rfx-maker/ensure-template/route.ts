import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { templatePlaceholders, templateStructure } from '@/lib/rfx-sections'

export const runtime = 'nodejs'

const NAME = 'Bases por secciones'

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!supabaseAdmin) return NextResponse.json({ error: 'Falta la service role' }, { status: 503 })

  const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  const { data: existing } = await supabaseAdmin
    .from('rfx_templates')
    .select('id, version_number, name')
    .eq('company_id', profile.company_id)
    .eq('is_active_version', true)
    .limit(1)
    .maybeSingle()

  if (existing) return NextResponse.json({ id: existing.id, version_number: existing.version_number || 1 })

  const { data, error } = await supabaseAdmin
    .from('rfx_templates')
    .insert({
      company_id: profile.company_id,
      name: NAME,
      description: 'Secciones en español. La persona no escribe variables.',
      status: 'active',
      template_structure: templateStructure(),
      placeholder_definitions: templatePlaceholders(),
      version_number: 1,
      is_active_version: true,
      created_by: session.user.id,
    })
    .select('id, version_number')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
