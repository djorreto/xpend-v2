import type { SupabaseClient } from '@supabase/supabase-js'
import { can } from './navigation.ts'

export type PlanRow = {
  id: string
  title: string | null
  status: string | null
  quarter?: string | null
  plan_year?: number | null
  category?: string | null
  responsible_user_id?: string | null
  created_by?: string | null
  is_spot?: boolean | null
  planned_end_date?: string | null
  updated_at?: string | null
}
export type RfxRow = {
  id: string
  title: string | null
  status: string | null
  sourcing_plan_id?: string | null
  responsible_user_id?: string | null
  created_by?: string | null
  updated_at?: string | null
}
export type LicitacionRow = {
  id: string
  name: string | null
  status: string | null
  responsible_user_id?: string | null
  created_by?: string | null
  updated_at?: string | null
  questions_date?: string | null
  answers_date?: string | null
  proposal_reception_date?: string | null
  proposal_closing_date?: string | null
  committee_date?: string | null
  award_date?: string | null
  contract_signature_date?: string | null
}
export type SalaRow = {
  id: string
  title: string | null
  status: string | null
  licitacion_id?: string | null
  sourcing_plan_id?: string | null
  created_by?: string | null
  opens_at?: string | null
  closes_at?: string | null
  updated_at?: string | null
}
export type DecisionRow = { id: string; licitacion_id: string | null; outcome: string | null; created_at?: string | null; event_id?: string | null }
export type AwardRow = { id: string; licitacion_id: string | null; event_id?: string | null; contract_id?: string | null; awarded_at?: string | null }
export type ContractRow = {
  id: string
  code: string | null
  name: string | null
  status: string | null
  owner_id?: string | null
  created_by?: string | null
  ends_on?: string | null
  licitacion_id?: string | null
  award_id?: string | null
  updated_at?: string | null
}
export type VersionRow = { id: string; contract_id: string; status: string | null; created_by?: string | null; created_at?: string | null }
export type PlanLink = { plan_id: string; licitacion_id: string }

export type WorkspaceRaw = {
  plans: PlanRow[]
  rfx: RfxRow[]
  licitaciones: LicitacionRow[]
  salas: SalaRow[]
  decisions: DecisionRow[]
  awards: AwardRow[]
  contracts: ContractRow[]
  versions: VersionRow[]
  planLinks: PlanLink[]
}

export const EMPTY_WORKSPACE: WorkspaceRaw = {
  plans: [], rfx: [], licitaciones: [], salas: [], decisions: [], awards: [], contracts: [], versions: [], planLinks: [],
}

export type StageId = 'iniciativa' | 'rfx' | 'licitacion' | 'ofertas' | 'evaluacion' | 'adjudicacion' | 'contrato'

export const FLOW_STAGES: { id: StageId; label: string; href: string }[] = [
  { id: 'iniciativa', label: 'Iniciativa', href: '/sourcing-plan' },
  { id: 'rfx', label: 'RFx', href: '/procesos?tipo=rfx' },
  { id: 'licitacion', label: 'Licitación', href: '/procesos?tipo=licitacion' },
  { id: 'ofertas', label: 'Ofertas', href: '/procesos?etapa=ofertas' },
  { id: 'evaluacion', label: 'Evaluación', href: '/procesos?etapa=evaluacion' },
  { id: 'adjudicacion', label: 'Adjudicación', href: '/adjudicaciones' },
  { id: 'contrato', label: 'Contrato', href: '/contratos?vista=pendientes' },
]

export type ProcessKind = 'rfx' | 'licitacion' | 'sala'

export const PROCESS_KIND_LABELS: Record<ProcessKind, string> = {
  rfx: 'RFx',
  licitacion: 'Licitación',
  sala: 'Sala de ofertas',
}

export type Step = { label: string; href?: string; note?: string }

export type ProcessItem = {
  kind: ProcessKind
  id: string
  title: string
  status: string
  statusLabel: string
  stage: StageId
  active: boolean
  mine: boolean
  href: string
  updatedAt: string | null
  next: Step
}

