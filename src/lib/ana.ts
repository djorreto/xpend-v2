import { extractContractSignals } from './contract-extract.ts'

export type AnaEvidence = {
  source: string
  label: string
  quote?: string
  value?: string
}

export type AnaProposal = {
  kind: 'contract_clause' | 'initiative' | 'rfx_draft' | 'plan_note'
  title: string
  body: string
  origin: 'template' | 'retrieved' | 'user'
  requiresConfirmation: true
  estimatedSpend?: number | null
  currency?: string | null
}

export type AnaAnswer = {
  mode: AnaMode
  text: string
  evidence: AnaEvidence[]
  proposal: AnaProposal | null
  contextLabel: string
  modelCalled: boolean
}

export type SpendLine = {
  category: string
  supplier: string
  amount: number
  currency: string
  date: string | null
}

export type ScoreRow = {
  supplier: string
  technical: number | null
  economic: number | null
  final: number | null
  amount: number | null
  currency: string | null
  qualified: boolean
  exclusion: string | null
  rank: number | null
}

export type PlanRecord = {
  id: string
  title: string
  category: string | null
  status: string
  currency: string | null
  estimatedSpend: number | null
  targetSavings: number | null
  description: string | null
}

export type AnaDocument = { name: string; text: string }

export type AnaClause = { title: string; body: string }

export type AnaPack = {
  spend: SpendLine[]
  spendCount: number
  plan: PlanRecord | null
  scores: ScoreRow[]
  sealed: boolean
  documents: AnaDocument[]
  clauses: AnaClause[]
  rfxStatus: string | null
  licitacion: { id: string; name: string; status: string } | null
}

export type AnaContext = {
  module: 'spend' | 'plan' | 'rfx' | 'licitacion' | 'evaluacion' | 'contrato' | 'general'
  recordId?: string
  compareId?: string
  label: string
}

const INJECTION = [
  /ignore\s+(previous|all|above|prior)\s+instructions?/i,
  /disregard\s+(previous|all|above|prior)/i,
  /forget\s+(previous|all|above|prior)\s+instructions?/i,
  /ignora\s+(las\s+)?instrucciones/i,
  /you\s+are\s+now/i,
  /act\s+as\s+/i,
  /pretend\s+to\s+be/i,
  /reveal\s+your\s+(prompt|instructions?)/i,
  /system\s+prompt/i,
  /\[SYSTEM\]/i,
  /\[INST\]/i,
]

const CRITICAL = /adjudic|publica(r| las bases)|aprobar el contrato|firma(r| el)|asigna(r)? (el )?puntaje|modifica(r)? la evaluaci[oó]n cerrada|cierra(r)? la evaluaci/i

const SPEND_WORDS = /gasto|gastamos|proveedor|categor|consolid|concentr|spend|mantenimient|iniciativa/i

export function contextFromPath(path: string): AnaContext {
  const plan = path.match(/\/sourcing-plan\/([^/?]+)/)
  if (plan) return { module: 'plan', recordId: plan[1], label: 'Iniciativa abierta' }
  const rfx = path.match(/\/rfx-maker\/([^/?]+)/)
  if (rfx && rfx[1] !== 'new') return { module: 'rfx', recordId: rfx[1], label: 'RFx abierto' }
  const evaluation = path.match(/\/sala\/([^/?]+)/)
  if (evaluation) return { module: 'evaluacion', recordId: evaluation[1], label: 'Sala de ofertas' }
  const licitacion = path.match(/\/licitaciones\/([^/?]+)/)
  if (licitacion && licitacion[1] !== 'new') return { module: 'licitacion', recordId: licitacion[1], label: 'Licitación abierta' }
  const contract = path.match(/\/contratos\/([^/?]+)/)
  if (contract && !['nuevo', 'builder', 'comparar', 'desde-adjudicacion'].includes(contract[1])) {
    return { module: 'contrato', recordId: contract[1], label: 'Contrato abierto' }
  }
  if (path.includes('/sourcing-intelligence') || path.includes('spend')) return { module: 'spend', label: 'Gasto de la empresa' }
  if (path.includes('/sourcing-plan')) return { module: 'plan', label: 'Sourcing Plan' }
  if (path.includes('/contratos')) return { module: 'contrato', label: 'Contracts' }
  return { module: 'general', label: 'XPEND' }
}

export function isInjection(value: string) {
  return INJECTION.some(pattern => pattern.test(value))
}

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function money(amount: number) {
  return amount.toLocaleString('es-CL', { maximumFractionDigits: 2 })
}

