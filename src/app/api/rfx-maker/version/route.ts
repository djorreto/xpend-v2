// API para manejo de versiones de proyectos RFx
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const body = await req.json()
    const { project_id, reason } = body

    if (!project_id) {
      return NextResponse.json({ error: 'project_id es requerido' }, { status: 400 })
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const user = session.user

    const { data: project, error: projectError } = await supabase
      .from('rfx_projects')
      .select('*')
      .eq('id', project_id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

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
        change_description: reason || 'Versión creada automáticamente',
      })
      .select()
      .single()

    if (versionError) throw versionError

    const { error: updateError } = await supabase
      .from('rfx_projects')
      .update({
        version_number: (project.version_number || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project_id)

    if (updateError) throw updateError

    await supabase.from('rfx_audit_log').insert({
      entity_type: 'project',
      entity_id: project.id,
      action: 'version_created',
      changes: {
        version_number: version.version_number,
        reason: reason || 'Versión creada',
      },
      performed_by: user.id,
    })

    return NextResponse.json({
      success: true,
      version,
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

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json({ error: 'project_id es requerido' }, { status: 400 })
    }

    const { data: versions, error } = await supabase
      .from('rfx_project_versions')
      .select(
        `
        *,
        created_by_user:profiles!created_by(full_name, email)
      `
      )
      .eq('project_id', projectId)
      .order('version_number', { ascending: false })

    if (error) throw error

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

export async function PUT(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const body = await req.json()
    const { project_id, version_id } = body

    if (!project_id || !version_id) {
      return NextResponse.json(
        { error: 'project_id y version_id son requeridos' },
        { status: 400 }
      )
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const user = session.user

    const { data: version, error: versionError } = await supabase
      .from('rfx_project_versions')
      .select('*')
      .eq('id', version_id)
      .eq('project_id', project_id)
      .single()

    if (versionError || !version) {
      return NextResponse.json({ error: 'Versión no encontrada' }, { status: 404 })
    }

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
        change_description: `Backup antes de restaurar versión ${version.version_number}`,
      })
    }

    const snapshot = version.snapshot_data as Record<string, unknown>
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
        technical_base_is_valid: false,
      })
      .eq('id', project_id)

    if (updateError) throw updateError

    await supabase.from('rfx_audit_log').insert({
      entity_type: 'project',
      entity_id: project_id,
      action: 'version_restored',
      changes: {
        restored_version: version.version_number,
        change_description: version.change_description,
      },
      performed_by: user.id,
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