const RFX_STATUS: Record<string, string> = { draft: 'Borrador', ready: 'Bases listas', closed: 'Cerrado', archived: 'Archivado' }
const LIC_STATUS: Record<string, string> = {
  planned: 'Planificada',
  bases_review: 'Bases en revisión',
  published: 'Publicada',
  evaluation: 'En evaluación',
  awarded: 'Adjudicada',
  contract_signed: 'Contrato firmado',
}
const SALA_STATUS: Record<string, string> = {
  draft: 'Borrador',
  open: 'Recibiendo ofertas',
  closed: 'Recepción cerrada',
  awarded: 'Adjudicada',
  cancelled: 'Cancelada',
}

const LIC_STAGE: Record<string, StageId> = {
  planned: 'licitacion',
  bases_review: 'licitacion',
  published: 'ofertas',
  evaluation: 'evaluacion',
  awarded: 'adjudicacion',
  contract_signed: 'contrato',
}
const SALA_STAGE: Record<string, StageId> = {
  draft: 'ofertas',
  open: 'ofertas',
  closed: 'evaluacion',
  awarded: 'adjudicacion',
  cancelled: 'ofertas',
}

export const STALL_DAYS = 14

function isMine(row: { responsible_user_id?: string | null; created_by?: string | null }, me: string) {
  if (row.responsible_user_id) return row.responsible_user_id === me
  return row.created_by === me
}

type Indexes = {
  salaByLicitacion: Map<string, SalaRow>
  awardByLicitacion: Map<string, AwardRow>
  contractByLicitacion: Map<string, ContractRow>
}

function indexes(raw: WorkspaceRaw): Indexes {
  const salaByLicitacion = new Map<string, SalaRow>()
  for (const sala of raw.salas) {
    if (sala.licitacion_id && sala.status !== 'cancelled') salaByLicitacion.set(sala.licitacion_id, sala)
  }
  const awardByLicitacion = new Map<string, AwardRow>()
  for (const award of raw.awards) if (award.licitacion_id) awardByLicitacion.set(award.licitacion_id, award)
  const contractByLicitacion = new Map<string, ContractRow>()
  for (const contract of raw.contracts) {
    if (contract.licitacion_id && contract.status !== 'terminated') contractByLicitacion.set(contract.licitacion_id, contract)
  }
  return { salaByLicitacion, awardByLicitacion, contractByLicitacion }
}

function contractStep(award: AwardRow | undefined, contract: ContractRow | undefined, role: string): Step {
  if (contract) return { label: 'Ver contrato', href: `/contratos/${contract.id}` }
  if (award?.contract_id) return { label: 'Ver contrato', href: `/contratos/${award.contract_id}` }
  if (award && can(role, 'writeContracts')) return { label: 'Preparar contrato desde la adjudicación', href: `/contratos/desde-adjudicacion?award=${award.id}` }
  if (award) return { label: 'Adjudicada', note: 'El contrato lo prepara un comprador o gerente.' }
  return { label: 'Ver adjudicación', href: '/adjudicaciones' }
}

export function rfxNext(rfx: RfxRow, role: string): Step {
  const href = `/rfx-maker/${rfx.id}`
  if (rfx.status === 'draft') return { label: 'Completar las bases', href }
  if (rfx.status === 'ready') {
    if (can(role, 'createLicitacion')) {
      const query = new URLSearchParams({ rfxId: rfx.id })
      if (rfx.sourcing_plan_id) query.set('planId', rfx.sourcing_plan_id)
      return { label: 'Crear la licitación con estas bases', href: `/licitaciones/new?${query.toString()}` }
    }
    return { label: 'Ver bases', href, note: 'La licitación la crea un gerente o administrador.' }
  }
  return { label: 'Ver bases', href }
}

