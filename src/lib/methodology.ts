// Metodologías de Procurement: plantillas Light, Completa (Xinergy) y Custom.
// La base de datos guarda la definición (methodology_templates.definition); este módulo es su contrato y la fuente
// de las plantillas del sistema que la migración inserta. Los eventos estándar son los mismos para cualquier plantilla:
// así los indicadores comparan proyectos con metodologías distintas.

export type MethodologyKind = 'light' | 'complete' | 'custom'
export type TaskRole = 'category_manager' | 'buyer' | 'manager' | 'legal' | 'committee' | 'requester' | 'supplier_relations'

// Hitos automáticos: se cumplen solo cuando el registro real existe en XPEND.
export const STANDARD_EVENTS = {
  baseline_approved: 'Línea base aprobada',
  bases_approved: 'Pliego aprobado',
  rfx_published: 'RFx publicado',
  offers_opened: 'Apertura de ofertas',
  evaluation_closed: 'Evaluación cerrada',
  final_round_opened: 'Ronda final abierta',
  award_decided: 'Adjudicación formal',
  contract_approved: 'Contrato aprobado',
  savings_validated: 'Ahorro validado',
} as const
export type StandardEvent = keyof typeof STANDARD_EVENTS

// Un proyecto que sale al mercado necesita, como mínimo, estos eventos con una tarea que los represente.
export const REQUIRED_EVENTS: StandardEvent[] = ['rfx_published', 'offers_opened', 'evaluation_closed', 'award_decided']

export type StageDef = { key: string; name: string; summary?: string }
export type TaskDef = {
  key: string
  code: string
  stage: string
  title: string
  kind: 'task' | 'milestone' | 'approval'
  duration: number
  depends: string[]
  role: TaskRole
  optional?: boolean
  event?: StandardEvent
  deliverable?: string
  subtasks?: string[]
}
export type DeliverableDef = {
  key: string
  title: string
  stage: string
  description: string
  approval: boolean
  approverRole?: TaskRole
  documentRequired: boolean
}
export type MethodologyRules = {
  baselineRequired: boolean
  baselineApproval: 'simple' | 'formal'
  technicalBeforeEconomic: boolean
}
export type MethodologyDefinition = {
  stages: StageDef[]
  tasks: TaskDef[]
  deliverables: DeliverableDef[]
  rules: MethodologyRules
}

const t = (key: string, code: string, stage: string, title: string, duration: number, depends: string[], role: TaskRole, extra: Partial<TaskDef> = {}): TaskDef =>
  ({ key, code, stage, title, kind: 'task', duration, depends, role, ...extra })

export const LIGHT: MethodologyDefinition = {
  stages: [
    { key: 'L1', name: 'Definición y referencia económica', summary: 'Qué se compra y contra qué se medirá el ahorro.' },
    { key: 'L2', name: 'Preparación y salida al mercado', summary: 'Bases, proveedores y publicación.' },
    { key: 'L3', name: 'Evaluación y negociación', summary: 'Ofertas, comparación y negociación.' },
    { key: 'L4', name: 'Adjudicación y contratación', summary: 'Decisión formal y contrato.' },
    { key: 'L5', name: 'Seguimiento de resultados', summary: 'Ahorro y servicio.' },
  ],
  tasks: [
    t('l1', '1', 'L1', 'Definir necesidad, alcance y responsables', 5, [], 'category_manager'),
    t('l2', '2', 'L1', 'Documentar la referencia económica', 5, ['l1'], 'category_manager', { kind: 'approval', event: 'baseline_approved', deliverable: 'referencia' }),
    t('l3', '3', 'L2', 'Preparar bases y lista de proveedores', 7, ['l1'], 'buyer', { deliverable: 'bases' }),
    t('l4', '4', 'L2', 'Publicar el RFx e invitar proveedores', 1, ['l3'], 'buyer', { kind: 'milestone', event: 'rfx_published' }),
    t('l5', '5', 'L3', 'Recibir y abrir ofertas', 10, ['l4'], 'buyer', { kind: 'milestone', event: 'offers_opened' }),
    t('l6', '6', 'L3', 'Evaluar y negociar', 7, ['l5'], 'category_manager', { event: 'evaluation_closed', deliverable: 'recomendacion' }),
    t('l7', '7', 'L4', 'Adjudicar', 3, ['l6'], 'committee', { kind: 'milestone', event: 'award_decided' }),
    t('l8', '8', 'L4', 'Formalizar el contrato', 10, ['l7'], 'legal', { kind: 'milestone', event: 'contract_approved' }),
    t('l9', '9', 'L5', 'Seguir ahorro y servicio', 60, ['l8'], 'category_manager', { deliverable: 'seguimiento' }),
  ],
  deliverables: [
    { key: 'referencia', title: 'Referencia económica', stage: 'L1', description: 'Precio, cantidad y condiciones comparables contra las que se mide el ahorro.', approval: true, approverRole: 'manager', documentRequired: false },
    { key: 'bases', title: 'Bases del proceso', stage: 'L2', description: 'Bases técnicas y económicas publicadas a los proveedores.', approval: false, documentRequired: true },
    { key: 'recomendacion', title: 'Recomendación de adjudicación', stage: 'L3', description: 'Resultado de la evaluación y propuesta al comité.', approval: true, approverRole: 'manager', documentRequired: false },
    { key: 'seguimiento', title: 'Seguimiento de resultados', stage: 'L5', description: 'Ahorro capturado y desempeño del servicio.', approval: false, documentRequired: false },
  ],
  rules: { baselineRequired: true, baselineApproval: 'simple', technicalBeforeEconomic: false },
}

