import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { buildRfxProjectDocxBuffer } from '@/lib/rfx-docx'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('project_id')
    const format = searchParams.get('format') || 'docx'

    if (!projectId) {
      return NextResponse.json({ error: 'project_id es requerido' }, { status: 400 })
    }

    if (format !== 'docx' && format !== 'pdf') {
      return NextResponse.json({ error: 'formato no soportado. Usa: docx, pdf' }, { status: 400 })
    }

    const { data: project, error } = await supabase
      .from('rfx_projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (error || !project) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado o sin permiso', details: error?.message },
        { status: 404 }
      )
    }

    return await generateResponse(project, format)
  } catch (error) {
    console.error('Error generating download:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error generando documento' },
      { status: 500 }
    )
  }
}

async function generateResponse(project: Record<string, unknown>, format: string) {
  const safeName = String(project.project_code || 'rfx').replace(/[^\w.-]+/g, '_')

  if (format === 'docx') {
    const buf = await buildRfxProjectDocxBuffer(project as Parameters<typeof buildRfxProjectDocxBuffer>[0])
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeName}_${project.rfx_type || 'RFx'}.docx"`,
      },
    })
  }

  const htmlContent = generateHtml(project)
  return new NextResponse(htmlContent, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${safeName}_${project.rfx_type || 'RFx'}.html"`,
    },
  })
}

function generateHtml(project: Record<string, unknown>): string {
  const formatParamsAsCards = (params: Record<string, unknown>) => {
    const categories: Record<string, Record<string, unknown>> = {
      'Información General': {},
      'Condiciones Comerciales': {},
      'Plazos y Entregas': {},
      Evaluación: {},
      Otros: {},
    }

    Object.entries(params || {}).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase()
      if (
        lowerKey.includes('currency') ||
        lowerKey.includes('start_date') ||
        lowerKey.includes('contact')
      ) {
        categories['Información General'][key] = value
      } else if (
        lowerKey.includes('payment') ||
        lowerKey.includes('bond') ||
        lowerKey.includes('penalties')
      ) {
        categories['Condiciones Comerciales'][key] = value
      } else if (
        lowerKey.includes('delivery') ||
        lowerKey.includes('timeline') ||
        lowerKey.includes('execution')
      ) {
        categories['Plazos y Entregas'][key] = value
      } else if (
        lowerKey.includes('score') ||
        lowerKey.includes('evaluation') ||
        lowerKey.includes('weight')
      ) {
        categories.Evaluación[key] = value
      } else {
        categories.Otros[key] = value
      }
    })

    return Object.entries(categories)
      .filter(([, values]) => Object.keys(values).length > 0)
      .map(
        ([category, categoryParams]) => `
        <div class="category">
          <h3 class="category-title">${category}</h3>
          <div class="params-grid">
            ${Object.entries(categoryParams)
              .map(
                ([key, value]) => `
              <div class="param-card">
                <div class="param-label">${key.replace(/_/g, ' ')}</div>
                <div class="param-value">${String(value)}</div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
      )
      .join('')
  }

  const adminParams = (project.admin_parameters as Record<string, unknown>) || {}
  const tech = String(project.technical_base_content || '')
  const desc = String(project.description || '')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${project.project_code} - ${project.rfx_type}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; color: #1f2937; }
    h1 { color: #1e40af; }
    h2 { color: #1e40af; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-top: 32px; }
    .technical-base { white-space: pre-wrap; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; }
    .params-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
    .param-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
    .param-label { font-size: 12px; color: #6b7280; }
    .param-value { font-weight: 600; }
  </style>
</head>
<body>
  <h1>${project.title}</h1>
  <p><strong>Código:</strong> ${project.project_code} &nbsp;|&nbsp; <strong>Tipo:</strong> ${project.rfx_type}</p>
  ${desc ? `<h2>Descripción</h2><p>${desc}</p>` : ''}
  <h2>Base administrativa</h2>
  ${formatParamsAsCards(adminParams)}
  <h2>Base técnica</h2>
  <div class="technical-base">${tech || '—'}</div>
  <p style="margin-top:40px;font-size:12px;color:#6b7280;">Xpend — ${new Date().toLocaleString('es-CL')}</p>
</body>
</html>`
}
