// Service for RFx Maker operations
import { supabaseBrowser } from '@/lib/supabase'
import type {
  RfxProject,
  RfxTemplate,
  RfxCompanyPolicy,
  PlaceholderDefinition,
} from '@/types/rfx-maker'

/**
 * Reemplaza los placeholders en el template con los valores actuales
 */
export function replacePlaceholders(
  templateContent: string,
  values: Record<string, any>
): string {
  let result = templateContent

  // Reemplazar cada placeholder {{ key }} con su valor
  Object.entries(values).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
    result = result.replace(regex, String(value || ''))
  })

  return result
}

/**
 * Valida que todos los placeholders requeridos tengan valores
 */
export function validatePlaceholders(
  placeholderDefinitions: PlaceholderDefinition[],
  values: Record<string, any>
): { valid: boolean; missing: string[] } {
  const missing: string[] = []

  placeholderDefinitions.forEach((placeholder) => {
    const value = values[placeholder.field_key]

    // Si no tiene valor y no tiene default, es requerido
    if (!value && !placeholder.default_value) {
      missing.push(placeholder.label)
    }
  })

  return {
    valid: missing.length === 0,
    missing,
  }
}

/**
 * Obtiene la plantilla activa
 */
export async function getActiveTemplate(): Promise<RfxTemplate | null> {
  const supabase = supabaseBrowser()

  const { data, error } = await supabase
    .from('rfx_templates')
    .select('*')
    .eq('is_active_version', true)
    .eq('status', 'active')
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching active template:', error)
    return null
  }

  return data
}

/**
 * Obtiene la política activa de la empresa
 */
export async function getActivePolicy(): Promise<RfxCompanyPolicy | null> {
  const supabase = supabaseBrowser()

  const { data, error } = await supabase
    .from('rfx_company_policies')
    .select('*')
    .eq('is_active', true)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching active policy:', error)
    return null
  }

  return data
}

/**
 * Crea un nuevo proyecto RFx
 */
export async function createRfxProject(params: {
  title: string
  description?: string
  rfx_type: 'RFP' | 'RFQ' | 'RFI'
  template_id: string
  project_context?: Record<string, any>
  responsible_user_id?: string
}): Promise<{ success: boolean; project?: RfxProject; error?: string }> {
  try {
    const supabase = supabaseBrowser()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { success: false, error: 'Perfil no encontrado' }
    }

    // Obtener template
    const { data: template } = await supabase
      .from('rfx_templates')
      .select('*')
      .eq('id', params.template_id)
      .single()

    if (!template) {
      return { success: false, error: 'Plantilla no encontrada' }
    }

    // Obtener política activa
    const policy = await getActivePolicy()

    // Generar código único
    const projectCode = `RFX-${Date.now().toString().slice(-6)}`

    // Crear proyecto
    const { data: newProject, error } = await supabase
      .from('rfx_projects')
      .insert({
        company_id: profile.company_id,
        project_code: projectCode,
        title: params.title,
        description: params.description,
        rfx_type: params.rfx_type,
        template_id: params.template_id,
        template_version_snapshot: template.version_number,
        policy_snapshot: policy?.policy_values || {},
        admin_parameters: policy?.policy_values || {},
        project_context: params.project_context || {},
        status: 'draft',
        technical_base_is_valid: false,
        technical_base_manually_edited: false,
        responsible_user_id: params.responsible_user_id || user.id,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating project:', error)
      return { success: false, error: error.message }
    }

    return { success: true, project: newProject }
  } catch (error) {
    console.error('Error in createRfxProject:', error)
    return { success: false, error: 'Error al crear proyecto' }
  }
}

/**
 * Actualiza los parámetros administrativos de un proyecto
 * Automáticamente invalida la base técnica si hay cambios
 */