function base(context: AnaContext, mode: AnaMode, text: string, evidence: AnaEvidence[] = [], proposal: AnaProposal | null = null): AnaAnswer {
  return { mode, text, evidence, proposal, contextLabel: context.label, modelCalled: false }
}

function stripInjectedLines(text: string) {
  const kept = text.split('\n').filter(line => !isInjection(line))
  return { text: kept.join('\n'), ignored: kept.length !== text.split('\n').length }
}

function sentences(text: string) {
  return text
    .split(/\n+|(?<=\.)\s+/)
    .map(item => item.trim())
    .filter(item => item.length >= 12)
}

const GROUPS: string[][] = [
  ['preaviso', 'anticipacion', 'avisar', 'aviso', 'renovar', 'renovacion', 'renovaremos'],
  ['obligacion', 'obligaciones', 'debe', 'proveedor'],
  ['penalidad', 'penalidades', 'multa', 'multas'],
  ['pago', 'factura', 'reajuste'],
  ['vigencia', 'termino', 'inicio', 'plazo'],
  ['sla', 'servicio', 'nivel'],
  ['riesgo', 'riesgos', 'clausula', 'clausulas'],
]

function searchWords(question: string) {
  const words = normalize(question).split(/[^a-z0-9]+/).filter(word => word.length > 3)
  const extra = GROUPS.filter(group => group.some(word => words.includes(word))).flat()
  return Array.from(new Set([...words, ...extra])).filter(word => !['este', 'esta', 'estos', 'para', 'como', 'cual', 'cuales', 'donde', 'tiene', 'tienen', 'sobre', 'desde', 'contrato', 'contratos'].includes(word))
}

