// API para manejo de versiones de proyectos RFx
import { NextRequest, NextResponse } from 'next/server'
import { supabaseBrowser } from '@/lib/supabase'

export const runtime = 'nodejs'

/**
 * POST - Crear nueva versión de un proyecto
 * GET - Listar versiones de un proyecto
 */

// Crear nueva versión
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { project_id, reason } = body

    if (!project_id) {
      return NextResponse.json(
        { error: 'project_id es requerido' },
        { status: 400 }
      )
    }

    const supabase = supabaseBrowser()

    // Obtener proyecto actual
    const { data: project, error: projectError } = await supabase
      .from('rfx_projects')
      .select('*')
      .eq('id', project_id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado' },
        { status: 404 }
      )
    }

    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Crear snapshot de versión
    const { data: version, error: versionError } = await supabase
      .from('rfx_project_versions')
      .insert({
        project_id: project.id,
        version_number: project.version_number || 1,
        snapshot_data: {
          title: project.title,
          description: project.description,
          rfx_type: project.rfx_type,
          admin_parameters: project.admin_parameters,
          technical_base_content: project.technical_base_content,
          project_context: project.project_context,
          status: project.status,
        },
        created_by: user.id,
        version_notes: reason || 'Versión creada automáticamente',
      })
      .select()
      .single()

    if (versionError) {
      throw versionError
    }

    // Incrementar versión del proyecto
    const { error: updateError } = await supabase
      .from('rfx_projects')
      .update({
        version_number: (project.version_number || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project_id)

    if (updateError) {
      throw updateError
    }

    // Registrar en auditoría
    await supabase.from('rfx_audit_log').insert({
      project_id: project.id,
      action: 'version_created',
      changed_by: user.id,
      changes: {
        version_number: version.version_number,
        reason: reason || 'Versión creada',
      },
    })

    return NextResponse.json({
      success: true,
      version: version,
      message: `Versión ${version.version_number} creada exitosamente`,
    })
  } catch (error) {
    console.error('Error creating version:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error creando versión' },
      { status: 500 }
    )
  }
}

// Listar versiones
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id es requerido' },
        { status: 400 }
      )
    }

    const supabase = supabaseBrowser()

    const { data: versions, error } = await supabase
      .from('rfx_project_versions')
      .select(`
        *,
        created_by_user:profiles!created_by(full_name, email)
      `)
      .eq('project_id', projectId)
      .order('version_number', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      versions: versions || [],
    })
  } catch (error) {
    console.error('Error fetching versions:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error obteniendo versiones' },
      { status: 500 }
    )
  }
}

// Restaurar una versión
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { project_id, version_id } = body

    if (!project_id || !version_id) {
      return NextResponse.json(
        { error: 'project_id y version_id son requeridos' },
        { status: 400 }
      )
    }

    const supabase = supabaseBrowser()

    // Obtener la versión a restaurar
    const { data: version, error: versionError } = await supabase
      .from('rfx_project_versions')
      .select('*')
      .eq('id', version_id)
      .eq('project_id', project_id)
      .single()

    if (versionError || !version) {
      return NextResponse.json(
        { error: 'Versión no encontrada' },
        { status: 404 }
      )
    }

    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Primero, crear una versión de backup del estado actual
    const { data: currentProject } = await supabase
      .from('rfx_projects')
      .select('*')
      .eq('id', project_id)
      .single()

    if (currentProject) {
      await supabase.from('rfx_project_versions').insert({
        project_id: currentProject.id,
        version_number: currentProject.version_number || 1,
        snapshot_data: {
          title: currentProject.title,
          description: currentProject.description,
          rfx_type: currentProject.rfx_type,
          admin_parameters: currentProject.admin_parameters,
          technical_base_content: currentProject.technical_base_content,
          project_context: currentProject.project_context,
          status: currentProject.status,
        },
        created_by: user.id,
        version_notes: `Backup antes de restaurar versión ${version.version_number}`,
      })
    }

    // Restaurar la versión seleccionada
    const snapshot = version.snapshot_data as any
    const { error: updateError } = await supabase
      .from('rfx_projects')
      .update({
        title: snapshot.title,
        description: snapshot.description,
        rfx_type: snapshot.rfx_type,
        admin_parameters: snapshot.admin_parameters,
        technical_base_content: snapshot.technical_base_content,
        project_context: snapshot.project_context,
        status: snapshot.status,
        parent_version_id: version_id,
        updated_at: new Date().toISOString(),
        // Invalidar base técnica si los parámetros cambiaron
        technical_base_is_valid: false,
      })
      .eq('id', project_id)

    if (updateError) {
      throw updateError
    }

    // Registrar en auditoría
    await supabase.from('rfx_audit_log').insert({
      project_id: project_id,
      action: 'version_restored',
      changed_by: user.id,
      changes: {
        restored_version: version.version_number,
        version_notes: version.version_notes,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Versión ${version.version_number} restaurada exitosamente`,
    })
  } catch (error) {
    console.error('Error restoring version:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error restaurando versión' },
      { status: 500 }
    )
  }
}