// Metodología Completa: las ocho etapas y 29 actividades de la metodología de sourcing de Xinergy.
export const COMPLETE: MethodologyDefinition = {
  stages: [
    { key: 'E1', name: 'Gasto de referencia', summary: 'Kick-off, levantamiento y análisis de la información.' },
    { key: 'E2', name: 'Análisis técnico y de mercado', summary: 'Proveedores, mercado y oportunidades.' },
    { key: 'E3', name: 'Desarrollar la estrategia', summary: 'Lista corta y estrategia de negociación aprobada.' },
    { key: 'E4', name: 'Pliegos y salida al mercado', summary: 'Línea base, bases, contrato y publicación del RFx.' },
    { key: 'E5', name: 'Evaluación de propuestas y cierre técnico', summary: 'Evaluación técnica y económica.' },
    { key: 'E6', name: 'Negociación final y formalización', summary: 'Negociación de cierre, adjudicación y contrato.' },
    { key: 'E7', name: 'Implementación del modelo', summary: 'Transición y continuidad del servicio.' },
    { key: 'E8', name: 'Monitoreo y control', summary: 'Ahorros, servicio y acciones correctivas.' },
  ],
  tasks: [
    t('a1', '1', 'E1', 'Kick-Off', 2, [], 'category_manager', { kind: 'milestone' }),
    t('a2', '2', 'E1', 'Levantamiento de información', 10, ['a1'], 'buyer', { subtasks: ['Gasto histórico', 'Contratos vigentes', 'Precios, cantidades y condiciones'] }),
    t('a3', '3', 'E1', 'Análisis de información', 10, ['a2'], 'category_manager', { deliverable: 'gasto_referencia' }),
    t('a4', '4', 'E2', 'Levantamiento de lista larga de proveedores', 7, ['a3'], 'buyer', { deliverable: 'iniciativas_ahorro' }),
    t('a10', '10', 'E3', 'Confirmación de lista corta de proveedores', 5, ['a4'], 'category_manager'),
    t('a11', '11', 'E3', 'Presentación y aprobación de estrategia de negociación', 5, ['a10'], 'manager', { kind: 'approval', deliverable: 'estrategia_categoria' }),
    t('a5', '5', 'E4', 'Construcción de línea base', 7, ['a3'], 'category_manager'),
    t('a6', '6', 'E4', 'Construcción de bases técnicas', 10, ['a4'], 'buyer'),
    t('a7', '7', 'E4', 'Construcción de bases administrativas y anexos', 7, ['a6'], 'buyer'),
    t('a8', '8', 'E4', 'Construcción de contrato de servicios', 7, ['a7'], 'legal'),
    t('a9', '9', 'E4', 'Firma de línea base y aprobación de bases de licitación', 3, ['a5', 'a8', 'a11'], 'manager', { kind: 'approval', event: 'baseline_approved', deliverable: 'pliego' }),
    t('a12', '12', 'E4', 'Invitación a proveedores', 2, ['a9'], 'buyer'),
    t('a13', '13', 'E4', 'Publicación del RFx', 1, ['a12'], 'buyer', { kind: 'milestone', event: 'rfx_published' }),
    t('a14', '14', 'E4', 'Recepción de preguntas', 7, ['a13'], 'buyer'),
    t('a15', '15', 'E4', 'Envío de respuestas', 5, ['a14'], 'buyer'),
    t('a16', '16', 'E5', 'Recepción de propuestas', 10, ['a15'], 'buyer', { kind: 'milestone', event: 'offers_opened' }),
    t('a17', '17', 'E5', 'Evaluación técnica', 7, ['a16'], 'category_manager'),
    t('a18', '18', 'E5', 'Evaluación económica', 5, ['a17'], 'category_manager', { event: 'evaluation_closed', deliverable: 'matriz_evaluacion' }),
    t('a19', '19', 'E5', 'Presentación de resultados y posible adjudicación', 2, ['a18'], 'category_manager', { deliverable: 'proveedores_negociacion' }),
    t('a20', '20', 'E6', 'Definición de estrategia de negociación de cierre', 3, ['a19'], 'category_manager', { kind: 'approval', deliverable: 'estrategia_cierre' }),
    t('a21', '21', 'E6', 'Publicación de negociación de cierre', 1, ['a20'], 'buyer', { kind: 'milestone', optional: true, event: 'final_round_opened' }),
    t('a22', '22', 'E6', 'Recepción de propuestas finales', 5, ['a21'], 'buyer', { optional: true }),
    t('a23', '23', 'E6', 'Evaluación de propuesta final', 3, ['a22'], 'category_manager', { optional: true }),
    t('a24', '24', 'E6', 'Presentación de resultados, recomendación de adjudicación y ahorros', 2, ['a23'], 'category_manager', { kind: 'approval', deliverable: 'recomendacion_adjudicacion' }),
    t('a25', '25', 'E6', 'Adjudicación', 1, ['a24'], 'committee', { kind: 'milestone', event: 'award_decided' }),
    t('a26', '26', 'E6', 'Confirmación formal del proveedor', 3, ['a25'], 'buyer'),
    t('a27', '27', 'E6', 'Revisión y firma de contrato', 10, ['a26'], 'legal', { kind: 'milestone', event: 'contract_approved', deliverable: 'acta_contratos' }),
    t('a28', '28', 'E7', 'Kick-off del servicio', 5, ['a27'], 'category_manager', { deliverable: 'plan_implementacion' }),
    t('a29', '29', 'E8', 'Seguimiento de ahorros y servicio', 90, ['a28'], 'category_manager', { deliverable: 'brechas_acciones' }),
  ],
  deliverables: [
    { key: 'gasto_referencia', title: 'Gasto de referencia por categoría', stage: 'E1', description: 'Gasto histórico, precios, cantidades, plazos, condiciones y contratos actuales. Todavía no es la línea base aprobada.', approval: false, documentRequired: true },
    { key: 'iniciativas_ahorro', title: 'Listado de iniciativas de ahorro', stage: 'E2', description: 'Oportunidades de precio, demanda, especificación y condiciones, con riesgo e impacto esperado.', approval: false, documentRequired: true },
    { key: 'estrategia_categoria', title: 'Estrategia de categoría', stage: 'E3', description: 'Modelo de compra, mercado, proveedores, alcance, lotes, criterios y escenarios de contratación.', approval: true, approverRole: 'manager', documentRequired: true },
    { key: 'pliego', title: 'Pliego de licitación', stage: 'E4', description: 'Bases técnicas y administrativas, anexos, formularios y contrato tipo, versionados y aprobados.', approval: true, approverRole: 'manager', documentRequired: true },
    { key: 'matriz_evaluacion', title: 'Matriz de evaluación técnica y económica', stage: 'E5', description: 'Puntajes por criterio y comparación económica de las ofertas.', approval: false, documentRequired: true },
    { key: 'proveedores_negociacion', title: 'Proveedores aprobados para negociación final', stage: 'E5', description: 'Resultado de la evaluación y proveedores que pasan a la negociación de cierre.', approval: false, documentRequired: false },
    { key: 'estrategia_cierre', title: 'Estrategia de negociación final', stage: 'E6', description: 'Objetivos, concesiones y límites de la negociación de cierre.', approval: true, approverRole: 'manager', documentRequired: true },
    { key: 'recomendacion_adjudicacion', title: 'Resultado y recomendación de adjudicación', stage: 'E6', description: 'Recomendación al comité con el ahorro negociado frente a la línea base.', approval: true, approverRole: 'manager', documentRequired: true },
    { key: 'acta_contratos', title: 'Acta y contratos formalizados', stage: 'E6', description: 'Acta de adjudicación y contratos aprobados.', approval: false, documentRequired: true },
    { key: 'plan_implementacion', title: 'Plan de implementación', stage: 'E7', description: 'Transición contractual, actividades, responsables, fechas, pendientes y riesgos.', approval: false, documentRequired: true },
    { key: 'brechas_acciones', title: 'Brechas y acciones correctivas', stage: 'E8', description: 'Seguimiento de beneficios, cumplimiento contractual y acciones con responsables.', approval: false, documentRequired: true },
  ],
  rules: { baselineRequired: true, baselineApproval: 'formal', technicalBeforeEconomic: true },
}