export function licitacionNext(lic: LicitacionRow, role: string, idx: Indexes): Step {
  const sala = idx.salaByLicitacion.get(lic.id)
  switch (lic.status) {
    case 'planned':
      return can(role, 'createLicitacion')
        ? { label: 'Completar y enviar las bases a revisión', href: `/licitaciones/${lic.id}/edit` }
        : { label: 'Ver licitación', href: `/licitaciones/${lic.id}` }
    case 'bases_review':
      return can(role, 'approve')
        ? { label: 'Revisar y aprobar las bases', href: `/licitaciones/${lic.id}/edit` }
        : { label: 'Ver licitación', href: `/licitaciones/${lic.id}`, note: 'Espera la aprobación de un gerente.' }
    case 'published':
      if (sala) return { label: 'Seguir la sala de ofertas', href: `/sala/${sala.id}` }
      return can(role, 'openSala')
        ? { label: 'Abrir la sala de ofertas', href: `/sala/new?licitacionId=${encodeURIComponent(lic.id)}` }
        : { label: 'Ver licitación', href: `/licitaciones/${lic.id}`, note: 'La sala la abre un gerente o administrador.' }
    case 'evaluation':
      return sala
        ? { label: 'Evaluar las ofertas', href: `/sala/${sala.id}/evaluacion` }
        : { label: 'Ver licitación', href: `/licitaciones/${lic.id}` }
    case 'awarded':
    case 'contract_signed':
      return contractStep(idx.awardByLicitacion.get(lic.id), idx.contractByLicitacion.get(lic.id), role)
    default:
      return { label: 'Ver licitación', href: `/licitaciones/${lic.id}` }
  }
}

export function salaNext(sala: SalaRow, role: string, idx: Indexes): Step {
  const href = `/sala/${sala.id}`
  switch (sala.status) {
    case 'draft':
      return { label: can(role, 'openSala') ? 'Configurar y abrir la sala' : 'Ver sala', href }
    case 'open':
      return { label: 'Seguir la recepción de ofertas', href }
    case 'closed':
      return { label: 'Evaluar las ofertas', href: `${href}/evaluacion` }
    case 'awarded': {
      const award = sala.licitacion_id ? idx.awardByLicitacion.get(sala.licitacion_id) : undefined
      const contract = sala.licitacion_id ? idx.contractByLicitacion.get(sala.licitacion_id) : undefined
      if (award || contract) return contractStep(award, contract, role)
      return { label: 'Ver la decisión', href: `${href}/decision` }
    }
    default:
      return { label: 'Ver sala', href }
  }
}

export function buildProcesses(raw: WorkspaceRaw, me: string, role: string): ProcessItem[] {
  const idx = indexes(raw)
  const items: ProcessItem[] = [
    ...raw.rfx.map(rfx => ({
      kind: 'rfx' as const,
      id: rfx.id,
      title: rfx.title || 'RFx sin título',
      status: rfx.status || 'draft',
      statusLabel: RFX_STATUS[rfx.status || 'draft'] || String(rfx.status),
      stage: 'rfx' as const,
      active: rfx.status === 'draft' || rfx.status === 'ready',
      mine: isMine(rfx, me),
      href: `/rfx-maker/${rfx.id}`,
      updatedAt: rfx.updated_at || null,
      next: rfxNext(rfx, role),
    })),
    ...raw.licitaciones.map(lic => ({
      kind: 'licitacion' as const,
      id: lic.id,
      title: lic.name || lic.id,
      status: lic.status || 'planned',
      statusLabel: LIC_STATUS[lic.status || 'planned'] || String(lic.status),
      stage: LIC_STAGE[lic.status || 'planned'] || 'licitacion',
      active: !['awarded', 'contract_signed'].includes(lic.status || ''),
      mine: isMine(lic, me),
      href: `/licitaciones/${lic.id}`,
      updatedAt: lic.updated_at || null,
      next: licitacionNext(lic, role, idx),
    })),
    ...raw.salas.map(sala => ({
      kind: 'sala' as const,
      id: sala.id,
      title: sala.title || 'Sala de ofertas',
      status: sala.status || 'draft',
      statusLabel: SALA_STATUS[sala.status || 'draft'] || String(sala.status),
      stage: SALA_STAGE[sala.status || 'draft'] || 'ofertas',
      active: ['draft', 'open', 'closed'].includes(sala.status || ''),
      mine: sala.created_by === me,
      href: `/sala/${sala.id}`,
      updatedAt: sala.updated_at || null,
      next: salaNext(sala, role, idx),
    })),
  ]
  return items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
}

