export interface User {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  company_id: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  name: string
  description?: string
  logo_url?: string
  settings: CompanySettings
  created_at: string
  updated_at: string
}

export interface CompanySettings {
  timezone: string
  currency: string
  language: string
  features: string[]
}

export type UserRole = 'admin' | 'manager' | 'analyst' | 'viewer'

export interface Project {
  id: string
  name: string
  description?: string
  company_id: string
  status: ProjectStatus
  start_date: string
  end_date?: string
  budget?: number
  currency: string
  created_by: string
  created_at: string
  updated_at: string
}

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'

export interface ProjectPhase {
  id: string
  project_id: string
  name: string
  description?: string
  start_date: string
  end_date: string
  status: PhaseStatus
  order: number
  dependencies: string[]
  created_at: string
  updated_at: string
}

export type PhaseStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked'

export interface ProjectMilestone {
  id: string
  project_id: string
  phase_id?: string
  name: string
  description?: string
  due_date: string
  completed: boolean
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface ProjectFile {
  id: string
  project_id: string
  name: string
  file_path: string
  file_size: number
  mime_type: string
  uploaded_by: string
  created_at: string
}

export interface ProjectComment {
  id: string
  project_id: string
  user_id: string
  content: string
  parent_id?: string
  created_at: string
  updated_at: string
}

export interface Department {
  id: string
  company_id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Licitacion {
  id: string
  company_id: string
  name: string
  description?: string
  status: LicitacionStatus
  type?: LicitacionType
  category?: LicitacionCategory
  
  // Baseline y montos
  baseline_currency: string
  baseline_amount?: number
  baseline_source?: BaselineSource
  awarded_amount?: number
  savings_amount?: number
  savings_percentage?: number
  
  // Gerencia y responsable
  department_id?: string
  department?: Department
  responsible_user_id?: string
  responsible_user?: User
  
  // Fechas del proceso
  request_date?: string
  publication_date?: string
  questions_date?: string
  answers_date?: string
  proposal_reception_date?: string
  proposal_closing_date?: string
  committee_date?: string
  award_date?: string
  contract_signature_date?: string
  
  // Documentos
  tender_document_path?: string
  tender_document_name?: string
  tender_document_size?: number
  tender_link?: string
  
  created_by?: string
  created_at: string
  updated_at: string
}

export type LicitacionStatus = 'planned' | 'bases_review' | 'published' | 'evaluation' | 'awarded' | 'contract_signed'
export type LicitacionType = 'RFP' | 'RFQ' | 'RFI'
export type LicitacionCategory = 'recurring_service' | 'non_recurring_service' | 'improvement_project' | 'construction_project'
export type BaselineSource = 'historical' | 'budget' | 'other'

export interface LicitacionDocument {
  id: string
  licitacion_id: string
  name: string
  file_path: string
  file_size: number
  mime_type: string
  version: number
  is_current: boolean
  uploaded_by: string
  created_at: string
}

export interface SpendData {
  id: string
  company_id: string
  category: string
  subcategory?: string
  supplier: string
  amount: number
  currency: string
  date: string
  description?: string
  project_id?: string
  created_at: string
  updated_at: string
}

export interface SpendCategory {
  id: string
  company_id: string
  name: string
  description?: string
  parent_id?: string
  created_at: string
  updated_at: string
}

export interface DashboardMetrics {
  total_projects: number
  active_projects: number
  total_licitaciones: number
  active_licitaciones: number
  total_spend: number
  spend_by_category: Array<{
    category: string
    amount: number
    percentage: number
  }>
  spend_by_supplier: Array<{
    supplier: string
    amount: number
    percentage: number
  }>
  monthly_spend: Array<{
    month: string
    amount: number
  }>
}

// ===== TIPOS PARA GESTIÓN DE PROVEEDORES =====

export interface Supplier {
  id: string
  company_id: string
  fantasy_name: string
  legal_name: string
  rut: string
  service_type: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  website?: string
  nda_file_path?: string
  nda_file_name?: string
  nda_file_size?: number
  nda_signed: boolean
  nda_signed_date?: string
  comments?: string
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string
  created_by_user?: User
}

export interface AdministrativeEvaluation {
  id: string
  supplier_id: string
  company_id: string
  documentation_score?: number
  documentation_notes?: string
  financial_score?: number
  financial_notes?: string
  experience_score?: number
  experience_notes?: string
  final_score?: number
  evaluation_date: string
  valid_until: string
  evaluator_id?: string
  evaluator?: User
  created_at: string
  updated_at: string
}

export interface TechnicalEvaluation {
  id: string
  licitacion_id: string
  supplier_id: string
  company_id: string
  risk_prevention_score?: number
  risk_prevention_notes?: string
  technical_proposal_score?: number
  technical_proposal_notes?: string
  final_score?: number
  evaluator_id?: string
  evaluator?: User
  created_at: string
  updated_at: string
}

export interface LicitacionWeighting {
  id: string
  licitacion_id: string
  company_id: string
  administrative_weight: number
  technical_weight: number
  created_at: string
  updated_at: string
}

export interface LicitacionSupplier {
  id: string
  licitacion_id: string
  supplier_id: string
  company_id: string
  status: LicitacionSupplierStatus
  administrative_score?: number
  technical_score?: number
  final_weighted_score?: number
  registered_at: string
  updated_at: string
  supplier?: Supplier
  administrative_evaluation?: AdministrativeEvaluation
  technical_evaluation?: TechnicalEvaluation
}

export type LicitacionSupplierStatus = 'registered' | 'evaluated' | 'awarded' | 'rejected'

export type ServiceType = 
  | 'tecnologia'
  | 'servicios_profesionales'
  | 'suministros'
  | 'marketing'
  | 'infraestructura'
  | 'construccion'
  | 'consultoria'
  | 'mantenimiento'
  | 'otros'

// Tipos para formularios
export interface CreateSupplierData {
  fantasy_name: string
  legal_name: string
  rut: string
  service_type: ServiceType
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  website?: string
  comments?: string
}

export interface UpdateSupplierData extends Partial<CreateSupplierData> {
  is_active?: boolean
}

export interface CreateAdministrativeEvaluationData {
  supplier_id: string
  documentation_score?: number
  documentation_notes?: string
  financial_score?: number
  financial_notes?: string
  experience_score?: number
  experience_notes?: string
  evaluation_date: string
}

export interface CreateTechnicalEvaluationData {
  licitacion_id: string
  supplier_id: string
  risk_prevention_score?: number
  risk_prevention_notes?: string
  technical_proposal_score?: number
  technical_proposal_notes?: string
}

export interface CreateLicitacionWeightingData {
  licitacion_id: string
  administrative_weight: number
  technical_weight: number
}

export interface SupplierFilters {
  service_type?: ServiceType
  nda_signed?: boolean
  evaluation_valid?: boolean
  is_active?: boolean
  search?: string
}

// Tipos para semáforos de evaluación
export type EvaluationStatus = 'valid' | 'expired' | 'pending' | 'incomplete'

export interface EvaluationTrafficLight {
  status: EvaluationStatus
  color: 'green' | 'yellow' | 'red' | 'gray'
  message: string
  score?: number
}

// Tipos para estadísticas
export interface SupplierStats {
  total_suppliers: number
  active_suppliers: number
  suppliers_with_valid_evaluation: number
  suppliers_with_expired_evaluation: number
  suppliers_without_evaluation: number
  suppliers_by_service: Array<{
    service_type: ServiceType
    count: number
  }>
  average_administrative_score: number
  average_technical_score: number
}

// ===== TIPOS PARA SOURCING PLAN =====

export interface SourcingPlan {
  id: string
  company_id: string
  
