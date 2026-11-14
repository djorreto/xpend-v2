import { NextRequest, NextResponse } from 'next/server'
import { requireSpendAccess } from '@/lib/spend-access'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const access = await requireSpendAccess('manager')
    if (!access.ok) return access.response
    const { supabase, profile } = access

    const body = await request.json().catch(() => ({}))
    const uploadId = body?.upload_id
    if (!uploadId || typeof uploadId !== 'string') {
      return NextResponse.json({ error: 'upload_id requerido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('si_uploads')
      .delete()
      .eq('id', uploadId)
      .eq('company_id', profile.company_id)
      .select('id')

    if (error) throw error
    if (!data?.length) {
      return NextResponse.json({ error: 'No se encontró la carga o no puedes borrarla' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch {
    console.error('Error deleting SI upload')
    return NextResponse.json({ error: 'No se pudo borrar la carga' }, { status: 500 })
  }
}
