import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { requireSpendAccess } from '@/lib/spend-access'
import { supabaseAdmin } from '@/lib/supabase'
import { forgetSpendModel } from '@/lib/spend-model'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL_PATH = join(process.cwd(), 'data', 'xpend-taxonomia-v1.json')

function missingTable(error: { message?: string; code?: string } | null) {
  const message = error?.message || ''
  return error?.code === '42P01' || /si_model_versions/.test(message) && /does not exist|schema cache|Could not find/i.test(message)
}

async function requireSuperAdmin() {
  const access = await requireSpendAccess('admin')
  if (!access.ok) return access
  if (access.profile.role !== 'super_admin') {
    return { ok: false as const, response: NextResponse.json({ error: 'Solo un super admin puede ver las versiones del modelo.' }, { status: 403 }) }
  }
  if (!supabaseAdmin) {
    return { ok: false as const, response: NextResponse.json({ error: 'Falta la llave de servicio de Supabase.' }, { status: 503 }) }
  }
  return { ok: true as const, admin: supabaseAdmin, profile: access.profile }
}

export async function GET() {
  const access = await requireSuperAdmin()
  if (!access.ok) return access.response
  const { data, error } = await access.admin
    .from('si_model_versions')
    .select('id, name, status, is_active, trained_at, holdout_accuracy, rows_count, class_count, notes, created_at')
    .order('created_at', { ascending: true })
  if (error) {
    return NextResponse.json({
      error: missingTable(error)
        ? 'Falta la tabla si_model_versions. Hay que aplicar database/migrations/v3-model-versions.sql en Supabase.'
        : error.message,
      missing_table: missingTable(error),
    }, { status: missingTable(error) ? 424 : 500 })
  }
  return NextResponse.json({ versions: data || [] })
}

export async function POST(request: NextRequest) {
  const access = await requireSuperAdmin()
  if (!access.ok) return access.response
  const body = await request.json().catch(() => ({}))
  const action = body?.action

  if (action === 'register-base') {
    if (!existsSync(MODEL_PATH)) {
      return NextResponse.json({ error: 'No está el archivo del modelo base en el servidor.' }, { status: 404 })
    }
    const payload = JSON.parse(readFileSync(MODEL_PATH, 'utf8')) as {
      name?: string
      trained_at?: string
      classes?: unknown[]
      metrics?: { holdout20?: number; rows?: number }
    }
    const name = payload.name || 'xpend-taxonomia-v1'
    const { data: existing } = await access.admin
      .from('si_model_versions')
      .select('id')
      .eq('name', name)
      .limit(1)
    if (existing?.length) {
      return NextResponse.json({ ok: true, already: true, name })
    }
    const { count } = await access.admin
      .from('si_model_versions')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
    const { error } = await access.admin.from('si_model_versions').insert({
      name,
      status: 'base',
      is_active: (count || 0) === 0,
      trained_at: payload.trained_at || '2026-11-06',
      holdout_accuracy: payload.metrics?.holdout20 ?? 0.814,
      rows_count: payload.metrics?.rows ?? 62037,
      class_count: payload.classes?.length ?? null,
      notes: 'Modelo base. No se pisa cuando salga una versión nueva.',
      payload,
    })
    if (error) {
      return NextResponse.json({
        error: missingTable(error)
          ? 'Falta la tabla si_model_versions. Hay que aplicar database/migrations/v3-model-versions.sql en Supabase.'
          : error.message,
      }, { status: 500 })
    }
    forgetSpendModel()
    return NextResponse.json({ ok: true, name })
  }

  if (action === 'activate') {
    const name = String(body?.name || '')
    if (!name) return NextResponse.json({ error: 'Falta el nombre de la versión.' }, { status: 400 })
    const { data: target, error: readError } = await access.admin
      .from('si_model_versions')
      .select('name, status')
      .eq('name', name)
      .limit(1)
    if (readError || !target?.length) {
      return NextResponse.json({ error: readError?.message || 'Esa versión no está en la base.' }, { status: 404 })
    }
    await access.admin
      .from('si_model_versions')
      .update({ is_active: false, status: 'archivada' })
      .eq('is_active', true)
      .neq('status', 'base')
    await access.admin
      .from('si_model_versions')
      .update({ is_active: false })
      .eq('status', 'base')
    const nextStatus = target[0].status === 'base' ? 'base' : 'publicada'
    const { error } = await access.admin
      .from('si_model_versions')
      .update({ is_active: true, status: nextStatus })
      .eq('name', name)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    forgetSpendModel()
    return NextResponse.json({ ok: true, name })
  }

  return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 })
}
