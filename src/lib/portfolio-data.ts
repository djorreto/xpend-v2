import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeName, type Category, type CategoryAssignment, type HistoryEntry, type Team, type TeamMember } from './portfolio.ts'

export type Person = { id: string; full_name: string | null; email: string | null; role: string }

export type PortfolioData = {
  categories: Category[]
  assignments: CategoryAssignment[]
  teams: Team[]
  members: TeamMember[]
  people: Person[]
}

// Perfiles internos de compras de la empresa (asignables). Los viewers y proveedores no figuran.
export async function loadPortfolio(supabase: SupabaseClient, companyId: string): Promise<PortfolioData> {
  const [categories, assignments, teams, members, people] = await Promise.all([
    supabase.from('procurement_categories').select('id, name, parent_id, source, taxonomy_ref, is_active').eq('company_id', companyId).order('name'),
    supabase.from('category_assignments').select('category_id, manager_user_id, backup_user_id, team_id').eq('company_id', companyId),
    supabase.from('procurement_teams').select('id, name, description, lead_user_id, is_active').eq('company_id', companyId).order('name'),
    supabase.from('procurement_team_members').select('team_id, user_id, member_role').eq('company_id', companyId),
    supabase.from('profiles').select('id, full_name, email, role').eq('company_id', companyId).in('role', ['admin', 'manager', 'analyst']).order('full_name'),
  ])
  return {
    categories: (categories.data || []) as Category[],
    assignments: (assignments.data || []) as CategoryAssignment[],
    teams: (teams.data || []) as Team[],
    members: (members.data || []) as TeamMember[],
    people: (people.data || []) as Person[],
  }
}

export async function loadHistory(supabase: SupabaseClient, companyId: string, limit = 60): Promise<HistoryEntry[]> {
  const { data } = await supabase
    .from('assignment_history')
    .select('id, entity_type, entity_id, role_kind, from_value, to_value, reason, changed_by, changed_at')
    .eq('company_id', companyId)
    .order('changed_at', { ascending: false })
    .limit(limit)
  return (data || []) as HistoryEntry[]
}

export function personName(person: Pick<Person, 'full_name' | 'email'> | undefined | null) {
  return person?.full_name || person?.email || 'Sin asignar'
}

// Devuelve la categoría estable con ese nombre; la crea solo si no existe. Nunca renombra ni fusiona.
export async function ensureCategory(
  supabase: SupabaseClient,
  companyId: string,
  name: string | null | undefined,
  options: { userId?: string | null; source?: Category['source']; taxonomyRef?: string | null } = {}
): Promise<string | null> {
  const clean = String(name ?? '').trim().replace(/\s+/g, ' ')
  if (!clean) return null
  const { data: existing } = await supabase.from('procurement_categories').select('id, name').eq('company_id', companyId).limit(1000)
  const hit = (existing || []).find(row => normalizeName(row.name) === normalizeName(clean))
  if (hit) return hit.id as string
  const { data, error } = await supabase
    .from('procurement_categories')
    .insert({ company_id: companyId, name: clean, source: options.source || 'taxonomia_spend', taxonomy_ref: options.taxonomyRef ?? clean, created_by: options.userId || null })
    .select('id')
    .single()
  if (error) return null
  return data.id as string
}

// Tras crear una iniciativa desde una oportunidad de Spend: fija la categoría estable y deja el vínculo oportunidad ↔ iniciativa
// (una oportunidad puede originar varias iniciativas). Es un complemento: si falla, la iniciativa ya creada no se pierde.
export async function linkInitiativeToOpportunity(
  supabase: SupabaseClient,
  params: { companyId: string; userId: string; planId: string; opportunityId: string; categoryName: string | null | undefined }
) {
  const categoryId = await ensureCategory(supabase, params.companyId, params.categoryName, { userId: params.userId })
  const { error } = await supabase
    .from('sourcing_plans')
    .update({ category_id: categoryId, si_plan_item_id: params.opportunityId })
    .eq('id', params.planId)
  return { categoryId, linked: !error }
}