export type ProcessFilter = { kind?: string | null; stage?: string | null; mine?: boolean; active?: boolean; query?: string | null }

export function filterProcesses(items: ProcessItem[], filter: ProcessFilter) {
  const query = (filter.query || '').trim().toLowerCase()
  return items.filter(item =>
    (!filter.kind || item.kind === filter.kind) &&
    (!filter.stage || item.stage === filter.stage) &&
    (!filter.mine || item.mine) &&
    (!filter.active || item.active) &&
    (!query || `${item.title} ${item.id}`.toLowerCase().includes(query))
  )
}

function openPlans(plans: PlanRow[]) {
  return plans.filter(plan => !plan.is_spot && (plan.status === 'planned' || plan.status === 'in_progress'))
}

export function plansWithProcess(raw: WorkspaceRaw) {
  const ids = new Set<string>()
  for (const link of raw.planLinks) ids.add(link.plan_id)
  for (const rfx of raw.rfx) if (rfx.sourcing_plan_id) ids.add(rfx.sourcing_plan_id)
  for (const sala of raw.salas) if (sala.sourcing_plan_id) ids.add(sala.sourcing_plan_id)
  return ids
}

const PLAN_STATUS: Record<string, string> = { planned: 'Planificada', in_progress: 'En curso', completed: 'Completada', cancelled: 'Cancelada' }

export type InitiativeItem = { id: string; title: string; detail: string; href: string; hasProcess: boolean; next: Step }

export function initiativeNext(plan: PlanRow, hasProcess: boolean, role: string): Step {
  if (hasProcess) return { label: 'Ver iniciativa y su proceso', href: `/sourcing-plan/${plan.id}` }
  if (can(role, 'createRfx')) return { label: 'Preparar las bases (RFx)', href: `/rfx-maker/new?planId=${plan.id}` }
  return { label: 'Ver iniciativa', href: `/sourcing-plan/${plan.id}` }
}

export function myInitiatives(raw: WorkspaceRaw, me: string, role: string): InitiativeItem[] {
  const linked = plansWithProcess(raw)
  return openPlans(raw.plans)
    .filter(plan => isMine(plan, me))
    .map(plan => {
      const hasProcess = linked.has(plan.id)
      return {
        id: plan.id,
        title: plan.title || 'Iniciativa',
        detail: [PLAN_STATUS[plan.status || ''] || plan.status, plan.quarter, plan.category].filter(Boolean).join(' · '),
        href: `/sourcing-plan/${plan.id}`,
        hasProcess,
        next: initiativeNext(plan, hasProcess, role),
      }
    })
}

export type ActionItem = { id: string; title: string; detail: string; href: string; cta: string }

function stalled(updatedAt: string | null | undefined, today: Date) {
  if (!updatedAt) return false
  return new Date(updatedAt).getTime() < today.getTime() - STALL_DAYS * 24 * 60 * 60 * 1000
}

