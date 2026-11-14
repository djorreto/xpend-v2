/**
 * Taxonomía única de Xpend, con ramas por industria.
 * Una sola lista para todas las empresas. La rama "comun" aplica a cualquiera.
 * Las demás se activan según el rubro. El análisis de gasto no cambia;
 * cambia el vocabulario de lo que se compra.
 */

export type TaxonomyNode = {
  family: string
  name: string
  branch?: string
  code?: string
  synonyms: string[]
  strategy: string
}

export const BASE_TAXONOMY: TaxonomyNode[] = [
  { family: 'Tecnología', name: 'Software y licencias', branch: 'comun', synonyms: ['licencia', 'saas', 'office 365', 'erp', 'crm'], strategy: 'negociar_marco' },
  { family: 'Tecnología', name: 'Cloud y datacenter', branch: 'comun', synonyms: ['aws', 'azure', 'hosting', 'nube', 'servidor', 'datacenter', 'cloud'], strategy: 'negociar_marco' },
  { family: 'Tecnología', name: 'Soporte y mesa de ayuda', branch: 'comun', synonyms: ['helpdesk', 'mesa de ayuda', 'soporte', 'outsourcing ti'], strategy: 'licitar' },
  { family: 'Tecnología', name: 'Hardware y equipos', branch: 'comun', synonyms: ['notebook', 'computador', 'hardware', 'impresora', 'laptop', 'monitor', 'pc'], strategy: 'licitar' },
  { family: 'Tecnología', name: 'Ciberseguridad', branch: 'comun', synonyms: ['ciberseguridad', 'firewall', 'antivirus'], strategy: 'negociar_marco' },
  { family: 'Tecnología', name: 'Desarrollo y proyectos TI', branch: 'comun', synonyms: ['desarrollo de software', 'software factory', 'fabrica de software'], strategy: 'licitar' },
  { family: 'Tecnología', name: 'Impresión y multifunción', branch: 'comun', synonyms: ['impresion', 'fotocopia', 'toner'], strategy: 'consolidar' },
  { family: 'Tecnología', name: 'Telecomunicaciones', branch: 'comun', synonyms: ['internet', 'telefonia', 'enlace', 'fibra', 'celular'], strategy: 'negociar_marco' },

  { family: 'Servicios profesionales', name: 'Consultoría y asesoría', branch: 'comun', synonyms: ['consultoria', 'asesoria', 'advisory'], strategy: 'licitar' },
  { family: 'Servicios profesionales', name: 'Legal y notarial', branch: 'comun', synonyms: ['abogado', 'notaria', 'juridico', 'legal'], strategy: 'negociar_marco' },
  { family: 'Servicios profesionales', name: 'Auditoría y contabilidad', branch: 'comun', synonyms: ['auditoria', 'contabilidad', 'tributario'], strategy: 'negociar_marco' },
  { family: 'Servicios profesionales', name: 'Ingeniería y diseño', branch: 'comun', synonyms: ['ingenieria', 'arquitectura', 'topografia'], strategy: 'licitar' },
  { family: 'Servicios profesionales', name: 'Outsourcing y personal externo', branch: 'comun', synonyms: ['outsourcing', 'personal temporal', 'bpo', 'call center'], strategy: 'licitar' },

  { family: 'Marketing y comercial', name: 'Agencias y producción', branch: 'comun', synonyms: ['agencia', 'evento', 'merchandising', 'marketing'], strategy: 'licitar' },
  { family: 'Marketing y comercial', name: 'Publicidad y medios', branch: 'comun', synonyms: ['publicidad', 'campaña', 'medios digitales', 'prensa'], strategy: 'licitar' },
  { family: 'Marketing y comercial', name: 'Fidelización y atención a clientes', branch: 'comun', synonyms: ['fidelizacion', 'regalos corporativos', 'captacion'], strategy: 'consolidar' },
  { family: 'Marketing y comercial', name: 'Investigación de mercado', branch: 'comun', synonyms: ['estudio de mercado', 'encuesta'], strategy: 'licitar' },

  { family: 'Servicios generales', name: 'Aseo y limpieza', branch: 'comun', synonyms: ['aseo', 'limpieza', 'lavanderia', 'basura'], strategy: 'licitar' },
  { family: 'Servicios generales', name: 'Seguridad y vigilancia', branch: 'comun', synonyms: ['guardia', 'guardias', 'vigilancia', 'seguridad'], strategy: 'licitar' },
  { family: 'Servicios generales', name: 'Alimentación y casino', branch: 'comun', synonyms: ['casino', 'colacion', 'catering', 'almuerzo', 'alimentacion'], strategy: 'licitar' },
  { family: 'Servicios generales', name: 'Control de plagas y jardines', branch: 'comun', synonyms: ['plagas', 'jardineria', 'paisajismo', 'jardin'], strategy: 'consolidar' },
  { family: 'Servicios generales', name: 'Residuos y reciclaje', branch: 'comun', synonyms: ['residuos', 'residuo', 'reciclaje'], strategy: 'licitar' },
  { family: 'Servicios generales', name: 'Facility management', branch: 'comun', synonyms: ['facility', 'climatizacion', 'ascensor'], strategy: 'licitar' },

  { family: 'Logística y transporte', name: 'Fletes y distribución', branch: 'comun', synonyms: ['flete', 'fletes', 'despacho', 'ultima milla', 'transporte de carga'], strategy: 'licitar' },
  { family: 'Logística y transporte', name: 'Almacenamiento y bodegaje', branch: 'comun', synonyms: ['bodega', 'warehouse', 'almacenaje'], strategy: 'negociar_marco' },
  { family: 'Logística y transporte', name: 'Transporte de personas', branch: 'comun', synonyms: ['taxi', 'buses', 'traslado'], strategy: 'licitar' },
  { family: 'Logística y transporte', name: 'Courier y correspondencia', branch: 'comun', synonyms: ['courier', 'correo', 'encomienda'], strategy: 'consolidar' },
  { family: 'Logística y transporte', name: 'Comercio exterior y aduanas', branch: 'comun', synonyms: ['aduana', 'importacion'], strategy: 'negociar_marco' },

  { family: 'Flota y vehículos', name: 'Mantención de flota', branch: 'comun', synonyms: ['mantencion vehiculo', 'automotriz', 'flota', 'neumatico'], strategy: 'licitar' },
  { family: 'Flota y vehículos', name: 'Arriendo de vehículos', branch: 'comun', synonyms: ['arriendo vehiculo', 'rent a car'], strategy: 'negociar_marco' },
  { family: 'Flota y vehículos', name: 'Peajes, estacionamiento y GPS', branch: 'comun', synonyms: ['peaje', 'tag', 'estacionamiento'], strategy: 'consolidar' },

  { family: 'Energía y servicios básicos', name: 'Electricidad', branch: 'comun', synonyms: ['electricidad', 'luz'], strategy: 'monitorear' },
  { family: 'Energía y servicios básicos', name: 'Combustibles y gas', branch: 'comun', synonyms: ['combustible', 'diesel', 'bencina', 'gasolina', 'petroleo', 'gas'], strategy: 'monitorear' },
  { family: 'Energía y servicios básicos', name: 'Agua y alcantarillado', branch: 'comun', synonyms: ['agua potable', 'alcantarillado'], strategy: 'monitorear' },
  { family: 'Energía y servicios básicos', name: 'Servicios básicos varios', branch: 'comun', synonyms: ['servicios basicos', 'utilities'], strategy: 'monitorear' },

  { family: 'Infraestructura y mantención', name: 'Obras y construcción', branch: 'comun', synonyms: ['obra', 'remodelacion', 'capex'], strategy: 'licitar' },
  { family: 'Infraestructura y mantención', name: 'Mantención de instalaciones', branch: 'comun', synonyms: ['mantencion', 'gasfiter', 'reparacion'], strategy: 'licitar' },
  { family: 'Infraestructura y mantención', name: 'Arriendo de inmuebles', branch: 'comun', synonyms: ['arriendo', 'gastos comunes', 'ggcc'], strategy: 'negociar_marco' },
  { family: 'Infraestructura y mantención', name: 'Mobiliario y equipamiento de oficina', branch: 'comun', synonyms: ['silla', 'escritorio', 'mueble'], strategy: 'licitar' },

  { family: 'Suministros de oficina', name: 'Papelería y útiles', branch: 'comun', synonyms: ['papeleria', 'utiles', 'resma', 'fotocopia', 'toner'], strategy: 'consolidar' },
  { family: 'Suministros operacionales', name: 'Ferretería y materiales', branch: 'comun', synonyms: ['ferreteria', 'herramienta'], strategy: 'consolidar' },
  { family: 'Suministros operacionales', name: 'Repuestos', branch: 'comun', synonyms: ['repuesto'], strategy: 'consolidar' },
  { family: 'Suministros operacionales', name: 'EPP y uniformes', branch: 'comun', synonyms: ['epp', 'uniforme', 'uniformes', 'guantes de seguridad', 'guantes', 'casco'], strategy: 'consolidar' },
  { family: 'Suministros operacionales', name: 'Artículos de aseo', branch: 'comun', synonyms: ['insumos aseo', 'higiene'], strategy: 'consolidar' },
  { family: 'Suministros operacionales', name: 'Embalaje y pallets', branch: 'comun', synonyms: ['embalaje', 'pallet'], strategy: 'consolidar' },

  { family: 'Equipos y maquinaria', name: 'Compra de equipos', branch: 'comun', synonyms: ['maquinaria', 'equipo', 'generador'], strategy: 'licitar' },
  { family: 'Equipos y maquinaria', name: 'Arriendo de maquinaria', branch: 'comun', synonyms: ['arriendo maquinaria'], strategy: 'licitar' },
  { family: 'Equipos y maquinaria', name: 'Mantención de maquinaria y equipos', branch: 'comun', synonyms: ['mantencion maquinaria'], strategy: 'licitar' },

  { family: 'Viajes y estadía', name: 'Pasajes y hoteles', branch: 'comun', synonyms: ['pasaje', 'pasaje aereo', 'hotel', 'viaje', 'viatico', 'alojamiento'], strategy: 'negociar_marco' },
  { family: 'Personas y bienestar', name: 'Capacitación', branch: 'comun', synonyms: ['curso', 'capacitacion', 'certificacion'], strategy: 'consolidar' },
  { family: 'Personas y bienestar', name: 'Reclutamiento y RRHH', branch: 'comun', synonyms: ['seleccion', 'reclutamiento', 'rrhh'], strategy: 'licitar' },
  { family: 'Personas y bienestar', name: 'Beneficios y bienestar', branch: 'comun', synonyms: ['sala cuna', 'convenio de salud', 'beneficio'], strategy: 'negociar_marco' },

  { family: 'Seguros y finanzas', name: 'Seguros', branch: 'comun', synonyms: ['seguro', 'poliza'], strategy: 'licitar' },
  { family: 'Seguros y finanzas', name: 'Comisiones y gastos bancarios', branch: 'comun', synonyms: ['comision', 'gastos bancarios'], strategy: 'negociar_marco' },
  { family: 'Seguros y finanzas', name: 'Impuestos y patentes', branch: 'comun', synonyms: ['impuesto', 'patente', 'multa'], strategy: 'monitorear' },
  { family: 'Seguros y finanzas', name: 'Membresías y suscripciones', branch: 'comun', synonyms: ['membresia', 'suscripcion', 'gremio'], strategy: 'consolidar' },

  { family: 'Insumos clínicos', name: 'Material médico quirúrgico', branch: 'salud', synonyms: ['material quirurgico', 'sutura', 'curacion', 'mascarilla', 'insumo medico'], strategy: 'negociar_marco' },
  { family: 'Insumos clínicos', name: 'Medicamentos', branch: 'salud', synonyms: ['medicamento', 'farmaco', 'vacuna'], strategy: 'negociar_marco' },
  { family: 'Insumos clínicos', name: 'Traumatología, prótesis e implantes', branch: 'salud', synonyms: ['protesis', 'traumatologia', 'implante'], strategy: 'licitar' },
  { family: 'Insumos clínicos', name: 'Laboratorio y banco de sangre', branch: 'salud', synonyms: ['laboratorio', 'banco de sangre', 'reactivo'], strategy: 'negociar_marco' },
  { family: 'Insumos clínicos', name: 'Instrumental y equipamiento médico', branch: 'salud', synonyms: ['equipo medico', 'instrumental'], strategy: 'licitar' },
  { family: 'Insumos clínicos', name: 'Servicios clínicos externos', branch: 'salud', synonyms: ['honorarios medicos', 'ambulancia'], strategy: 'licitar' },

  { family: 'Agro y producción animal', name: 'Alimentación y nutrición animal', branch: 'agro', synonyms: ['forraje', 'alimento ganado'], strategy: 'negociar_marco' },
  { family: 'Agro y producción animal', name: 'Veterinaria y sanidad animal', branch: 'agro', synonyms: ['veterinaria', 'inseminacion'], strategy: 'negociar_marco' },
  { family: 'Agro y producción animal', name: 'Insumos agrícolas', branch: 'agro', synonyms: ['fertilizante', 'semilla', 'agroquimico'], strategy: 'negociar_marco' },
  { family: 'Agro y producción animal', name: 'Servicios agrícolas y labores', branch: 'agro', synonyms: ['cosecha', 'labores mecanizadas'], strategy: 'licitar' },
  { family: 'Agro y producción animal', name: 'Equipos de ordeña y riego', branch: 'agro', synonyms: ['ordena', 'riego'], strategy: 'licitar' },
  { family: 'Agro y producción animal', name: 'Maquinaria agrícola', branch: 'agro', synonyms: ['tractor'], strategy: 'licitar' },

  { family: 'Minería y procesos', name: 'Explosivos y tronadura', branch: 'mineria', synonyms: ['explosivo', 'tronadura'], strategy: 'negociar_marco' },
  { family: 'Minería y procesos', name: 'Perforación y sondaje', branch: 'mineria', synonyms: ['perforacion', 'sondaje'], strategy: 'licitar' },
  { family: 'Minería y procesos', name: 'Equipo pesado y neumáticos', branch: 'mineria', synonyms: ['equipo pesado', 'caex'], strategy: 'negociar_marco' },
  { family: 'Minería y procesos', name: 'Reactivos y molienda', branch: 'mineria', synonyms: ['molienda', 'reactivo'], strategy: 'negociar_marco' },

  { family: 'Construcción y obra', name: 'Materiales de construcción', branch: 'construccion', synonyms: ['cemento', 'hormigon', 'acero', 'fierro', 'ladrillo'], strategy: 'negociar_marco' },
  { family: 'Construcción y obra', name: 'Subcontratos de obra', branch: 'construccion', synonyms: ['subcontrato', 'mano de obra'], strategy: 'licitar' },
  { family: 'Construcción y obra', name: 'Estudios y permisos de obra', branch: 'construccion', synonyms: ['estudio de suelos', 'permiso'], strategy: 'licitar' },

  { family: 'Retail y tiendas', name: 'Operación de tiendas', branch: 'retail', synonyms: ['tienda', 'punto de venta', 'vitrina'], strategy: 'licitar' },

  { family: 'Banca y medios de pago', name: 'Procesamiento y redes', branch: 'financiera', synonyms: ['adquirencia', 'visa', 'transbank'], strategy: 'negociar_marco' },
  { family: 'Banca y medios de pago', name: 'Tarjetas y plásticos', branch: 'financiera', synonyms: ['plastico', 'emision de tarjetas'], strategy: 'negociar_marco' },
  { family: 'Banca y medios de pago', name: 'Cobranza y recaudación', branch: 'financiera', synonyms: ['cobranza', 'recaudacion'], strategy: 'licitar' },
  { family: 'Banca y medios de pago', name: 'Valijas y transporte de valores', branch: 'financiera', synonyms: ['transporte de valores', 'valija'], strategy: 'negociar_marco' },
  { family: 'Banca y medios de pago', name: 'Asistencias y servicios al asegurado', branch: 'financiera', synonyms: ['asistencia vial', 'siniestro'], strategy: 'licitar' },
]