export function quotesFrom(document: AnaDocument, question: string): AnaEvidence[] {
  const clean = stripInjectedLines(document.text)
  const words = searchWords(question)
  return sentences(clean.text)
    .map(sentence => ({ sentence, score: words.filter(word => normalize(sentence).includes(word)).length }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => ({
      source: document.name,
      label: 'Texto del documento',
      quote: item.sentence.slice(0, 280),
    }))
}

function spendTotals(lines: SpendLine[]) {
  const totals = new Map<string, number>()
  for (const line of lines) {
    const currency = (line.currency || 'USD').toUpperCase()
    totals.set(currency, (totals.get(currency) || 0) + (Number(line.amount) || 0))
  }
  return Array.from(totals.entries()).map(([currency, amount]) => ({ currency, amount }))
}

function spendAnswer(context: AnaContext, pack: AnaPack, question: string): AnaAnswer {
  if (pack.spendCount === 0 || pack.spend.length === 0) {
    return base(context, 'data', 'No hay gasto cargado en Sourcing Intelligence para esta empresa. No calculé cifras. Para empezar, carga un archivo de gasto en Sourcing Intelligence y confirma moneda, período e impuesto. Después puedo leer esos totales.')
  }
  if (pack.spendCount > pack.spend.length) {
    return base(context, 'data', `Hay ${pack.spendCount} líneas de gasto. Este resumen no lee un archivo parcial como si fuera el total. Acota el período en Sourcing Intelligence antes de pedir una cifra.`, [
      { source: 'si_spend_lines', label: 'Líneas cargadas', value: String(pack.spendCount) },
    ])
  }
  const asked = normalize(question)
  const filtered = /mantenimient|proveedor|categor|consolid|concentr/.test(asked)
    ? pack.spend.filter(line => {
      const haystack = normalize(`${line.category} ${line.supplier}`)
      if (asked.includes('mantenimient')) return haystack.includes('mantenimient')
      return true
    })
    : pack.spend
  const lines = filtered.length ? filtered : []
  if (/mantenimient/.test(asked) && lines.length === 0) {
    const totals = spendTotals(pack.spend).map(item => `${item.currency} ${money(item.amount)}`).join(', ')
    return base(context, 'data', `No hay líneas cuya categoría o proveedor diga mantenimiento. El gasto cargado, sin mezclar monedas, es ${totals}.`, [
      { source: 'si_spend_lines', label: 'Líneas leídas', value: String(pack.spend.length) },
    ])
  }
  const dates = lines.map(line => line.date).filter((date): date is string => Boolean(date)).sort()
  const period = dates.length ? `${dates[0]} a ${dates[dates.length - 1]}` : 'sin fecha en las líneas'
  const totals = spendTotals(lines)
  const evidence: AnaEvidence[] = totals.map(item => ({
    source: 'si_spend_lines',
    label: `Total ${item.currency}`,
    value: String(item.amount),
  }))
  evidence.push({ source: 'si_spend_lines', label: 'Líneas', value: String(lines.length) }, { source: 'si_spend_lines', label: 'Período', value: period })

  if (/proveedor|concentr/.test(asked)) {
    const currency = totals.sort((a, b) => b.amount - a.amount)[0]?.currency
    const subset = lines.filter(line => line.currency.toUpperCase() === currency)
    const total = subset.reduce((sum, line) => sum + line.amount, 0)
    const bySupplier = new Map<string, number>()
    for (const line of subset) bySupplier.set(line.supplier || 'Sin nombre', (bySupplier.get(line.supplier || 'Sin nombre') || 0) + line.amount)
    const ranked = Array.from(bySupplier.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const text = ranked.map(([name, amount]) => {
      const share = total > 0 ? Math.round(amount / total * 1000) / 10 : 0
      return `${name}: ${currency} ${money(amount)} (${share}% de ${currency})`
    }).join('\n')
    const concentrated = ranked.filter(([, amount]) => total > 0 && amount / total >= 0.4).map(([name]) => name)
    const note = concentrated.length ? `Concentración relevante, al menos 40% de ${currency}: ${concentrated.join(', ')}.` : `Ningún proveedor alcanza 40% del gasto en ${currency}.`
    return base(context, 'data', `Principales proveedores en ${currency}, período ${period}. Las monedas no se suman entre sí.\n${text}\n${note}`, evidence)
  }

  if (/categor|consolid/.test(asked)) {
    const byCategory = new Map<string, { amount: number; currency: string; suppliers: Set<string> }>()
    for (const line of lines) {
      const key = `${line.currency.toUpperCase()}::${line.category || 'Sin categoría'}`
      const current = byCategory.get(key) || { amount: 0, currency: line.currency.toUpperCase(), suppliers: new Set<string>() }
      current.amount += line.amount
      if (line.supplier) current.suppliers.add(line.supplier)
      byCategory.set(key, current)
    }
    const ranked = Array.from(byCategory.entries()).sort((a, b) => b[1].amount - a[1].amount).slice(0, 5)
    const text = ranked.map(([key, item]) => `${key.split('::')[1]}: ${item.currency} ${money(item.amount)}, ${item.suppliers.size} proveedores`).join('\n')
    const many = ranked.filter(([, item]) => item.suppliers.size >= 3).map(([key]) => key.split('::')[1])
    const proposal: AnaProposal | null = ranked[0] ? {
      kind: 'initiative',
      title: ranked[0][0].split('::')[1],
      body: `Iniciativa sugerida para ${ranked[0][0].split('::')[1]}. Gasto observado ${ranked[0][1].currency} ${money(ranked[0][1].amount)} en ${period}. El ahorro no está calculado.`,
      origin: 'retrieved',
      requiresConfirmation: true,
      estimatedSpend: ranked[0][1].amount,
      currency: ranked[0][1].currency,
    } : null
    const extra = many.length ? `Oportunidad de consolidación, tres o más proveedores en la misma moneda: ${many.join(', ')}.` : 'No vi una categoría con tres o más proveedores en la misma moneda.'
    return base(context, 'data', `Categorías según las líneas cargadas, período ${period}.\n${text}\n${extra}\nPuedo dejar una iniciativa en el plan solo si la confirmas. No guardé nada.`, evidence, proposal)
  }

  const totalsText = totals.map(item => `${item.currency} ${money(item.amount)}`).join('; ')
  return base(context, 'data', `Gasto leído de Sourcing Intelligence, ${lines.length} líneas, período ${period}. Totales separados por moneda: ${totalsText}.`, evidence)
}

function evaluationAnswer(context: AnaContext, pack: AnaPack): AnaAnswer {
  if (pack.sealed) {
    return base(context, 'refused', 'Las ofertas de este proceso siguen cerradas. No leí propuestas, partidas ni montos.')
  }
  if (!pack.scores.length) {
    return base(context, 'data', 'No hay puntajes persistidos para este proceso. No calculé una evaluación nueva.')
  }
  const lines = pack.scores.map(row => {
    const final = row.final == null ? 'sin puntaje final persistido' : `puntaje final ${row.final}`
    const technical = row.technical == null ? 'sin puntaje técnico' : `técnico ${row.technical}`
    const economic = row.economic == null ? 'sin puntaje económico' : `económico ${row.economic}`
    const amount = row.amount == null ? 'sin monto persistido' : `${row.currency || ''} ${money(row.amount)}`.trim()
    const exclusion = row.exclusion ? ` Exclusión registrada: ${row.exclusion}.` : ''
    return `${row.supplier}: ${technical}, ${economic}, ${final}. Monto ${amount}.${exclusion}`
  })
  return base(context, 'data', `Estos puntajes están guardados en la evaluación. No los recalculé, no asigné un puntaje definitivo y no adjudiqué.\n${lines.join('\n')}\nLa adjudicación sigue siendo una decisión humana del comité.`, pack.scores.map(row => ({
    source: 'evaluation_results',
    label: row.supplier,
    value: row.final == null ? 'sin puntaje final' : String(row.final),
    quote: row.exclusion || undefined,
  })))
}

function documentAnswer(context: AnaContext, pack: AnaPack, question: string): AnaAnswer {
  const cleaned = pack.documents.map(document => ({ document, clean: stripInjectedLines(document.text) }))
  const ignored = cleaned.some(item => item.clean.ignored)
  const asked = normalize(question)
  if (/compara/.test(asked)) {
    if (cleaned.length < 2) {
      return base(context, 'document', 'Para comparar necesito dos contratos autorizados. Abre la comparación con los dos registros. No completé la diferencia con una conclusión que no esté escrita.')
    }
    const sides = cleaned.slice(0, 2).map(item => ({
      name: item.document.name,
      quotes: quotesFrom({ name: item.document.name, text: item.clean.text }, question),
    }))
    const text = sides.map(side => side.quotes.length
      ? `${side.name}: ${side.quotes.map(quote => `“${quote.quote}”`).join(' ')}`
      : `${side.name}: no consta en el texto una cláusula que responda esta comparación.`).join('\n')
    return base(context, 'document', `${text}\nEsto es una lectura del texto, no una opinión legal. Requiere revisión humana.${ignored ? ' Ignoré instrucciones insertadas en el documento.' : ''}`, sides.flatMap(side => side.quotes))
  }
  if (/prop[oó]n|redacta|mejora la cl[aá]usula|alternativa de redacci/.test(asked)) {
    const words = searchWords(question)
    const clause = pack.clauses.find(item => words.some(word => normalize(`${item.title} ${item.body}`).includes(word)))
    if (!clause) {
      return base(context, 'model_required', 'No hay una cláusula aprobada de la empresa que cubra ese pedido, y no hay un modelo autorizado para redactar una nueva. No inventé texto contractual.')
    }
    return base(context, 'draft', `Puedo usar la cláusula aprobada «${clause.title}». No la guardé. Si la confirmas, queda como versión borrador y no toca una versión ya aprobada.`, [
      { source: 'contract_clauses', label: clause.title, quote: clause.body },
    ], {
      kind: 'contract_clause',
      title: clause.title,
      body: `${clause.title}. ${clause.body}`,
      origin: 'template',
      requiresConfirmation: true,
    })
  }
  if (/resum/.test(asked)) {
    const evidence = cleaned.flatMap(item => {
      const signals = extractContractSignals(item.clean.text)
      return [
        ...signals.fields.map(field => ({ source: item.document.name, label: field.fieldKey, quote: field.quote, value: field.value })),
        ...signals.findings.map(finding => ({ source: item.document.name, label: finding.kind, quote: finding.quote })),
      ]
    })
    if (!evidence.length) {
      return base(context, 'document', `No pude verificar cláusulas en el texto de ${context.label}. No completé el resumen.${ignored ? ' Ignoré instrucciones insertadas en el documento.' : ''}`)
    }
    const lines = evidence.map(item => `${item.label}: ${item.value || item.quote} (“${item.quote}”)`)
    return base(context, 'document', `${lines.join('\n')}\nResumen asistido. Requiere revisión humana.${ignored ? ' Ignoré instrucciones insertadas en el documento.' : ''}`, evidence)
  }
  const evidence = cleaned.flatMap(item => quotesFrom({ name: item.document.name, text: item.clean.text }, question))
  if (!evidence.length) {
    return base(context, 'document', `Eso no aparece en el texto autorizado de ${context.label}. No completé la respuesta con una cláusula o una conclusión que no esté escrita.${ignored ? ' Ignoré instrucciones insertadas en el documento.' : ''} La lectura es asistiva y requiere revisión humana.`)
  }
  const quotes = evidence.map(item => `${item.source}: “${item.quote}”`).join('\n')
  return base(context, 'document', `${quotes}\nLa lectura es asistiva y requiere revisión humana. No sustituye una revisión legal.${ignored ? ' Ignoré instrucciones insertadas en el documento.' : ''}`, evidence)
}

function planAnswer(context: AnaContext, pack: AnaPack, question: string): AnaAnswer {
  const plan = pack.plan
  if (!plan) return base(context, 'data', 'No encontré la iniciativa en tu empresa. No armé un borrador con datos de otro registro.')
  const missing = [
    !plan.description ? 'descripción' : '',
    !plan.category ? 'categoría' : '',
    plan.estimatedSpend == null ? 'gasto estimado' : '',
    !plan.currency ? 'moneda' : '',
    plan.targetSavings == null ? 'objetivo de ahorro' : '',
  ].filter(Boolean)
  const facts = `Iniciativa «${plan.title}», estado ${plan.status}. Categoría ${plan.category || 'pendiente'}. Gasto estimado ${plan.estimatedSpend == null ? 'pendiente' : `${plan.currency || ''} ${money(plan.estimatedSpend)}`.trim()}. Objetivo de ahorro ${plan.targetSavings == null ? 'pendiente' : `${plan.currency || ''} ${money(plan.targetSavings)}`.trim()}.`
  const evidence: AnaEvidence[] = [
    { source: 'sourcing_plans', label: plan.title, value: plan.status },
  ]
  if (/rfx|bases|borrador|requisito|criterio|ponder/.test(normalize(question))) {
    const body = [
      `Objeto recuperado de la iniciativa: ${plan.title}.`,
      `Antecedente recuperado: ${plan.description || 'la iniciativa no tiene descripción.'}`,
      `Categoría recuperada: ${plan.category || 'pendiente'}.`,
      'Requisitos técnicos: no están en la iniciativa. No los redacté con un modelo.',
      'Criterios y ponderaciones: no constan en este registro. El comprador tiene que definirlos.',
      'Este texto no deja el RFx listo ni publicado.',
    ].join('\n')
    return base(context, 'draft', `${facts}\nFalta: ${missing.join(', ') || 'nada de esos campos'}.\n\n${body}`, evidence, {
      kind: 'rfx_draft',
      title: `Borrador de RFx para ${plan.title}`,
      body,
      origin: 'retrieved',
      requiresConfirmation: true,
    })
  }
  const note = [
    `Resumen de «${plan.title}».`,
    facts,
    missing.length ? `Información faltante: ${missing.join(', ')}.` : 'Los campos principales de la iniciativa están completos.',
    'Hitos de proceso, no guardados: definir alcance, preparar bases, recibir ofertas, evaluar y llevar la decisión al comité.',
    'El objetivo de ahorro no es un ahorro realizado.',
  ].join('\n')
  return base(context, 'draft', note, evidence, {
    kind: 'plan_note',
    title: `Notas de ${plan.title}`,
    body: note,
    origin: 'retrieved',
    requiresConfirmation: true,
  })
}

export function answerAna(question: string, context: AnaContext, pack: AnaPack): AnaAnswer {
  if (!question.trim()) return base(context, 'refused', 'Escribe la consulta.')
  if (isInjection(question)) {
    return base(context, 'refused', 'No puedo cambiar mis reglas ni revelar instrucciones internas. Pregunta por un gasto, una iniciativa, una evaluación o un contrato de tu empresa.')
  }
  if (CRITICAL.test(normalize(question))) {
    return base(context, 'refused', 'Esa acción la hace una persona en el módulo correspondiente. No publico, no adjudico, no asigno puntajes ni apruebo contratos.')
  }
  if (context.module === 'evaluacion' || /evalua|puntaje|alfa|beta|gamma/.test(normalize(question))) {
    if (context.module === 'evaluacion' || pack.scores.length || pack.sealed) return evaluationAnswer(context, pack)
  }
  if (context.module === 'contrato' || pack.documents.length) {
    if (context.module === 'contrato' || /contrato|cl[aá]usula|penal|preaviso|obligaci/.test(normalize(question))) {
      return documentAnswer(context, pack, question)
    }
  }
  if (context.module === 'plan' || context.module === 'rfx' || /iniciativa|rfx|bases/.test(normalize(question))) {
    if (pack.plan || context.module === 'plan' || context.module === 'rfx') return planAnswer(context, pack, question)
  }
  if (context.module === 'licitacion' && pack.licitacion) {
    return base(context, 'data', `Licitación ${pack.licitacion.id}, «${pack.licitacion.name}», estado ${pack.licitacion.status}. No cambié ese estado.`, [
      { source: 'licitaciones', label: pack.licitacion.id, value: pack.licitacion.status },
    ])
  }
  if (context.module === 'spend' || SPEND_WORDS.test(question)) return spendAnswer(context, pack, question)
  return base(context, 'model_required', 'Puedo leer el gasto cargado, la iniciativa abierta, los puntajes persistidos y el texto de un contrato autorizado. Una respuesta libre de un modelo no está habilitada, así que no la simulé.')
}
