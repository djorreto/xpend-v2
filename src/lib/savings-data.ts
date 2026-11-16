import type { SupabaseClient } from '@supabase/supabase-js'
import type { CategoryAssignment } from './portfolio.ts'
import type { AwardLite, RecognitionLite, TargetLite, ValidationLite } from './savings.ts'

export type AwardRow = AwardLite & { backup_user_id: string | null; plan_id: string | null; plan_title: string | null; licitacion_name: string | null; supplier_name: string | null }
export type ValidationRow = ValidationLite & {
  method: string | null
  declared_at: string
  declare_note: string | null
  validated_at: string | null
  review_note: string | null
  licitacion_name: string | null
}
export type RecognitionRow = RecognitionLite & { evidence_id: string | null; note: string | null; recognized_by: string; recognized_at: string }
export type EvidenceRow = { id: string; validation_id: string; storage_path: string; file_name: string; mime_type: string | null; size_bytes: number | null; description: string | null; uploaded_by: string; uploaded_at: string }
export type SavingsEvent = { id: string; validation_id: string; event: string; actor_id: string | null; note: string | null; data: Record<string, unknown> | null; at: string }
export type ManualCandidate = { licitacion_id: string; name: string; currency: string; baseline: number; awarded: number }

export type SavingsBundle = {
  awards: AwardRow[]
  validations: ValidationRow[]
  recognitions: RecognitionRow[]
  evidence: EvidenceRow[]
  events: SavingsEvent[]
  targets: TargetLite[]
  manual: ManualCandidate[]
}

const num = (value: unknown) => (value == null ? null : Number(value))
const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null)