export type StoredRule = {
  id?: string
  rule_type: string
  pattern: string
  category: string
  subcategory?: string | null
  source?: string | null
  success_rate?: number | null
}

export function taxonomyFromRules(rules: StoredRule[]): TaxonomyNode[] {
  const extras = rules
    .filter(rule => rule.rule_type === 'taxonomy' && rule.source !== 'xpend_base')
    .map(rule => ({
      family: rule.category,
      name: rule.subcategory || rule.pattern,
      code: rule.pattern && rule.pattern !== (rule.subcategory || '') ? rule.pattern : undefined,
      synonyms: [] as string[],
      strategy: 'licitar',
    }))

  const synonyms = rules.filter(rule => rule.rule_type === 'synonym')
  const nodes = [...BASE_TAXONOMY.map(node => ({ ...node, synonyms: [...node.synonyms] })), ...extras]
  for (const synonym of synonyms) {
    const node = nodes.find(item =>
      item.family === synonym.category &&
      item.name === (synonym.subcategory || item.name)
    )
    if (node && synonym.pattern) node.synonyms.push(synonym.pattern)
  }
  return nodes
}

const GENERIC_TERMS = new Set([
  'arriendo', 'seguro', 'mantencion', 'soporte', 'maquinaria', 'reparacion',
  'acero', 'riego', 'obra', 'equipo', 'seguridad', 'guardias', 'vigilancia', 'gas',
])

