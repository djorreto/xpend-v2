import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export type ContractLine = {
  description: string
  quantity: string
  unit: string
  unitPrice: string
  currency: string
}

export type ContractDocumentModel = {
  code: string
  title: string
  version: number
  buyer: string
  supplier: string
  supplierRut: string | null
  currency: string
  amount: string
  clauses: { title: string; text: string }[]
  lines: ContractLine[]
  annexes: string[]
}

const ANNEX_LINE = /^(anexo\b|documentos citados\b)/i
const INTERNAL_LINE = /^(datos confirmados:|pendientes de validación:|las variables esenciales)/i

export function structureContractText(body: string) {
  const clauses: { title: string; text: string }[] = []
  const annexes: string[] = []
  const references: string[] = []
  let bucket: 'clause' | 'annex' | 'reference' = 'clause'
  let current: string[] = []

  const flush = () => {
    const text = current.join('\n').trim()
    current = []
    if (!text) return
    if (bucket === 'annex') annexes.push(text)
    else if (bucket === 'reference') references.push(text)
    else {
      const [title, ...rest] = text.split('\n')
      const remainder = rest.join('\n').trim()
      clauses.push({ title: title.trim().slice(0, 90), text: remainder })
    }
  }

  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (ANNEX_LINE.test(trimmed)) {
      flush()
      bucket = 'annex'
      current = [line]
    } else if (INTERNAL_LINE.test(trimmed)) {
      flush()
      bucket = 'reference'
      current = [line]
    } else if (!trimmed && bucket === 'clause') {
      flush()
    } else {
      current.push(line)
    }
  }
  flush()
  return { clauses, annexes, references }
}

export function contractExportModel(input: {
  code: string
  title: string
  version: number
  body: string
  buyer: string | null
  supplier: string | null
  supplierRut: string | null
  currency: string | null
  amount: string | number | null
  lines: { description?: string; quantity?: number | string; unit?: string; unitPrice?: number | string; unit_price?: number | string; currency?: string }[]
}): ContractDocumentModel {
  const structured = structureContractText(input.body)
  return {
    code: input.code,
    title: input.title,
    version: input.version,
    buyer: input.buyer || 'Empresa contratante',
    supplier: input.supplier || 'Contratista',
    supplierRut: input.supplierRut,
    currency: input.currency || '',
    amount: String(input.amount ?? ''),
    clauses: structured.clauses,
    lines: input.lines.map(line => ({
      description: String(line.description || ''),
      quantity: String(line.quantity ?? ''),
      unit: String(line.unit || ''),
      unitPrice: String(line.unitPrice ?? line.unit_price ?? ''),
      currency: String(line.currency || ''),
    })),
    annexes: structured.annexes,
  }
}

function numberedClauses(model: ContractDocumentModel) {
  return model.clauses.map((clause, index) => ({ ...clause, number: index + 1 }))
}

export async function buildContractDocx(model: ContractDocumentModel) {
  const clauses = numberedClauses(model)
  const children: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(model.title)] }),
    new Paragraph(`Código ${model.code}. Versión aprobada ${model.version}.`),
    new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Partes' }),
    new Paragraph(`Contratante: ${model.buyer}`),
    new Paragraph(`Contratista: ${model.supplier}${model.supplierRut ? `. RUT ${model.supplierRut}` : ''}`),
    new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Condiciones comerciales' }),
    new Paragraph(`Monto ${model.currency} ${model.amount}.`),
    new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Cláusulas' }),
    ...clauses.flatMap(clause => [
      new Paragraph({ heading: HeadingLevel.HEADING_2, text: `${clause.number}. ${clause.title}` }),
      ...(clause.text ? clause.text.split('\n').filter(line => line.trim()).map(line => new Paragraph(line)) : []),
    ]),
    new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Partidas adjudicadas' }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: ['Descripción', 'Cantidad', 'Unidad', 'Precio', 'Moneda'].map(label => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
          })),
        }),
        ...model.lines.map(line => new TableRow({
          children: [line.description, line.quantity, line.unit, line.unitPrice, line.currency].map(value => new TableCell({
            children: [new Paragraph(String(value))],
          })),
        })),
      ],
    }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Anexos y referencias' }),
    ...(model.annexes.length
      ? model.annexes.flatMap(annex => annex.split('\n').filter(line => line.trim()).map(line => new Paragraph(line)))
      : [new Paragraph('Sin anexos adicionales.')]),
  ]
  const document = new Document({ sections: [{ children }] })
  return Packer.toBuffer(document)
}

export function buildContractPdf(model: ContractDocumentModel) {
  const pdf = new jsPDF()
  const clauses = numberedClauses(model)
  let y = 16
  const write = (value: string, size = 11, gap = 6) => {
    pdf.setFontSize(size)
    const block = pdf.splitTextToSize(value, 180)
    const height = block.length * (size > 12 ? 6 : 5)
    if (y + height > 270) {
      pdf.addPage()
      y = 16
    }
    pdf.text(block, 14, y)
    y += height + gap
  }
  write(model.title, 16, 4)
  write(`Código ${model.code}. Versión aprobada ${model.version}.`)
  write(`Contratante: ${model.buyer}`)
  write(`Contratista: ${model.supplier}${model.supplierRut ? `. RUT ${model.supplierRut}` : ''}`)
  write(`Monto ${model.currency} ${model.amount}.`, 11, 4)
  clauses.forEach(clause => {
    write(`${clause.number}. ${clause.title}`, 11, 2)
    if (clause.text) write(clause.text.replace(/\n+/g, ' '), 11, 3)
  })
  autoTable(pdf, {
    startY: y,
    head: [['Descripción', 'Cantidad', 'Unidad', 'Precio', 'Moneda']],
    body: model.lines.map(line => [line.description, line.quantity, line.unit, line.unitPrice, line.currency]),
    margin: { left: 14, right: 14 },
  })
  y = ((pdf as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y) + 10
  write('Anexos y referencias', 13, 3)
  const annexText = model.annexes.join('\n') || 'Sin anexos adicionales.'
  annexText.split('\n').filter(line => line.trim()).forEach(line => write(line, 11, 2))
  return Buffer.from(pdf.output('arraybuffer'))
}
