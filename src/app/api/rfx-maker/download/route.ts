// API para descargar proyectos RFx en formato DOCX o PDF
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Descarga un proyecto RFx en formato DOCX o PDF
 *
 * Query params:
 * - project_id: ID del proyecto
 * - format: 'docx' | 'pdf'
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('project_id')
    const format = searchParams.get('format') || 'docx'

    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id es requerido' },
        { status: 400 }
      )
    }

    if (format !== 'docx' && format !== 'pdf') {
      return NextResponse.json(
        { error: 'formato no soportado. Usa: docx, pdf' },
        { status: 400 }
      )
    }

    console.log('Download request:', { projectId, format })

    // Obtener el token de autorización de las cookies
    const cookieHeader = req.headers.get('cookie') || ''
    const authTokenMatch = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/)

    // Crear cliente de Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: authTokenMatch ? {
            Authorization: `Bearer ${decodeURIComponent(authTokenMatch[1])}`
          } : {}
        }
      }
    )

    // Obtener el proyecto (sin RLS si es necesario)
    const { data: projects, error } = await supabase
      .from('rfx_projects')
      .select('*')
      .eq('id', projectId)
      .limit(1)

    console.log('Query result:', {
      found: projects?.length || 0,
      error: error?.message,
      projectId
    })

    if (error) {
      console.error('Supabase error:', error)
      // Si hay error de RLS, intentar sin autenticación (para debugging)
      const supabasePublic = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data: projectsRetry, error: errorRetry } = await supabasePublic
        .from('rfx_projects')
        .select('*')
        .eq('id', projectId)
        .limit(1)

      if (errorRetry || !projectsRetry || projectsRetry.length === 0) {
        return NextResponse.json(
          {
            error: 'Error al buscar el proyecto',
            details: errorRetry?.message || error.message,
            hint: 'Verifica que el proyecto existe y tienes permisos para acceder'
          },
          { status: 500 }
        )
      }

      // Si el retry funcionó, usar esos datos
      const project = projectsRetry[0]
      return generateResponse(project, format)
    }

    if (!projects || projects.length === 0) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado', projectId },
        { status: 404 }
      )
    }

    const project = projects[0]
    console.log('Project found:', { id: project.id, title: project.title })

    return generateResponse(project, format)
  } catch (error) {
    console.error('Error generating download:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error generando documento' },
      { status: 500 }
    )
  }
}

/**
 * Genera la respuesta HTTP con el documento
 */