export function pendingActions(raw: WorkspaceRaw, me: string, role: string, today = new Date()): ActionItem[] {
  const out: ActionItem[] = []
  const linked = plansWithProcess(raw)
  for (const plan of openPlans(raw.plans).filter(plan => isMine(plan, me) && !linked.has(plan.id))) {
    const next = initiativeNext(plan, false, role)
    out.push({ id: `plan-${plan.id}`, title: plan.title || 'Iniciativa', detail: 'Tu iniciativa todavía no tiene proceso.', href: next.href || `/sourcing-plan/${plan.id}`, cta: next.label })
  }
  for (const sala of raw.salas.filter(sala => sala.status === 'closed' && sala.created_by === me)) {
    out.push({ id: `sala-${sala.id}`, title: sala.title || 'Sala de ofertas', detail: 'La recepción cerró. Falta evaluar las ofertas.', href: `/sala/${sala.id}/evaluacion`, cta: 'Evaluar' })
  }
  const idx = indexes(raw)
  for (const lic of raw.licitaciones.filter(lic => ['awarded', 'contract_signed'].includes(lic.status || '') && isMine(lic, me))) {
    const award = idx.awardByLicitacion.get(lic.id)
    if (award && !award.contract_id && !idx.contractByLicitacion.get(lic.id) && can(role, 'writeContracts')) {
      out.push({ id: `award-${award.id}`, title: lic.name || lic.id, detail: 'Adjudicada sin contrato.', href: `/contratos/desde-adjudicacion?award=${award.id}`, cta: 'Preparar contrato' })
    }
  }
  const contracts = new Map(raw.contracts.map(contract => [contract.id, contract]))
  const latest = latestVersions(raw.versions)
  for (const version of Array.from(latest.values())) {
    const contract = contracts.get(version.contract_id)
    if (version.status === 'returned' && contract && (isMineContract(contract, me) || version.created_by === me)) {
      out.push({ id: `version-${version.id}`, title: contract.name || contract.code || 'Contrato', detail: 'La versión fue devuelta con observaciones.', href: `/contratos/${contract.id}`, cta: 'Corregir' })
    }
  }
  for (const item of buildProcesses(raw, me, role).filter(item => item.mine && item.active && stalled(item.updatedAt, today))) {
    out.push({ id: `stalled-${item.kind}-${item.id}`, title: item.title, detail: `${PROCESS_KIND_LABELS[item.kind]} sin movimiento hace más de ${STALL_DAYS} días.`, href: item.next.href || item.href, cta: item.next.label })
  }
  return out
}

function latestVersions(versions: VersionRow[]) {
  const latest = new Map<string, VersionRow>()
  for (const version of versions) {
    const prev = latest.get(version.contract_id)
    if (!prev || String(version.created_at || '') > String(prev.created_at || '')) latest.set(version.contract_id, version)
  }
  return latest
}

function isMineContract(contract: ContractRow, me: string) {
  return contract.owner_id ? contract.owner_id === me : contract.created_by === me
}

export function approvals(raw: WorkspaceRaw, me: string, role: string): ActionItem[] {
  if (!can(role, 'approve')) return []
  const out: ActionItem[] = []
  for (const lic of raw.licitaciones.filter(lic => lic.status === 'bases_review')) {
    out.push({ id: `bases-${lic.id}`, title: lic.name || lic.id, detail: 'Bases en revisión. Falta la aprobación para publicar.', href: `/licitaciones/${lic.id}/edit`, cta: 'Revisar bases' })
  }
  const names = new Map(raw.licitaciones.map(lic => [lic.id, lic.name || lic.id]))
  for (const decision of raw.decisions.filter(decision => decision.outcome === 'pending')) {
    out.push({
      id: `decision-${decision.id}`,
      title: names.get(decision.licitacion_id || '') || decision.licitacion_id || 'Decisión de adjudicación',
      detail: 'Decisión de adjudicación pendiente.',
      href: decision.event_id ? `/sala/${decision.event_id}/decision` : '/adjudicaciones',
      cta: 'Decidir',
    })
  }
  const contracts = new Map(raw.contracts.map(contract => [contract.id, contract]))
  for (const version of Array.from(latestVersions(raw.versions).values())) {
    const contract = contracts.get(version.contract_id)
    if (version.status === 'in_review' && contract && version.created_by !== me) {
      out.push({ id: `review-${version.id}`, title: contract.name || contract.code || 'Contrato', detail: 'Versión de contrato en revisión.', href: `/contratos/${contract.id}`, cta: 'Revisar' })
    }
  }
  return out
}