export async function updateProjectAdminParameters(
  projectId: string,
  newParameters: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = supabaseBrowser()

    // Obtener proyecto actual
    const { data: currentProject } = await supabase
      .from('rfx_projects')
      .select('admin_parameters, technical_base_content')
      .eq('id', projectId)
      .single()

    if (!currentProject) {
      return { success: false, error: 'Proyecto no encontrado' }
    }

    // Detectar si hubo cambios
    const hasChanges = JSON.stringify(currentProject.admin_parameters) !== JSON.stringify(newParameters)

    const updates: any = {
      admin_parameters: newParameters,
      updated_at: new Date().toISOString(),
    }

    // Si hay cambios y existe base técnica, invalidarla
    if (hasChanges && currentProject.technical_base_content) {
      updates.technical_base_is_valid = false
    }

    const { error } = await supabase
      .from('rfx_projects')
      .update(updates)
      .eq('id', projectId)

    if (error) {
      console.error('Error updating project parameters:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error in updateProjectAdminParameters:', error)
    return { success: false, error: 'Error al actualizar parámetros' }
  }
}

/**
 * Genera la base administrativa renderizada (reemplazando placeholders)
 */
export async function generateAdminBase(
  projectId: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const supabase = supabaseBrowser()

    // Obtener proyecto con template
    const { data: project } = await supabase
      .from('rfx_projects')
      .select('*, rfx_templates(*)')
      .eq('id', projectId)
      .single()

    if (!project) {
      return { success: false, error: 'Proyecto no encontrado' }
    }

    const template = project.rfx_templates
    if (!template) {
      return { success: false, error: 'Plantilla no encontrada' }
    }

    // Reemplazar placeholders
    const content = replacePlaceholders(
      template.template_structure || '',
      project.admin_parameters || {}
    )

    return { success: true, content }
  } catch (error) {
    console.error('Error in generateAdminBase:', error)
    return { success: false, error: 'Error al generar base administrativa' }
  }
}

/**
 * Obtiene estadísticas de RFx Maker
 */
export async function getRfxStats(): Promise<{
  total_projects: number
  draft_projects: number
  ready_projects: number
  closed_projects: number
  total_templates: number
  active_templates: number
}> {
  const supabase = supabaseBrowser()

  // Contar proyectos
  const { count: totalProjects } = await supabase
    .from('rfx_projects')
    .select('*', { count: 'exact', head: true })

  const { count: draftProjects } = await supabase
    .from('rfx_projects')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'draft')

  const { count: readyProjects } = await supabase
    .from('rfx_projects')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'ready')

  const { count: closedProjects } = await supabase
    .from('rfx_projects')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'closed')

  const { count: totalTemplates } = await supabase
    .from('rfx_templates')
    .select('*', { count: 'exact', head: true })

  const { count: activeTemplates } = await supabase
    .from('rfx_templates')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  return {
    total_projects: totalProjects || 0,
    draft_projects: draftProjects || 0,
    ready_projects: readyProjects || 0,
    closed_projects: closedProjects || 0,
    total_templates: totalTemplates || 0,
    active_templates: activeTemplates || 0,
  }
}

/**
 * Duplica un proyecto existente
 */
export async function duplicateProject(
  projectId: string
): Promise<{ success: boolean; project?: RfxProject; error?: string }> {
  try {
    const supabase = supabaseBrowser()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Obtener proyecto original
    const { data: originalProject } = await supabase
      .from('rfx_projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (!originalProject) {
      return { success: false, error: 'Proyecto no encontrado' }
    }

    // Crear copia
    const projectCode = `RFX-${Date.now().toString().slice(-6)}`

    const { data: newProject, error } = await supabase
      .from('rfx_projects')
      .insert({
        company_id: originalProject.company_id,
        project_code: projectCode,
        title: `${originalProject.title} (Copia)`,
        description: originalProject.description,
        rfx_type: originalProject.rfx_type,
        template_id: originalProject.template_id,
        template_version_snapshot: originalProject.template_version_snapshot,
        policy_snapshot: originalProject.policy_snapshot,
        admin_parameters: originalProject.admin_parameters,
        project_context: originalProject.project_context,
        status: 'draft',
        technical_base_content: null, // No copiar base técnica
        technical_base_is_valid: false,
        technical_base_manually_edited: false,
        responsible_user_id: user.id,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error duplicating project:', error)
      return { success: false, error: error.message }
    }

    return { success: true, project: newProject }
  } catch (error) {
    console.error('Error in duplicateProject:', error)
    return { success: false, error: 'Error al duplicar proyecto' }
  }
}