function generateResponse(project: any, format: string) {
  if (format === 'docx') {
    const docxBuffer = generateDocx(project)
    // Convertir Buffer a Uint8Array para NextResponse
    const uint8Array = new Uint8Array(docxBuffer)
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${project.project_code}_${project.rfx_type}.docx"`,
      },
    })
  } else {
    // PDF/HTML
    const htmlContent = generateHtml(project)
    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="${project.project_code}_${project.rfx_type}.html"`,
      },
    })
  }
}

/**
 * Genera un documento DOCX simple usando plantilla HTML
 * (Nota: En producción usarías una librería como docx o docx-templates)
 */
function generateDocx(project: any): Buffer {
  // Formatear parámetros administrativos de forma legible
  const formatParams = (params: Record<string, any>) => {
    return Object.entries(params || {})
      .map(([key, value]) => {
        const label = key.replace(/_/g, ' ').split(' ').map(w =>
          w.charAt(0).toUpperCase() + w.slice(1)
        ).join(' ')
        return `${label}: ${value}`
      })
      .join('\n')
  }

  const content = `
═══════════════════════════════════════════════════════════
                    PROYECTO RFx - ${project.rfx_type}
═══════════════════════════════════════════════════════════

INFORMACIÓN GENERAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Código del Proyecto: ${project.project_code}
Título: ${project.title}
Estado: ${project.status.toUpperCase()}
Tipo: ${project.rfx_type}
Fecha de Creación: ${new Date(project.created_at).toLocaleDateString('es-ES', {
  year: 'numeric', month: 'long', day: 'numeric'
})}
Última Actualización: ${new Date(project.updated_at).toLocaleDateString('es-ES', {
  year: 'numeric', month: 'long', day: 'numeric'
})}

${project.description ? `
DESCRIPCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${project.description}
` : ''}

BASE ADMINISTRATIVA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${formatParams(project.admin_parameters)}


BASE TÉCNICA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${project.technical_base_content || '[ Base técnica no generada ]'}


${project.project_context && Object.keys(project.project_context).length > 0 ? `
CONTEXTO DEL PROYECTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${formatParams(project.project_context)}
` : ''}

═══════════════════════════════════════════════════════════
Documento generado por Xpend - Strategic Sourcing Platform
${new Date().toLocaleString('es-ES')}
═══════════════════════════════════════════════════════════
`

  return Buffer.from(content, 'utf-8')
}

/**
 * Genera contenido HTML para vista previa o conversión a PDF
 */
function generateHtml(project: any): string {
  // Función auxiliar para categorizar y formatear parámetros
  const formatParamsAsCards = (params: Record<string, any>) => {
    const categories: Record<string, Record<string, any>> = {
      'Información General': {},
      'Condiciones Comerciales': {},
      'Plazos y Entregas': {},
      'Evaluación': {},
      'Otros': {}
    }

    Object.entries(params || {}).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase()
      if (lowerKey.includes('currency') || lowerKey.includes('start_date') || lowerKey.includes('contact')) {
        categories['Información General'][key] = value
      } else if (lowerKey.includes('payment') || lowerKey.includes('bond') || lowerKey.includes('penalties')) {
        categories['Condiciones Comerciales'][key] = value
      } else if (lowerKey.includes('delivery') || lowerKey.includes('timeline') || lowerKey.includes('execution')) {
        categories['Plazos y Entregas'][key] = value
      } else if (lowerKey.includes('score') || lowerKey.includes('evaluation') || lowerKey.includes('weight')) {
        categories['Evaluación'][key] = value
      } else {
        categories['Otros'][key] = value
      }
    })

    return Object.entries(categories)
      .filter(([_, values]) => Object.keys(values).length > 0)
      .map(([category, categoryParams]) => `
        <div class="category">
          <h3 class="category-title">${category}</h3>
          <div class="params-grid">
            ${Object.entries(categoryParams).map(([key, value]) => `
              <div class="param-card">
                <div class="param-label">${key.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</div>
                <div class="param-value">${value}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')
  }

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.project_code} - ${project.rfx_type}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.6;
      color: #1f2937;
      background: #ffffff;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #2563eb;
    }
    h1 {
      color: #1e40af;
      font-size: 2em;
      margin-bottom: 15px;
      font-weight: 700;
    }
    .badges {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
    }
    .badge-type {
      background: #dbeafe;
      color: #1e40af;
    }
    .badge-status {
      background: #d1fae5;
      color: #065f46;
    }
    .metadata {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 25px;
      border-radius: 12px;
      margin: 30px 0;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .metadata strong {
      display: inline-block;
      min-width: 180px;
      font-weight: 600;
    }
    .metadata p {
      margin: 8px 0;
      line-height: 1.8;
    }
    h2 {
      color: #1e40af;
      font-size: 1.5em;
      margin-top: 40px;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #2563eb;
      font-weight: 700;
    }
    .description {
      background: #f9fafb;
      padding: 20px;
      border-left: 4px solid #2563eb;
      border-radius: 8px;
      margin: 20px 0;
    }
    .category {
      margin: 30px 0;
    }
    .category-title {
      color: #374151;
      font-size: 1.1em;
      font-weight: 600;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #2563eb;
    }
    .params-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .param-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 15px;
      transition: box-shadow 0.2s;
    }
    .param-card:hover {
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .param-label {
      font-size: 0.85em;
      color: #6b7280;
      font-weight: 500;
      margin-bottom: 6px;
      text-transform: capitalize;
    }
    .param-value {
      font-size: 1em;
      color: #111827;
      font-weight: 600;
    }
    .technical-base {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 30px;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      white-space: pre-wrap;
      line-height: 1.8;
    }
    .footer {
      margin-top: 60px;
      padding: 25px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 12px;
      text-align: center;
    }
    .footer p {
      margin: 5px 0;
    }
    @media print {
      body {
        padding: 20px;
      }
      .no-print {
        display: none;
      }
      .param-card {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${project.title}</h1>
    <div class="badges">
      <span class="badge badge-type">${project.rfx_type}</span>
      <span class="badge badge-status">${project.status.toUpperCase()}</span>
    </div>
  </div>

  <div class="metadata">
    <p><strong>Código del Proyecto:</strong> ${project.project_code}</p>
    <p><strong>Fecha de Creación:</strong> ${new Date(project.created_at).toLocaleDateString('es-ES', {
      year: 'numeric', month: 'long', day: 'numeric'
    })}</p>
    <p><strong>Última Actualización:</strong> ${new Date(project.updated_at).toLocaleDateString('es-ES', {
      year: 'numeric', month: 'long', day: 'numeric'
    })}</p>
  </div>

  ${project.description ? `
  <h2>📋 Descripción del Proyecto</h2>
  <div class="description">${project.description}</div>
  ` : ''}

  <h2>📊 Base Administrativa</h2>
  ${formatParamsAsCards(project.admin_parameters)}

  <h2>📄 Base Técnica</h2>
  ${project.technical_base_content ? `
    <div class="technical-base">${project.technical_base_content}</div>
  ` : `
    <div class="description" style="color: #6b7280; font-style: italic;">
      La base técnica no ha sido generada para este proyecto.
    </div>
  `}

  ${project.project_context && Object.keys(project.project_context).length > 0 ? `
  <h2>🔍 Contexto del Proyecto</h2>
  ${formatParamsAsCards(project.project_context)}
  ` : ''}

  <div class="footer no-print">
    <p><strong>Xpend - Strategic Sourcing Platform</strong></p>
    <p style="font-size: 0.9em; margin-top: 8px;">Documento generado el ${new Date().toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}</p>
  </div>

  <script>
    // Auto-print para PDF
    if (window.location.search.includes('print=true')) {
      window.onload = () => {
        setTimeout(() => window.print(), 500);
      };
    }
  </script>
</body>
</html>
`
}