export function needsAttention(raw: WorkspaceRaw, me: string, role: string, today = new Date()): ActionItem[] {
  const out: ActionItem[] = []
  for (const item of buildProcesses(raw, me, role).filter(item => item.active && stalled(item.updatedAt, today))) {
    out.push({ id: `stalled-${item.kind}-${item.id}`, title: item.title, detail: `${PROCESS_KIND_LABELS[item.kind]} sin movimiento hace más de ${STALL_DAYS} días.`, href: item.href, cta: 'Abrir' })
  }
  const linked = plansWithProcess(raw)
  for (const plan of openPlans(raw.plans)) {
    if (!plan.responsible_user_id) {
      out.push({ id: `owner-${plan.id}`, title: plan.title || 'Iniciativa', detail: 'Iniciativa sin responsable asignado.', href: `/sourcing-plan/${plan.id}`, cta: 'Asignar' })
    } else if (!linked.has(plan.id)) {
      out.push({ id: `noproc-${plan.id}`, title: plan.title || 'Iniciativa', detail: 'Iniciativa sin proceso iniciado.', href: `/sourcing-plan/${plan.id}`, cta: 'Abrir' })
    }
  }
  return out
}

export type DateItem = { id: string; date: string; label: string; title: string; href: string }

const LIC_DATES: [keyof LicitacionRow, string][] = [
  ['questions_date', 'Cierre de preguntas'],
  ['answers_date', 'Respuestas a consultas'],
  ['proposal_reception_date', 'Recepción de ofertas'],
  ['proposal_closing_date', 'Cierre de ofertas'],
  ['committee_date', 'Comité'],
  ['award_date', 'Adjudicación'],
  ['contract_signature_date', 'Firma de contrato'],
]

