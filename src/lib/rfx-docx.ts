import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'

/** Evita caracteres de control ilegales en WordprocessingML */
function sanitizeDocxText(s: string): string {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

function adminParagraphs(params: Record<string, unknown> | null | undefined): Paragraph[] {
  const entries = Object.entries(params || {}).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== ''
  )
  if (entries.length === 0) {
    return [new Paragraph('—')]
  }
  return entries.map(
    ([key, value]) =>
      new Paragraph({
        children: [
          new TextRun({ text: `${humanizeKey(key)}: `, bold: true }),
          new TextRun(sanitizeDocxText(String(value))),
        ],
      })
  )
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/** Convierte Markdown simple (# títulos) y párrafos en nodos docx */
function technicalParagraphs(text: string | null | undefined): Paragraph[] {
  const raw = text ? sanitizeDocxText(text).trim() : ''
  if (!raw) {
    return [new Paragraph({ text: '[ Base técnica no generada ]' })]
  }

  const lines = raw.split(/\r?\n/)
  const out: Paragraph[] = []
  let buf: string[] = []

  const flushBuf = () => {
    if (buf.length === 0) return
    const block = buf.join('\n').trim()
    if (block) out.push(new Paragraph(sanitizeDocxText(block)))
    buf = []
  }

  for (const line of lines) {
    const m = /^(#{1,3})\s+(.+)$/.exec(line.trim())
    if (m) {
      flushBuf()
      const level = m[1].length
      const title = m[2].trim()
      const heading =
        level === 1
          ? HeadingLevel.HEADING_1
          : level === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3
      out.push(new Paragraph({ heading, text: sanitizeDocxText(title) }))
      continue
    }
    if (line.trim() === '') {
      flushBuf()
      continue
    }
    buf.push(line)
  }
  flushBuf()
  return out.length > 0 ? out : [new Paragraph(sanitizeDocxText(raw))]
}

export async function buildRfxProjectDocxBuffer(project: {
  project_code?: string
  title?: string
  rfx_type?: string
  status?: string
  description?: string | null
  admin_parameters?: Record<string, unknown> | null
  project_context?: Record<string, unknown> | null
  technical_base_content?: string | null
  created_at?: string
  updated_at?: string
}): Promise<Buffer> {
  const titleLine = sanitizeDocxText(
    `${project.project_code || 'RFx'} — ${project.title || 'Sin título'}`
  )
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      text: titleLine,
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Tipo: ', bold: true }),
        new TextRun(sanitizeDocxText(String(project.rfx_type || ''))),
        new TextRun({ text: '   |   Estado: ', bold: true }),
        new TextRun(sanitizeDocxText(String(project.status || ''))),
      ],
    }),
    new Paragraph(''),
  ]

  if (project.created_at) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Creado: ', bold: true }),
          new TextRun(new Date(project.created_at).toLocaleString('es-CL')),
        ],
      })
    )
  }

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Descripción' }))
  children.push(
    project.description?.trim()
      ? new Paragraph(sanitizeDocxText(project.description.trim()))
      : new Paragraph('—')
  )

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Base administrativa' }))
  children.push(...adminParagraphs(project.admin_parameters))

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Base técnica' }))
  children.push(...technicalParagraphs(project.technical_base_content))

  if (project.project_context && Object.keys(project.project_context).length > 0) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Contexto del proyecto' }))
    children.push(...adminParagraphs(project.project_context))
  }

  children.push(new Paragraph(''))
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Documento generado por Xpend — ${new Date().toLocaleString('es-CL')}`,
          italics: true,
        }),
      ],
    })
  )

  const doc = new Document({
    sections: [{ children }],
  })

  return Packer.toBuffer(doc)
}