  // Información de planificación
  plan_year: number
  quarter: Quarter
  
  // Tipo y descripción
  initiative_type: InitiativeType
  title: string
  description?: string
  
  // Categoría y departamento
  category?: string
  department_id?: string
  department?: Department
  
  // Montos y ahorros proyectados
  estimated_spend: number
  currency: string
  projected_savings_percentage?: number
  projected_savings_amount?: number
  
  // Proveedores actuales
  current_suppliers?: Array<{
    id: string
    name: string
  }>
  
  // Estado del plan
  status: PlanStatus
  
  // Resultado real
  actual_spend?: number
  actual_savings_amount?: number
  actual_savings_percentage?: number
  
  // Asociación con ejecución
  linked_licitacion_id?: string
  linked_project_id?: string
  is_spot: boolean
  
  // Fechas
  planned_start_date?: string
  planned_end_date?: string
  actual_start_date?: string
  actual_completion_date?: string
  
  // Responsable
  responsible_user_id?: string
  responsible_user?: User
  created_by?: string
  created_by_user?: User
  
  // Notas
  notes?: string
  
  // Timestamps
  created_at: string
  updated_at: string
}

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'
export type InitiativeType = 'licitacion' | 'project'
export type PlanStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'

// Tipos para formularios de Sourcing Plan
export interface CreateSourcingPlanData {
  plan_year: number
  quarter: Quarter
  initiative_type: InitiativeType
  title: string
  description?: string
  category?: string
  department_id?: string
  estimated_spend: number
  currency?: string
  projected_savings_percentage?: number
  current_suppliers?: Array<{
    id: string
    name: string
  }>
  planned_start_date?: string
  planned_end_date?: string
  responsible_user_id?: string
  notes?: string
}

export interface UpdateSourcingPlanData extends Partial<CreateSourcingPlanData> {
  status?: PlanStatus
  actual_spend?: number
  actual_start_date?: string
  actual_completion_date?: string
}

// Filtros para Sourcing Plan
export interface SourcingPlanFilters {
  plan_year?: number
  quarter?: Quarter
  initiative_type?: InitiativeType
  status?: PlanStatus
  department_id?: string
  responsible_user_id?: string
  is_spot?: boolean
  search?: string
}

// Estadísticas del Sourcing Plan
export interface SourcingPlanStats {
  year: number
  total_planned: number
  total_completed: number
  total_in_progress: number
  total_cancelled: number
  total_spot: number
  
  // Financiero
  total_estimated_spend: number
  total_actual_spend: number
  total_projected_savings: number
  total_actual_savings: number
  
  // Cumplimiento
  completion_rate: number // % de completados sobre planificados
  savings_achievement_rate: number // % de ahorro real sobre proyectado
  
  // Por trimestre
  by_quarter: Array<{
    quarter: Quarter
    planned: number
    completed: number
    projected_savings: number
    actual_savings: number
    achievement_rate: number
  }>
  
  // Por tipo
  by_type: Array<{
    type: InitiativeType
    count: number
    projected_savings: number
    actual_savings: number
  }>
}

// Dashboard con Sourcing Plan
export interface DashboardWithPlan extends DashboardMetrics {
  sourcing_plan: {
    current_year_stats: SourcingPlanStats
    comparison_previous_years: Array<{
      year: number
      total_savings: number
      achievement_rate: number
    }>
    upcoming_initiatives: Array<SourcingPlan>
    at_risk_initiatives: Array<SourcingPlan>
  }
}