export const SYSTEM_TEMPLATES = [
  { template_key: 'light', kind: 'light' as const, name: 'Light', description: 'Cinco etapas y lo esencial para gestionar procesos y ahorros sin burocracia.', definition: LIGHT },
  { template_key: 'completa', kind: 'complete' as const, name: 'Completa · Metodología Xinergy', description: 'Ocho etapas, 29 actividades y once entregables de la metodología de sourcing de Xinergy.', definition: COMPLETE },
]

export const ROLE_LABEL: Record<TaskRole, string> = {
  category_manager: 'Category Manager',
  buyer: 'Comprador',
  manager: 'Gerencia',
  legal: 'Legal',
  committee: 'Comité',
  requester: 'Área solicitante',
  supplier_relations: 'Relación con proveedores',
}

// Valida una definición antes de guardarla. La base de datos repite las reglas esenciales.
export function validateDefinition(definition: MethodologyDefinition): string[] {
  const errors: string[] = []
  const stageKeys = new Set(definition.stages.map(stage => stage.key))
  const deliverableKeys = new Set(definition.deliverables.map(item => item.key))
  if (definition.stages.length === 0) errors.push('La metodología necesita al menos una etapa.')
  if (stageKeys.size !== definition.stages.length) errors.push('Hay etapas con la misma clave.')
  const seen = new Set<string>()
  const events = new Map<string, number>()
  definition.tasks.forEach(task => {
    if (!task.title.trim()) errors.push(`La tarea ${task.code} no tiene nombre.`)
    if (!stageKeys.has(task.stage)) errors.push(`La tarea «${task.title}» apunta a una etapa que no existe.`)
    if (seen.has(task.key)) errors.push(`La clave ${task.key} está repetida.`)
    if (!(task.duration >= 0 && task.duration <= 730)) errors.push(`La duración de «${task.title}» debe estar entre 0 y 730 días.`)
    task.depends.forEach(dep => { if (!seen.has(dep)) errors.push(`«${task.title}» depende de una tarea que no está antes en la lista.`) })
    if (task.deliverable && !deliverableKeys.has(task.deliverable)) errors.push(`«${task.title}» apunta a un entregable que no existe.`)
    if (task.event) {
      events.set(task.event, (events.get(task.event) || 0) + 1)
      if (task.optional && REQUIRED_EVENTS.includes(task.event)) errors.push(`«${task.title}» representa un evento obligatorio y no puede ser opcional.`)
    }
    seen.add(task.key)
  })
  for (const [event, count] of Array.from(events)) if (count > 1) errors.push(`El evento «${STANDARD_EVENTS[event as StandardEvent]}» está en más de una tarea.`)
  REQUIRED_EVENTS.forEach(event => { if (!events.has(event)) errors.push(`Falta una tarea para el evento «${STANDARD_EVENTS[event]}».`) })
  definition.deliverables.forEach(item => { if (!stageKeys.has(item.stage)) errors.push(`El entregable «${item.title}» apunta a una etapa que no existe.`) })
  return errors
}

// Calendario sugerido: cada tarea parte el día siguiente al término de la última dependencia.
export function scheduleTasks(definition: MethodologyDefinition, start: string) {
  const ends = new Map<string, string>()
  return definition.tasks.map(task => {
    const after = task.depends.map(dep => ends.get(dep)).filter(Boolean).sort().pop()
    const begin = after ? addDays(after, 1) : start
    const end = addDays(begin, Math.max(0, task.duration - 1))
    ends.set(task.key, end)
    return { key: task.key, start: begin, end }
  })
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
