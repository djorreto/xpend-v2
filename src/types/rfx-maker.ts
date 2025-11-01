// =====================================================
// RFx MAKER - TypeScript Types
// =====================================================

// =====================================================
// 1. PLANTILLAS (Templates)
// =====================================================

export type TemplateStatus = 'draft' | 'active' | 'archived'

export interface RfxTemplate {
  id: string
  company_id: string
  name: string
  description?: string
  language: string
  status: TemplateStatus
  template_structure: string // Alias para content_html
  placeholder_definitions: PlaceholderDefinition[] // Array de definiciones
  include_toc: boolean
  auto_numbering: boolean
  branding_settings: BrandingSettings
  version_number: number
  is_active_version: boolean
  parent_template_id?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface BrandingSettings {
  primary_color?: string
  secondary_color?: string
  logo_url?: string
  font_family?: string
  header_footer?: {
    show_header: boolean
    show_footer: boolean
    header_text?: string
    footer_text?: string
  }
}

// =====================================================
// 2. VARIABLES (Template Variables)
// =====================================================

export type FieldType = 'text' | 'number' | 'enum' | 'bool' | 'date'
export type EditableBy = 'admin' | 'user' | 'both'

export interface RfxTemplateVariable {
  id: string
  template_id: string
  field_key: string
  label: string
  help_text?: string
  variable_group?: string
  field_type: FieldType
  default_value?: string
  validation_rules: ValidationRules
  editable_by: EditableBy
  required: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface ValidationRules {
  min?: number
  max?: number
  regex?: string
  allowed_values?: string[]
  min_length?: number
  max_length?: number
}

// Alias simplificado para usar en template definitions (sin id ni timestamps)
export interface PlaceholderDefinition {
  field_key: string
  label: string
  type: FieldType
  default_value?: any
  rules?: ValidationRules
  editable_by: EditableBy
  help_text?: string
  group?: string
}

// =====================================================
// 3. POLÍTICAS (Company Policies)
// =====================================================

export interface RfxCompanyPolicy {
  id: string
  company_id: string
  template_id?: string
  policy_name: string
  description?: string
  policy_values: Record<string, any>
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

// =====================================================
// 4. PROYECTOS (RFx Projects)
// =====================================================

export type ProjectStatus = 'draft' | 'ready' | 'closed' | 'archived'
export type RfxType = 'RFP' | 'RFQ' | 'RFI'

export interface RfxProject {
  id: string
  company_id: string
  project_code: string
  title: string
  description?: string
  rfx_type: RfxType
  template_id: string
  template_version_snapshot: number
  policy_snapshot: Record<string, any>
  status: ProjectStatus
  admin_parameters: Record<string, any>
  admin_parameters_last_modified?: string
  technical_base_content?: string
  technical_base_generated_at?: string
  technical_base_is_valid: boolean
  technical_base_manually_edited: boolean
  project_context: ProjectContext
  version_number: number
  parent_version_id?: string
  responsible_user_id?: string
  created_by?: string
  created_at: string
  updated_at: string
  closed_at?: string
  archived_at?: string
}

export interface ProjectContext {
  industry?: string
  project_budget?: number
  deadline?: string
  special_requirements?: string[]
  attachments?: string[]
  [key: string]: any
}

// =====================================================
// 5. VERSIONES (Project Versions)
// =====================================================

export interface RfxProjectVersion {
  id: string
  project_id: string
  version_number: number
  snapshot_data: any
  change_description?: string
  created_by?: string
  created_at: string
}

// =====================================================
// 6. DESCARGAS (Downloads)
// =====================================================

export type DocumentType =
  | 'admin_docx'
  | 'admin_pdf'
  | 'technical_docx'
  | 'technical_pdf'
  | 'full_zip'

export interface RfxProjectDownload {
  id: string
  project_id: string
  document_type: DocumentType
  file_size_bytes?: number
  downloaded_by?: string
  downloaded_at: string
}

// =====================================================
// 7. COMENTARIOS (Comments)
// =====================================================

export type CommentSection = 'admin' | 'technical' | 'general'

export interface RfxProjectComment {
  id: string
  project_id: string
  comment_text: string
  section?: CommentSection
  created_by?: string
  created_at: string
  updated_at: string
}

// =====================================================
// 8. AUDITORÍA (Audit Log)
// =====================================================

export type EntityType = 'template' | 'project' | 'policy'
export type AuditAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'generated'
  | 'downloaded'
  | 'deleted'

export interface RfxAuditLog {
  id: string
  entity_type: EntityType
  entity_id: string
  action: AuditAction
  changes: Record<string, any>
  metadata: Record<string, any>
  performed_by?: string
  performed_at: string
}

// =====================================================
// 9. TIPOS AUXILIARES PARA UI
// =====================================================

export interface VariableGroup {
  name: string
  label: string
  variables: RfxTemplateVariable[]
}

export interface GenerateOptions {
  regenerate_admin?: boolean
  regenerate_technical?: boolean
  include_context?: boolean
}

export interface ExportOptions {
  format: 'docx' | 'pdf'
  include_toc?: boolean
  include_metadata?: boolean
}

export interface ProjectValidation {
  is_valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  field: string
  message: string
  type: 'required' | 'invalid' | 'out_of_range'
}

export interface ValidationWarning {
  field: string
  message: string
  type: 'missing_optional' | 'unusual_value'
}

// =====================================================
// 10. RESPONSES Y REQUESTS PARA APIs
// =====================================================

export interface GenerateTechnicalBaseRequest {
  project_id: string
  admin_parameters: Record<string, any>
  project_context: ProjectContext
  force_regenerate?: boolean
}

export interface GenerateTechnicalBaseResponse {
  success: boolean
  content?: string
  error?: string
  tokens_used?: number
  generation_time_ms?: number
}

export interface RenderAdminBaseRequest {
  template_html: string
  parameters: Record<string, any>
  branding?: BrandingSettings
}

export interface RenderAdminBaseResponse {
  success: boolean
  rendered_html?: string
  error?: string
}

export interface ExportDocumentRequest {
  project_id: string
  document_type: DocumentType
  options?: ExportOptions
}

export interface ExportDocumentResponse {
  success: boolean
  file_url?: string
  file_size_bytes?: number
  error?: string
}

// =====================================================
// 11. ESTADOS DE UI
// =====================================================

export interface EditorState {
  is_saving: boolean
  is_generating: boolean
  last_saved_at?: string
  has_unsaved_changes: boolean
  current_section?: 'admin' | 'technical' | 'context'
}

export interface TemplateEditorState extends EditorState {
  selected_variable?: RfxTemplateVariable
  preview_mode: boolean
  preview_data?: Record<string, any>
}

export interface ProjectEditorState extends EditorState {
  validation_status: ProjectValidation
  technical_base_invalidated: boolean
  show_invalidation_banner: boolean
}