export function upcomingDates(raw: WorkspaceRaw, options: { me?: string; onlyMine?: boolean; today?: Date; days?: number } = {}): DateItem[] {
  const today = options.today || new Date()
  const from = today.toISOString().slice(0, 10)
  const until = new Date(today.getTime() + (options.days ?? 45) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const inRange = (date?: string | null) => Boolean(date) && String(date).slice(0, 10) >= from && String(date).slice(0, 10) <= until
  const mine = (row: { responsible_user_id?: string | null; created_by?: string | null }) => !options.onlyMine || isMine(row, options.me || '')
  const out: DateItem[] = []
  for (const lic of raw.licitaciones.filter(lic => !['awarded', 'contract_signed'].includes(lic.status || '') && mine(lic))) {
    for (const [field, label] of LIC_DATES) {
      const value = lic[field] as string | null | undefined
      if (inRange(value)) out.push({ id: `${lic.id}-${String(field)}`, date: String(value).slice(0, 10), label, title: lic.name || lic.id, href: `/licitaciones/${lic.id}` })
    }
  }
  for (const sala of raw.salas.filter(sala => mine({ created_by: sala.created_by }))) {
    if (sala.status === 'open' && inRange(sala.closes_at)) out.push({ id: `${sala.id}-close`, date: String(sala.closes_at).slice(0, 10), label: 'Cierra la sala', title: sala.title || 'Sala', href: `/sala/${sala.id}` })
    if (sala.status === 'draft' && inRange(sala.opens_at)) out.push({ id: `${sala.id}-open`, date: String(sala.opens_at).slice(0, 10), label: 'Abre la sala', title: sala.title || 'Sala', href: `/sala/${sala.id}` })
  }
  for (const contract of raw.contracts.filter(contract => contract.status === 'active' && (!options.onlyMine || isMineContract(contract, options.me || '')))) {
    if (inRange(contract.ends_on)) out.push({ id: `${contract.id}-end`, date: String(contract.ends_on).slice(0, 10), label: 'Vence el contrato', title: contract.name || contract.code || 'Contrato', href: `/contratos/${contract.id}` })
  }
  for (const plan of openPlans(raw.plans).filter(mine)) {
    if (inRange(plan.planned_end_date)) out.push({ id: `${plan.id}-end`, date: String(plan.planned_end_date).slice(0, 10), label: 'Término planificado', title: plan.title || 'Iniciativa', href: `/sourcing-plan/${plan.id}` })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export function contractsForMe(raw: WorkspaceRaw, me: string, today = new Date()): ActionItem[] {
  const soon = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const from = today.toISOString().slice(0, 10)
  const out: ActionItem[] = []
  for (const contract of raw.contracts.filter(contract => isMineContract(contract, me))) {
    const title = contract.name || contract.code || 'Contrato'
    if (contract.status === 'draft') out.push({ id: contract.id, title, detail: 'Borrador sin enviar a revisión.', href: `/contratos/${contract.id}`, cta: 'Continuar' })
    else if (contract.status === 'in_review') out.push({ id: contract.id, title, detail: 'En revisión.', href: `/contratos/${contract.id}`, cta: 'Ver' })
    else if (contract.status === 'active' && contract.ends_on && contract.ends_on >= from && contract.ends_on <= soon) {
      out.push({ id: contract.id, title, detail: `Vence el ${contract.ends_on}.`, href: `/contratos/${contract.id}`, cta: 'Revisar' })
    }
  }
  return out
}

export type ContinueItem = { title: string; detail: string; href: string; cta: string }

export function continueWhereLeft(raw: WorkspaceRaw, me: string, role: string): ContinueItem | null {
  const candidates: { at: string; item: ContinueItem }[] = []
  for (const process of buildProcesses(raw, me, role).filter(item => item.mine && item.active)) {
    candidates.push({ at: process.updatedAt || '', item: { title: process.title, detail: `${PROCESS_KIND_LABELS[process.kind]} · ${process.statusLabel}`, href: process.next.href || process.href, cta: process.next.label } })
  }
  for (const contract of raw.contracts.filter(contract => isMineContract(contract, me) && ['draft', 'in_review'].includes(contract.status || ''))) {
    candidates.push({ at: contract.updated_at || '', item: { title: contract.name || contract.code || 'Contrato', detail: 'Contrato en preparación', href: `/contratos/${contract.id}`, cta: 'Continuar el contrato' } })
  }
  candidates.sort((a, b) => b.at.localeCompare(a.at))
  return candidates[0]?.item || null
}

export type StageCount = { id: StageId; label: string; href: string; count: number | null }

export function stageCounts(raw: WorkspaceRaw, me: string, role: string): StageCount[] {
  const counts: Record<StageId, number> = { iniciativa: 0, rfx: 0, licitacion: 0, ofertas: 0, evaluacion: 0, adjudicacion: 0, contrato: 0 }
  const linked = plansWithProcess(raw)
  counts.iniciativa = openPlans(raw.plans).filter(plan => !linked.has(plan.id)).length
  const salaLicitaciones = new Set(raw.salas.filter(sala => sala.status !== 'cancelled' && sala.licitacion_id).map(sala => sala.licitacion_id as string))
  for (const item of buildProcesses(raw, me, role).filter(item => item.active)) {
    if (item.kind === 'licitacion' && salaLicitaciones.has(item.id) && item.stage !== 'licitacion') continue
    counts[item.stage] += 1
  }
  const idx = indexes(raw)
  counts.adjudicacion = raw.decisions.filter(decision => decision.outcome === 'pending').length +
    raw.awards.filter(award => !award.contract_id && !(award.licitacion_id && idx.contractByLicitacion.get(award.licitacion_id))).length
  counts.contrato = raw.contracts.filter(contract => contract.status === 'draft' || contract.status === 'in_review').length
  const hidden = new Set<StageId>(can(role, 'readContracts') ? [] : ['adjudicacion', 'contrato'])
  return FLOW_STAGES.map(stage => ({ ...stage, count: hidden.has(stage.id) ? null : counts[stage.id] }))
}

export function areaSummary(raw: WorkspaceRaw, year = new Date().getFullYear()) {
  const plans = raw.plans.filter(plan => plan.plan_year == null || plan.plan_year === year)
  return {
    year,
    openInitiatives: openPlans(plans).length,
    completedInitiatives: plans.filter(plan => plan.status === 'completed').length,
    activeProcesses: raw.rfx.filter(rfx => rfx.status === 'draft' || rfx.status === 'ready').length +
      raw.licitaciones.filter(lic => !['awarded', 'contract_signed'].includes(lic.status || '')).length +
      raw.salas.filter(sala => ['draft', 'open', 'closed'].includes(sala.status || '')).length,
    contractsInReview: raw.contracts.filter(contract => contract.status === 'draft' || contract.status === 'in_review').length,
  }
}

const LIMIT = 500

function rows<T>(result: { data: unknown; error: unknown }): T[] {
  return result.error ? [] : ((result.data as T[]) || [])
}

export async function loadWorkspaceRaw(supabase: SupabaseClient, companyId: string, role: string): Promise<WorkspaceRaw> {
  const readContracts = can(role, 'readContracts')
  const none = Promise.resolve({ data: [], error: null })
  const [plans, rfx, licitaciones, salas, decisions, awards, contracts, versions, links] = await Promise.all([
    supabase.from('sourcing_plans')
      .select('id, title, status, quarter, plan_year, category, responsible_user_id, created_by, is_spot, planned_end_date, updated_at')
      .eq('company_id', companyId).neq('status', 'cancelled').order('updated_at', { ascending: false }).limit(LIMIT),
    supabase.from('rfx_projects')
      .select('id, title, status, sourcing_plan_id, responsible_user_id, created_by, updated_at')
      .eq('company_id', companyId).is('archived_at', null).order('updated_at', { ascending: false }).limit(LIMIT),
    supabase.from('licitaciones')
      .select('id, name, status, responsible_user_id, created_by, updated_at, questions_date, answers_date, proposal_reception_date, proposal_closing_date, committee_date, award_date, contract_signature_date')
      .eq('company_id', companyId).order('updated_at', { ascending: false }).limit(LIMIT),
    supabase.from('offer_events')
      .select('id, title, status, licitacion_id, sourcing_plan_id, created_by, opens_at, closes_at, updated_at')
      .eq('company_id', companyId).order('updated_at', { ascending: false }).limit(LIMIT),
    supabase.from('award_decisions')
      .select('id, licitacion_id, outcome, created_at, packet:decision_packets(event_id)')
      .eq('company_id', companyId).eq('outcome', 'pending').limit(LIMIT),
    supabase.from('process_awards')
      .select('id, licitacion_id, event_id, contract_id, awarded_at')
      .eq('company_id', companyId).limit(LIMIT),
    readContracts
      ? supabase.from('contracts').select('id, code, name, status, owner_id, created_by, ends_on, licitacion_id, award_id, updated_at')
          .eq('company_id', companyId).order('updated_at', { ascending: false }).limit(LIMIT)
      : none,
    readContracts
      ? supabase.from('contract_versions').select('id, contract_id, status, created_by, created_at')
          .eq('company_id', companyId).in('status', ['in_review', 'returned', 'draft', 'approved']).limit(LIMIT * 2)
      : none,
    supabase.from('sourcing_plan_licitaciones').select('plan_id, licitacion_id').limit(LIMIT * 2),
  ])
  type DecisionWithPacket = DecisionRow & { packet?: { event_id?: string } | { event_id?: string }[] | null }
  return {
    plans: rows<PlanRow>(plans),
    rfx: rows<RfxRow>(rfx),
    licitaciones: rows<LicitacionRow>(licitaciones),
    salas: rows<SalaRow>(salas),
    decisions: rows<DecisionWithPacket>(decisions).map(row => {
      const packet = Array.isArray(row.packet) ? row.packet[0] : row.packet
      return { id: row.id, licitacion_id: row.licitacion_id, outcome: row.outcome, created_at: row.created_at, event_id: packet?.event_id || null }
    }),
    awards: rows<AwardRow>(awards),
    contracts: rows<ContractRow>(contracts),
    versions: rows<VersionRow>(versions),
    planLinks: rows<PlanLink>(links),
  }
}
