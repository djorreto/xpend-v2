import type { SupabaseClient } from '@supabase/supabase-js'
import { loadSchedules, type InitiativeSchedule } from './annual-plan-data.ts'
import { loadPortfolio, type PortfolioData } from './portfolio-data.ts'
import { loadSavings, type SavingsBundle } from './savings-data.ts'

export type ManagementData = { schedules: InitiativeSchedule[]; portfolio: PortfolioData; savings: SavingsBundle }

// Una sola carga para el panel de gestión y para "Mi portafolio": mismas fuentes, mismas cifras.
export async function loadManagement(supabase: SupabaseClient, companyId: string, role: string, year: number): Promise<ManagementData> {
  const portfolio = await loadPortfolio(supabase, companyId)
  const [schedules, savings] = await Promise.all([
    loadSchedules(supabase, companyId, year, role),
    loadSavings(supabase, companyId, year, { withEvidence: false, assignments: portfolio.assignments }),
  ])
  return { schedules, portfolio, savings }
}