/** Señales concretas. No pisan al modelo cuando la glosa es larga. */
export function findPreciseHit(description: string, nodes: TaxonomyNode[]) {
  const text = description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const tokens = text.match(/[a-z0-9]{2,}/g) || []
  if (tokens.length > 4) return null
  const signals = nodes.flatMap(node => node.synonyms.map(synonym => ({ synonym, node })))
    .map(item => ({
      ...item,
      folded: item.synonym.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(),
    }))
    .filter(item => item.folded.length >= 5 && !GENERIC_TERMS.has(item.folded))
    .sort((a, b) => b.folded.length - a.folded.length)
  return signals.find(item => {
    const needle = item.folded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${needle}([^a-z0-9]|$)`).test(text)
  }) || null
}

export function findTaxonomyHit(description: string, nodes: TaxonomyNode[]) {
  const text = description
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const signals = nodes.flatMap(node => node.synonyms.map(synonym => ({ synonym, node })))
    .filter(item => item.synonym.trim().length >= 3)
    .sort((a, b) => b.synonym.length - a.synonym.length)
  return signals.find(item => {
    const needle = item.synonym
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${needle}([^a-z0-9]|$)`).test(text)
  }) || null
}
export function taxonomyPrompt(nodes: TaxonomyNode[]) {
  return nodes
    .map(node => `- ${node.family} > ${node.name}${node.branch && node.branch !== 'comun' ? ` (${node.branch})` : ''}${node.code ? ` [${node.code}]` : ''}${node.synonyms.length ? ` | señales: ${node.synonyms.slice(0, 6).join(', ')}` : ''} | estrategia: ${node.strategy}`)
    .join('\n')
}

export function knownFamily(nodes: TaxonomyNode[], category: string) {
  const target = category.trim().toLowerCase()
  return nodes.some(node => node.family.toLowerCase() === target)
}

export function taxonomyForIndustry(nodes: TaxonomyNode[], industry?: string | null) {
  const map: Record<string, string[]> = {
    salud: ['comun', 'salud'],
    clinica: ['comun', 'salud'],
    hospital: ['comun', 'salud'],
    agro: ['comun', 'agro'],
    agroindustria: ['comun', 'agro'],
    alimentos: ['comun', 'agro'],
    mineria: ['comun', 'mineria'],
    construccion: ['comun', 'construccion'],
    retail: ['comun', 'retail'],
    banca: ['comun', 'financiera'],
    financiero: ['comun', 'financiera'],
  }
  const key = (industry || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const hit = Object.keys(map).find(token => key.includes(token))
  const allowed = hit ? map[hit] : null
  if (!allowed) return nodes
  return nodes.filter(node => !node.branch || allowed.includes(node.branch))
}
