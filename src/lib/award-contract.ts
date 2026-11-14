import { renderContract } from './contract-extract.ts'

export type AwardLine = {
  description: string
  quantity: number
  unit: string
  unitPrice: number
  currency: string
}

export type ConfirmedFact = { label: string; value: string; source: string }
export type PendingField = { key: string; label: string }

export function awardContractDraft(input: {
  companyName: string | null
  supplierName: string | null
  supplierRut: string | null
  licitacionId: string
  licitacionName: string | null
  scope: string | null
  technical: string | null
  answers: string[]
  lines: AwardLine[]
  amount: number
  currency: string
  conditions: string | null
  observations: string | null
  files: string[]
  ownerName: string | null
  templateBody: string
  variables: Record<string, string>
  clauses: string[]
}) {
  const confirmed: ConfirmedFact[] = []
  const add = (label: string, value: string | null | undefined, source: string) => {
    if (value && value.trim()) confirmed.push({ label, value: value.trim(), source })
  }
  add('Empresa contratante', input.companyName, 'empresa')
  add('Proveedor adjudicado', input.supplierName, 'adjudicación')
  add('RUT del proveedor', input.supplierRut, 'ficha del proveedor')
  add('Licitación', `${input.licitacionId} ${input.licitacionName || ''}`.trim(), 'licitación')
  add('Alcance', input.scope, 'adjudicación')
  add('Monto adjudicado', `${input.currency} ${input.amount}`, 'adjudicación')
  add('Oferta técnica', input.technical, 'oferta')
  add('Condiciones o reservas', input.conditions, 'adjudicación')
  add('Observaciones de la evaluación', input.observations, 'recomendación')
  add('Responsable', input.ownerName, 'sesión')

  const pending: PendingField[] = []
  if (!input.variables.inicio?.trim()) pending.push({ key: 'inicio', label: 'Fecha de inicio' })
  if (!input.variables.termino?.trim()) pending.push({ key: 'termino', label: 'Fecha de término' })
  if (!input.variables.preaviso?.trim()) pending.push({ key: 'preaviso', label: 'Plazo de preaviso' })
  if (!input.variables.periodicidad?.trim()) pending.push({ key: 'periodicidad', label: 'Periodicidad' })
  if (!input.variables.renovacion?.trim()) pending.push({ key: 'renovacion', label: 'Renovación' })

  const rendered = renderContract(input.templateBody, {
    contratante: input.companyName || '',
    contraparte: input.supplierName || '',
    objeto: input.scope || '',
    moneda: input.currency,
    monto: String(input.amount),
    inicio: input.variables.inicio || '',
    termino: input.variables.termino || '',
    preaviso: input.variables.preaviso || '',
    periodicidad: input.variables.periodicidad || '',
    renovacion: input.variables.renovacion || '',
  }, input.clauses)

  const partidas = input.lines.length
    ? input.lines.map(line => `- ${line.description}: ${line.quantity} ${line.unit} × ${line.unitPrice} ${line.currency}`).join('\n')
    : 'Sin partidas registradas en la oferta.'
  const body = [
    rendered,
    `Anexo comercial. Estas partidas se copian de la oferta adjudicada. No se convierten en cláusulas jurídicas.\n${partidas}`,
    `Anexo técnico. Texto de la oferta, sujeto a revisión.\n${input.technical?.trim() || 'La oferta no tiene resumen técnico.'}${input.answers.length ? `\n${input.answers.map(answer => `- ${answer}`).join('\n')}` : ''}`,
    `Documentos citados del expediente. No se transcribe su contenido.\n${input.files.length ? input.files.map(file => `- ${file}`).join('\n') : 'No hay archivos de oferta asociados.'}`,
  ].join('\n\n')

  return { body, confirmed, pending }
}
