import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireSpendAccess } from '@/lib/spend-access'
import { normalizeRetentionDays, readExternalAi } from '@/lib/spend-privacy'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const access = await requireSpendAccess('admin')
  if (!access.ok) return access.response

  const body = await request.json().catch(() => ({}))
  const enabled = body.enabled === true
  const retentionDays = normalizeRetentionDays(body.retention_days)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'No se pudo guardar la autorización' }, { status: 503 })
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: company, error: readError } = await admin
    .from('companies')
    .select('settings')
    .eq('id', access.profile.company_id)
    .single()

  if (readError || !company) {
    return NextResponse.json({ error: 'No se encontró la empresa' }, { status: 404 })
  }

  const previous = readExternalAi(company.settings)

  const externalAi = {
    enabled,
    accepted_at: enabled ? (previous.accepted_at || new Date().toISOString()) : previous.accepted_at,
    accepted_by: enabled ? (previous.accepted_by || access.profile.id) : previous.accepted_by,
    retention_days: retentionDays,
  }

  const { error } = await admin
    .from('companies')
    .update({
      settings: {
        ...(company.settings || {}),
        external_ai: externalAi,
      },
    })
    .eq('id', access.profile.company_id)

  if (error) {
    console.error('Error saving external AI authorization')
    return NextResponse.json({ error: 'No se pudo guardar la autorización' }, { status: 500 })
  }

  return NextResponse.json({ success: true, external_ai: externalAi })
}