// Carga todo lo necesario para el control de ahorros. La evidencia y la auditoría solo se piden a quien puede leerlas.
export async function loadSavings(
  supabase: SupabaseClient,
  companyId: string,
  year: number,
  options: { withEvidence: boolean; assignments: CategoryAssignment[] }
): Promise<SavingsBundle> {
  const assignmentByCategory = new Map(options.assignments.map(item => [item.category_id, item]))
  const [awardRows, links, validations, recognitions, evidence, events, annual, licitaciones] = await Promise.all([
    supabase
      .from('process_awards')
      .select('id, licitacion_id, amount, currency, baseline_amount, baseline_currency, estimated_savings, awarded_at, licitacion:licitaciones(name), supplier:suppliers(fantasy_name, legal_name)')
      .eq('company_id', companyId)
      .order('awarded_at', { ascending: false })
      .limit(500),
    supabase.from('sourcing_plan_licitaciones').select('licitacion_id, plan:sourcing_plans(id, title, category_id, responsible_user_id, backup_user_id, team_id)').eq('company_id', companyId).limit(1000),
    supabase
      .from('savings_validations')
      .select('id, award_id, licitacion_id, sourcing_plan_id, category_id, owner_user_id, team_id, source_kind, currency, baseline_amount, awarded_amount, declared_amount, nature, recurrence, start_date, end_date, validated_amount, method, status, declared_by, declared_at, declare_note, validated_by, validated_at, review_note')
      .eq('company_id', companyId)
      .order('declared_at', { ascending: false })
      .limit(1000),
    supabase.from('savings_recognitions').select('id, validation_id, kind, period, currency, amount, evidence_id, reverses_id, note, recognized_by, recognized_at').eq('company_id', companyId).order('period', { ascending: false }).limit(2000),
    options.withEvidence
      ? supabase.from('savings_evidence').select('id, validation_id, storage_path, file_name, mime_type, size_bytes, description, uploaded_by, uploaded_at').eq('company_id', companyId).order('uploaded_at', { ascending: false }).limit(1000)
      : Promise.resolve({ data: [] as EvidenceRow[] }),
    options.withEvidence
      ? supabase.from('savings_events').select('id, validation_id, event, actor_id, note, data, at').eq('company_id', companyId).order('at', { ascending: false }).limit(300)
      : Promise.resolve({ data: [] as SavingsEvent[] }),
    supabase.from('annual_plans').select('id').eq('company_id', companyId).eq('plan_year', year).maybeSingle(),
    supabase.from('licitaciones').select('id, name, baseline_amount, baseline_currency, awarded_amount').eq('company_id', companyId).not('baseline_amount', 'is', null).not('awarded_amount', 'is', null).limit(500),
  ])

  type PlanRef = { id: string; title: string | null; category_id: string | null; responsible_user_id: string | null; backup_user_id: string | null; team_id: string | null }
  const planByLicitacion = new Map<string, PlanRef>()
  for (const link of links.data || []) {
    const plan = one(link.plan as never) as PlanRef | null
    if (plan && link.licitacion_id && !planByLicitacion.has(link.licitacion_id)) planByLicitacion.set(link.licitacion_id, plan)
  }

  const awards: AwardRow[] = (awardRows.data || []).map(row => {
    const plan = row.licitacion_id ? planByLicitacion.get(row.licitacion_id) : undefined
    const assignment = plan?.category_id ? assignmentByCategory.get(plan.category_id) : undefined
    const supplier = one(row.supplier as never) as { fantasy_name: string | null; legal_name: string | null } | null
    return {
      id: row.id,
      licitacion_id: row.licitacion_id,
      currency: row.currency,
      amount: num(row.amount),
      baseline_amount: num(row.baseline_amount),
      baseline_currency: row.baseline_currency,
      estimated_savings: num(row.estimated_savings),
      awarded_at: row.awarded_at,
      category_id: plan?.category_id ?? null,
      owner_user_id: plan?.responsible_user_id ?? assignment?.manager_user_id ?? null,
      team_id: plan?.team_id ?? assignment?.team_id ?? null,
      backup_user_id: plan?.backup_user_id ?? null,
      plan_id: plan?.id ?? null,
      plan_title: plan?.title ?? null,
      licitacion_name: (one(row.licitacion as never) as { name: string | null } | null)?.name ?? null,
      supplier_name: supplier?.fantasy_name || supplier?.legal_name || null,
    }
  })

  const names = new Map((licitaciones.data || []).map(row => [row.id, row.name as string | null]))
  const awardNames = new Map(awards.map(award => [award.licitacion_id || '', award.licitacion_name]))
  const validationRows: ValidationRow[] = (validations.data || []).map(row => ({
    ...(row as unknown as ValidationRow),
    baseline_amount: Number(row.baseline_amount),
    awarded_amount: Number(row.awarded_amount),
    declared_amount: Number(row.declared_amount),
    validated_amount: num(row.validated_amount),
    licitacion_name: names.get(row.licitacion_id || '') || awardNames.get(row.licitacion_id || '') || row.licitacion_id,
  }))

  let targets: TargetLite[] = []
  if (annual.data?.id) {
    const { data: lines } = await supabase.from('annual_plan_lines').select('category_id, currency, target_amount, owner_user_id').eq('annual_plan_id', annual.data.id)
    targets = (lines || []).map(line => ({
      currency: line.currency,
      target_amount: num(line.target_amount),
      category_id: line.category_id,
      owner_user_id: line.owner_user_id || assignmentByCategory.get(line.category_id)?.manager_user_id || null,
      team_id: assignmentByCategory.get(line.category_id)?.team_id ?? null,
    }))
  }

  const awardedLicitaciones = new Set(awards.map(award => award.licitacion_id))
  const hasActiveManual = new Set(validationRows.filter(item => item.source_kind === 'manual' && (item.status === 'declared' || item.status === 'validated')).map(item => item.licitacion_id))
  const manual: ManualCandidate[] = (licitaciones.data || [])
    .filter(row => !awardedLicitaciones.has(row.id) && !hasActiveManual.has(row.id) && row.baseline_currency && Number(row.baseline_amount) > Number(row.awarded_amount))
    .map(row => ({ licitacion_id: row.id, name: row.name || row.id, currency: String(row.baseline_currency).toUpperCase(), baseline: Number(row.baseline_amount), awarded: Number(row.awarded_amount) }))

  return {
    awards,
    validations: validationRows,
    recognitions: ((recognitions.data || []) as RecognitionRow[]).map(row => ({ ...row, amount: Number(row.amount) })),
    evidence: (evidence.data || []) as EvidenceRow[],
    events: (events.data || []) as SavingsEvent[],
    targets,
    manual,
  }
}
