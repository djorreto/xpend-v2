import { NextRequest, NextResponse } from 'next/server'
import { requireSpendAccess } from '@/lib/spend-access'
import { assessLines, monthlyTotals } from '@/lib/spend-aggregate'
import { loadSpendFacts, viewFromRow } from '@/lib/spend-read'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const access = await requireSpendAccess('analyst')
  if (!access.ok) return access.response
  const { supabase, profile } = access
  const uploadId = request.nextUrl.searchParams.get('upload_id')
  const groupId = request.nextUrl.searchParams.get('group_id')
  if (!uploadId && !groupId) {
    return NextResponse.json({ error: 'Falta el análisis o el grupo.' }, { status: 400 })
  }

  try {
    if (uploadId) {
      const { data: upload } = await supabase
        .from('si_uploads')
        .select('id, tax_basis, display_currency, fx_mode, fx_rates, window_mode, window_year, window_end, has_dates, decisions_confirmed')
        .eq('id', uploadId)
        .eq('company_id', profile.company_id)
        .limit(1)
      const row = upload?.[0]
      if (!row) return NextResponse.json({ error: 'No se encontró el análisis.' }, { status: 404 })
      const facts = await loadSpendFacts(supabase, profile.company_id, [row], false)
      const assessed = assessLines(facts, viewFromRow(row))
      if ('error' in assessed) return NextResponse.json({ error: assessed.error, has_dates: row.has_dates }, { status: 409 })
      const series = monthlyTotals(assessed.kept)
      return NextResponse.json({
        currency: assessed.display,
        ...series,
        excluded: assessed.excluded,
        skipped_undated: assessed.undated,
        has_dates: row.has_dates,
        decisions_confirmed: row.decisions_confirmed,
      })
    }

    const { data: group } = await supabase
      .from('si_spend_groups')
      .select('id, display_currency, fx_mode, fx_rates, window_mode, window_year, window_end')
      .eq('id', groupId)
      .eq('company_id', profile.company_id)
      .limit(1)
    const row = group?.[0]
    if (!row) return NextResponse.json({ error: 'No se encontró el grupo.' }, { status: 404 })
    const { data: members } = await supabase
      .from('si_uploads')
      .select('id, tax_basis, has_dates')
      .eq('group_id', groupId)
      .eq('company_id', profile.company_id)
    const facts = await loadSpendFacts(supabase, profile.company_id, members || [], false)
    const assessed = assessLines(facts, viewFromRow(row))
    if ('error' in assessed) return NextResponse.json({ error: assessed.error }, { status: 409 })
    const series = monthlyTotals(assessed.kept)
    return NextResponse.json({
      currency: assessed.display,
      ...series,
      excluded: assessed.excluded,
      skipped_undated: assessed.undated,
      has_dates: (members || []).some(item => item.has_dates),
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo armar el gráfico.' }, { status: 500 })
  }
}
