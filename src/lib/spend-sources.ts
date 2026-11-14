import type { SupabaseClient } from '@supabase/supabase-js'

/** Fila normalizada para dashboards, spend y reportes (MVP: fuente única vía CSV en Sourcing Intelligence). */
export type UnifiedSpendRow = {
  amount: number
  category: string
  date: string
  supplier: string
  currency: string
}

export type MoneyTotal = { currency: string; amount: number }

export function normalizeCurrency(value?: string | null) {
  const code = String(value || 'CLP').trim().toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : 'CLP'
}

/** Suma por moneda. Pesos y dólares no entran en el mismo total. */
export function totalsByCurrency(rows: { amount?: number | null; currency?: string | null }[]): MoneyTotal[] {
  const map = new Map<string, number>()
  for (const row of rows) {
    const amount = Number(row.amount) || 0
    if (!amount) continue
    const currency = normalizeCurrency(row.currency)
    map.set(currency, (map.get(currency) || 0) + amount)
  }
  return Array.from(map.entries())
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}

/** La moneda con más líneas. Sirve para gráficos que no pueden mezclar escalas. */
export function primaryCurrency(rows: { currency?: string | null }[]) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const currency = normalizeCurrency(row.currency)
    counts.set(currency, (counts.get(currency) || 0) + 1)
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'CLP'
}

/**
 * Prioriza líneas de SI (carga Excel/CSV) si existen; si no, usa spend_data legado/manual.
 * Evita mezclar ambas fuentes en el mismo agregado para no duplicar montos.
 */
async function fetchPages<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
) {
  const pageSize = 1000
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await load(from, from + pageSize - 1)
    if (error) throw error
    const page = data || []
    for (let i = 0; i < page.length; i += 1) rows.push(page[i])
    if (!data || data.length < pageSize) return rows
  }
}

export async function fetchUnifiedSpendForCompany(
  supabase: SupabaseClient,
  companyId: string
): Promise<UnifiedSpendRow[]> {
  const siLines = await fetchPages(async (from, to) =>
    supabase
      .from('si_spend_lines')
      .select('amount, amount_net, category, supplier_name, purchase_date, currency')
      .eq('company_id', companyId)
      .order('id')
      .range(from, to)
  )

  if (siLines && siLines.length > 0) {
    return siLines.map(row => ({
      amount: Number(row.amount_net ?? row.amount) || 0,
      category: (row.category as string)?.trim() || 'Sin categoría',
      date:
        row.purchase_date != null
          ? String(row.purchase_date).slice(0, 10)
          : new Date().toISOString().slice(0, 10),
      supplier: (row.supplier_name as string)?.trim() || 'Sin proveedor',
      currency: normalizeCurrency(row.currency as string | null),
    }))
  }

  const spendRows = await fetchPages(async (from, to) =>
    supabase
      .from('spend_data')
      .select('amount, category, supplier, date')
      .eq('company_id', companyId)
      .order('date')
      .range(from, to)
  )

  return (spendRows || []).map(row => {
    const r = row as {
      amount: unknown
      category?: string | null
      supplier?: string | null
      date: unknown
      currency?: string | null
    }
    return {
      amount: Number(r.amount) || 0,
      category: r.category?.trim() || 'Sin categoría',
      date: String(r.date).slice(0, 10),
      supplier: r.supplier?.trim() || 'Sin proveedor',
      currency: normalizeCurrency(r.currency),
    }
  })
}

export type SpendSourceInfo = {
  active: 'si_spend_lines' | 'spend_data' | 'none'
  label: string
  siLines: number
  legacyLines: number
  needsReview: number
}

/** Dice cuál cifra está vigente. Si hay líneas de SI, spend_data no entra en los totales. */
export async function describeSpendSource(
  supabase: SupabaseClient,
  companyId: string
): Promise<SpendSourceInfo> {
  const [si, legacy, review] = await Promise.all([
    supabase.from('si_spend_lines').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('spend_data').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase
      .from('si_spend_lines')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('needs_review', true),
  ])

  const siLines = si.count || 0
  const legacyLines = legacy.count || 0
  const needsReview = review.count || 0
  const active = siLines > 0 ? 'si_spend_lines' : legacyLines > 0 ? 'spend_data' : 'none'
  const label =
    active === 'si_spend_lines'
      ? `Gasto vigente: carga de Sourcing Intelligence (${siLines} líneas). La tabla antigua no se suma.`
      : active === 'spend_data'
        ? `Gasto vigente: spend histórico (${legacyLines} líneas). Aún no hay una carga de Sourcing Intelligence.`
        : 'Todavía no hay gasto cargado.'

  return { active, label, siLines, legacyLines, needsReview }
}

export type SpendClosure = {
  id: string
  period: string
  source: string
  line_count: number
  total_amount: number
  closed_at: string
}

export async function closeSpendPeriod(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  period = new Date().toISOString().slice(0, 7)
) {
  const [rows, source] = await Promise.all([
    fetchUnifiedSpendForCompany(supabase, companyId),
    describeSpendSource(supabase, companyId),
  ])
  const monthRows = rows.filter(row => row.date.startsWith(period))
  const totals = totalsByCurrency(monthRows)
  const sourceName = source.active === 'si_spend_lines' ? 'si_spend_lines' : 'spend_data'
  if (totals.length > 1) {
    return {
      error: null,
      mixed: true,
      missingTable: false,
      period,
      total: 0,
      totals,
      lineCount: monthRows.length,
    }
  }
  const total = totals[0]?.amount || 0
  const { error } = await supabase.from('spend_closures').upsert({
    company_id: companyId,
    period,
    source: sourceName,
    line_count: monthRows.length,
    total_amount: total,
    closed_by: userId,
    closed_at: new Date().toISOString(),
  }, { onConflict: 'company_id,period' })

  return {
    error: error?.message || null,
    mixed: false,
    missingTable: !!error && /spend_closures|schema cache|does not exist/i.test(error.message),
    period,
    total,
    totals,
    lineCount: monthRows.length,
  }
}

export async function latestSpendClosure(supabase: SupabaseClient, companyId: string) {
  const { data, error } = await supabase
    .from('spend_closures')
    .select('id, period, source, line_count, total_amount, closed_at')
    .eq('company_id', companyId)
    .order('period', { ascending: false })
    .limit(1)
  if (error) return null
  return (data?.[0] || null) as SpendClosure | null
}
