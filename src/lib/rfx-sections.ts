export type RfxField = {
  key: string
  section: string
  label: string
  kind: 'admin' | 'technical'
}

export const RFX_FIELDS: RfxField[] = [
  { key: 'objeto', section: 'Antecedentes', label: 'Qué se está comprando', kind: 'admin' },
  { key: 'currency', section: 'Antecedentes', label: 'Moneda', kind: 'admin' },
  { key: 'presupuesto', section: 'Antecedentes', label: 'Presupuesto o línea base', kind: 'admin' },
  { key: 'delivery_timeline', section: 'Plazos', label: 'Plazo de entrega o ejecución', kind: 'admin' },
  { key: 'proposal_validity_days', section: 'Plazos', label: 'Vigencia de la oferta (días)', kind: 'admin' },
  { key: 'performance_bond_percent', section: 'Garantías', label: 'Garantía de seriedad (%)', kind: 'admin' },
  { key: 'payment_terms', section: 'Pago', label: 'Condiciones de pago', kind: 'admin' },
  { key: 'penalties_summary', section: 'Pago', label: 'Multas o penalidades', kind: 'admin' },
  { key: 'ponderacion', section: 'Evaluación', label: 'Cómo se evalúa', kind: 'admin' },
  { key: 'alcance', section: 'Alcance técnico', label: 'Alcance', kind: 'technical' },
  { key: 'requisitos', section: 'Alcance técnico', label: 'Requisitos', kind: 'technical' },
  { key: 'entregables', section: 'Alcance técnico', label: 'Entregables', kind: 'technical' },
  { key: 'exclusiones', section: 'Alcance técnico', label: 'Qué queda fuera', kind: 'technical' },
]

export function basesMarkdown(title: string, type: string, values: Record<string, string>) {
  const sections = Array.from(new Set(RFX_FIELDS.map(field => field.section)))
  const body = sections.map(section => {
    const lines = RFX_FIELDS.filter(field => field.section === section)
      .map(field => `- ${field.label}: ${values[field.key]?.trim() || 'Por completar'}`)
      .join('\n')
    return `## ${section}\n${lines}`
  }).join('\n\n')
  return `# ${type} · ${title}\n\n${body}\n`
}

export function templateStructure() {
  return RFX_FIELDS.map(field => `${field.section} · ${field.label}: {{ ${field.key} }}`).join('\n')
}

export function templatePlaceholders() {
  return RFX_FIELDS.map(field => ({
    field_key: field.key,
    label: field.label,
    type: 'text',
    default_value: '',
    editable_by: 'admin',
    group: field.section,
  }))
}
