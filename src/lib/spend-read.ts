import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeMoneyCode, type FxMode, type WindowMode } from '@/lib/spend-basis'
import type { SpendFact, ViewSettings } from '@/lib/spend-aggregate'

const PAGE = 4000

type UploadScope = {
  id: string
  tax_basis?: string | null
  display_currency?: string | null
  fx_mode?: string | null
  fx_rates?: Record<string, number> | null
  fx_as_of?: string | null
  window_mode?: string | null
  window_year?: number | null
  window_end?: string | null
  group_id?: string | null
  file_name?: string | null
  decisions_confirmed?: boolean | null
}

export function viewFromRow(row: {
  display_currency?: string | null
  fx_mode?: string | null
  fx_rates?: Record<string, number> | null
  window_mode?: string | null
  window_year?: number | null
  window_end?: string | null
}): ViewSettings {
  const mode = row.fx_mode === 'observed' || row.fx_mode === 'fixed' ? row.fx_mode : 'native'
  const windowMode: WindowMode = row.window_mode === 'calendar' || row.window_mode === 'rolling' ? row.window_mode : 'all'
  return {
    displayCurrency: row.display_currency || null,
    fxMode: mode as FxMode,
    fxRates: row.fx_rates || {},
    windowMode,
    windowYear: row.window_year || null,
    windowEnd: row.window_end || null,
  }
}

export async function loadSpendFacts(
  supabase: SupabaseClient,
  companyId: string,
  uploads: UploadScope[],
  classifiedOnly: boolean
): Promise<SpendFact[]> {
  const facts: SpendFact[] = []
  for (const upload of uploads) {
    const gross = upload.tax_basis === 'gross'
    for (let from = 0; ; from += PAGE) {
      let query = supabase
        .from('si_spend_lines')
        .select('category, amount_net, currency, supplier_name, purchase_date, tax_rate_applied')
        .eq('upload_id', upload.id)
        .eq('company_id', companyId)
        .order('line_number', { ascending: true })
        .range(from, from + PAGE - 1)
      if (classifiedOnly) query = query.not('category', 'is', null)
      const { data, error } = await query
      if (error) throw error
      if (!data?.length) break
      for (const line of data) {
        facts.push({
          category: (line.category as string) || null,
          amountNet: Number(line.amount_net) || 0,
          currency: normalizeMoneyCode(line.currency) || String(line.currency || 'USD').toUpperCase(),
          supplier: (line.supplier_name as string) || null,
          purchaseDate: line.purchase_date ? String(line.purchase_date).slice(0, 10) : null,
          unresolvedTax: gross && line.tax_rate_applied == null,
        })
      }
      if (data.length < PAGE) break
    }
  }
  return facts
}
