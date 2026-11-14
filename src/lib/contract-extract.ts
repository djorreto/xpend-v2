export type Evidence = {
  quote: string
  location: string
  confidence: 'high' | 'medium' | 'low'
}

export type FieldProposal = Evidence & {
  fieldKey: string
  value: string
}

export type ClauseFinding = Evidence & {
  kind: string
  statement: string
}

function locate(text: string, quote: string): string {
  const index = text.toLowerCase().indexOf(quote.toLowerCase())
  if (index < 0) return 'fragmento no ubicado'
  return `caracteres ${index + 1}-${index + quote.length}`
}

function take(text: string, pattern: RegExp, confidence: Evidence['confidence']): Evidence | null {
  const match = text.match(pattern)
  if (!match || !match[0].trim()) return null
  const quote = match[0].trim().slice(0, 280)
  return { quote, location: locate(text, quote), confidence }
}

/** Solo propone lo que está escrito. Lo que no aparece queda pendiente, sin valor inventado. */
export function extractContractSignals(text: string): { fields: FieldProposal[]; findings: ClauseFinding[] } {
  const fields: FieldProposal[] = []
  const findings: ClauseFinding[] = []
  const source = text.replace(/\s+/g, ' ').trim()
  if (source.length < 40) return { fields, findings }

  const addField = (fieldKey: string, value: string, evidence: Evidence | null) => {
    if (!evidence || !value.trim()) return
    fields.push({ fieldKey, value: value.trim(), ...evidence })
  }
  const addFinding = (kind: string, statement: string, evidence: Evidence | null) => {
    if (!evidence) return
    findings.push({ kind, statement, ...evidence })
  }

  const money = source.match(/\b(USD|CLP|EUR)\s+([0-9][0-9.]*(?:,[0-9]{1,2})?)/i)
  if (money) {
    const evidence = take(source, new RegExp(`${money[1]}\\s+${money[2].replace('.', '\\.')}`, 'i'), 'high')
    addField('currency', money[1].toUpperCase(), evidence)
    addField('amount', money[2].replace(/\./g, '').replace(',', '.'), evidence)
  }

  const dates = source.match(/desde el (\d{4}-\d{2}-\d{2}) hasta el (\d{4}-\d{2}-\d{2})/i)
  if (dates) {
    const evidence = take(source, /desde el \d{4}-\d{2}-\d{2} hasta el \d{4}-\d{2}-\d{2}/i, 'high')
    addField('starts_on', dates[1], evidence)
    addField('ends_on', dates[2], evidence)
  }

  const renewal = take(source, /renovaci[oó]n autom[aá]tica(?:[^.]{0,80})?/i, 'high')
  if (renewal) {
    addField('renewal', 'automatic', renewal)
    addFinding('renewal', 'El texto dice que la renovación es automática.', renewal)
  }
  const manualRenewal = take(source, /renovaci[oó]n manual(?:[^.]{0,60})?/i, 'high')
  if (manualRenewal && !renewal) addField('renewal', 'manual', manualRenewal)

  const notice = source.match(/preaviso de (\d{1,3}) d[ií]as/i)
  if (notice) {
    const evidence = take(source, /preaviso de \d{1,3} d[ií]as/i, 'high')
    addField('notice_days', notice[1], evidence)
    addFinding('notice', `El preaviso escrito es de ${notice[1]} días.`, evidence)
  }

  const party = source.match(/contraparte:\s*([^.\n]{3,80})/i)
  if (party) addField('counterparty', party[1].trim(), take(source, /contraparte:\s*[^.\n]{3,80}/i, 'medium'))

  const objectText = source.match(/objeto:\s*([^.\n]{10,220})/i)
  if (objectText) addField('object', objectText[1].trim(), take(source, /objeto:\s*[^.\n]{10,220}/i, 'medium'))

  const payment = take(source, /pago[^.]{8,140}/i, 'medium')
  if (payment) {
    addField('payment', payment.quote, payment)
    addFinding('payment', 'Hay una condición de pago escrita en el documento.', payment)
  }
  const adjustment = take(source, /reajuste[^.]{8,140}/i, 'medium')
  if (adjustment) {
    addField('adjustment', adjustment.quote, adjustment)
    addFinding('adjustment', 'Hay una condición de reajuste escrita en el documento.', adjustment)
  }
  const termination = take(source, /terminaci[oó]n[^.]{8,160}/i, 'medium')
  if (termination) addFinding('termination', 'Hay una condición de terminación escrita en el documento.', termination)
  const obligation = take(source, /obligaci[oó]n[^.]{8,160}/i, 'medium')
  if (obligation) addFinding('obligation', 'Hay una obligación escrita en el documento.', obligation)
  const sla = take(source, /(?:SLA|nivel de servicio)[^.]{0,140}/i, 'medium')
  if (sla) addFinding('sla', 'Hay un nivel de servicio escrito en el documento.', sla)
  const penalty = take(source, /multa[^.]{8,140}/i, 'medium')
  if (penalty) addFinding('penalty', 'Hay una multa o penalidad escrita en el documento.', penalty)
  const guarantee = take(source, /garant[ií]a[^.]{8,140}/i, 'medium')
  if (guarantee) addFinding('guarantee', 'Hay una garantía escrita en el documento.', guarantee)
  const liability = take(source, /responsabilidad[^.]{8,140}/i, 'low')
  if (liability) addFinding('liability', 'Hay un pasaje sobre responsabilidad. Requiere lectura humana.', liability)
  const confidentiality = take(source, /confidencialidad[^.]{0,140}/i, 'medium')
  if (confidentiality) addFinding('confidentiality', 'Hay una cláusula de confidencialidad.', confidentiality)
  const exclusivity = take(source, /exclusividad[^.]{0,140}/i, 'medium')
  if (exclusivity) addFinding('exclusivity', 'Hay una mención de exclusividad.', exclusivity)

  return { fields, findings }
}

export function renderContract(body: string, variables: Record<string, string>, clauses: string[]) {
  const rendered = body.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (token, key: string) => {
    const value = variables[key]
    return value && value.trim() ? value.trim() : token
  })
  const extra = clauses.filter(clause => clause.trim()).map(clause => clause.trim()).join('\n\n')
  return extra ? `${rendered.trim()}\n\n${extra}` : rendered.trim()
}

export const SERVICE_TEMPLATE = `CONTRATO DE SERVICIOS

{{contratante}} contrata a {{contraparte}}.

Objeto: {{objeto}}

Vigencia desde {{inicio}} hasta {{termino}}.
Monto {{moneda}} {{monto}}, periodicidad {{periodicidad}}.
Renovación {{renovacion}}. Preaviso de {{preaviso}} días.

Las variables que sigan entre llaves no fueron completadas y no se inventan.`

export const OPTIONAL_CLAUSES = [
  { title: 'Confidencialidad', body: 'Las partes mantienen reserva de la información técnica y económica del servicio.' },
  { title: 'Terminación', body: 'Cualquiera puede poner término anticipado con el preaviso indicado, sin perjuicio de los servicios ya ejecutados.' },
  { title: 'Garantía', body: 'El proveedor mantiene una garantía de fiel cumplimiento por el plazo del contrato, si las partes la documentan en el anexo.' },
]
