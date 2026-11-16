// Definición del escenario de «XPEND Company S.A. (DEMO)»: todo es ficticio y verosímil (empresa mediana chilena con operación de compras profesional).
// Los montos del gasto histórico salen de una función determinista (misma demostración, mismos números) con estacionalidad,
// concentración de proveedores y tendencia; no son aleatorios sin lógica. Las categorías usan familias de la taxonomía real de XPEND.

export const PEOPLE = {
  admin: { name: 'Andrea Contreras', role: 'admin', title: 'Administradora', mail: 'andrea.contreras' },
  manager: { name: 'Gonzalo Pérez', role: 'manager', title: 'Gerente de Abastecimiento', mail: 'gonzalo.perez' },
  committee: { name: 'Carolina Vidal', role: 'manager', title: 'Gerente de Finanzas (comité)', mail: 'carolina.vidal' },
  buyer1: { name: 'Valentina Rojas', role: 'analyst', title: 'Category Manager · Mantenimiento y Equipos', mail: 'valentina.rojas' },
  buyer2: { name: 'Matías Soto', role: 'analyst', title: 'Category Manager · Logística y Materiales', mail: 'matias.soto' },
  buyer3: { name: 'Camila Fuentes', role: 'analyst', title: 'Category Manager · Tecnología', mail: 'camila.fuentes' },
  buyer4: { name: 'Diego Navarro', role: 'analyst', title: 'Category Manager · Servicios Generales', mail: 'diego.navarro' },
  viewer: { name: 'Laura Mendoza', role: 'viewer', title: 'Auditoría (solo lectura)', mail: 'laura.mendoza' },
}

// Proveedores con portal (presentan ofertas en las licitaciones por la interfaz).
export const PORTAL_SUPPLIERS = [
  { key: 'norte', id: 'xc-sup-norte', fantasy: 'Servicios Industriales Norte', legal: 'Servicios Industriales Norte SpA', rut: '76.410.220-1', type: 'Mantenimiento industrial' },
  { key: 'mantenpro', id: 'xc-sup-mantenpro', fantasy: 'MantenPro Chile', legal: 'MantenPro Chile Ltda.', rut: '77.512.330-4', type: 'Mantenimiento industrial' },
  { key: 'tecnomant', id: 'xc-sup-tecnomant', fantasy: 'TecnoMant Andes', legal: 'TecnoMant Andes S.A.', rut: '76.998.101-7', type: 'Mantenimiento industrial' },
  { key: 'nubesur', id: 'xc-sup-nubesur', fantasy: 'NubeSur Software', legal: 'NubeSur Software SpA', rut: '77.101.882-3', type: 'Tecnología y software' },
  { key: 'datacore', id: 'xc-sup-datacore', fantasy: 'DataCore Chile', legal: 'DataCore Chile S.A.', rut: '76.330.455-2', type: 'Tecnología y software' },
  { key: 'soporteti', id: 'xc-sup-soporteti', fantasy: 'Soporte TI Chile', legal: 'Soporte TI Chile Ltda.', rut: '77.880.120-9', type: 'Tecnología y software' },
  { key: 'telcoandes', id: 'xc-sup-telcoandes', fantasy: 'Telco Andes', legal: 'Telco Andes S.A.', rut: '96.540.100-3', type: 'Telecomunicaciones' },
  { key: 'fibrasur', id: 'xc-sup-fibrasur', fantasy: 'Fibra Sur', legal: 'Fibra Sur SpA', rut: '76.712.909-5', type: 'Telecomunicaciones' },
]

const SEASON = {
  industrial: [0.9, 0.85, 1.25, 0.95, 0.9, 1.0, 0.95, 0.9, 1.3, 1.0, 0.95, 0.85],
  logistica: [0.85, 0.8, 0.9, 0.95, 1.0, 1.0, 1.0, 1.0, 1.05, 1.1, 1.25, 1.4],
  flat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  tecnologia: [1.3, 0.8, 0.8, 1.0, 0.8, 0.8, 1.2, 0.8, 0.8, 1.0, 0.8, 1.1],
}

// annual2025: monto anual de 2025 en la moneda del flujo; growth: variación de 2026 sobre 2025.
export const CATEGORIES = [
  {
    key: 'mant', name: 'Mantenimiento y Servicios Industriales', ref: 'Equipos y maquinaria', owner: 'buyer1', backup: 'buyer2', team: 'ops', season: 'industrial',
    streams: [
      { sub: 'Mantención de maquinaria y equipos', currency: 'CLP', annual2025: 980_000_000, growth: 0.07, suppliers: [['Servicios Industriales Norte', 0.38], ['MantenPro Chile', 0.27], ['TecnoMant Andes', 0.2], ['Taller Central', 0.15]] },
      { sub: 'Repuestos', currency: 'USD', annual2025: 520_000, growth: 0.04, suppliers: [['Repuestos Pacific', 0.5], ['MantenPro Chile', 0.3], ['ImportParts LLC', 0.2]] },
    ],
  },
  {
    key: 'tec', name: 'Tecnología y Telecomunicaciones', ref: 'Tecnología', owner: 'buyer3', backup: 'buyer4', team: 'corp', season: 'tecnologia',
    streams: [
      { sub: 'Software y licencias', currency: 'USD', annual2025: 410_000, growth: 0.09, suppliers: [['NubeSur Software', 0.45], ['DataCore Chile', 0.35], ['Office Andes', 0.2]] },
      { sub: 'Soporte y mesa de ayuda', currency: 'CLP', annual2025: 190_000_000, growth: 0.05, suppliers: [['Soporte TI Chile', 0.6], ['DataCore Chile', 0.4]] },
      { sub: 'Telecomunicaciones', currency: 'CLP', annual2025: 96_000_000, growth: 0.03, suppliers: [['Telco Andes', 0.55], ['Fibra Sur', 0.3], ['Conecta Móvil', 0.15]] },
    ],
  },
  {
    key: 'log', name: 'Logística y Transporte', ref: 'Logística y transporte', owner: 'buyer2', backup: 'buyer1', team: 'ops', season: 'logistica',
    streams: [
      { sub: 'Fletes y distribución', currency: 'CLP', annual2025: 640_000_000, growth: 0.08, suppliers: [['TransAndes Logística', 0.4], ['Cargas del Sur', 0.3], ['Fletes Rápidos', 0.2], ['Transportes Maipo', 0.1]] },
      { sub: 'Almacenamiento y bodegaje', currency: 'CLP', annual2025: 210_000_000, growth: 0.04, suppliers: [['BodegaSur', 0.6], ['Almacenes Unidos', 0.4]] },
      { sub: 'Courier y correspondencia', currency: 'CLP', annual2025: 38_000_000, growth: 0.02, suppliers: [['Courier Express', 0.7], ['Correos Corporativos', 0.3]] },
    ],
  },
  {
    key: 'mat', name: 'Materiales y Suministros', ref: 'Suministros operacionales', owner: 'buyer2', backup: 'buyer3', team: 'ops', season: 'flat',
    streams: [
      { sub: 'EPP y uniformes', currency: 'CLP', annual2025: 160_000_000, growth: 0.06, suppliers: [['EPP Chile', 0.5], ['Seguridad Total', 0.3], ['Uniformes Norte', 0.2]] },
      { sub: 'Embalaje y pallets', currency: 'CLP', annual2025: 92_000_000, growth: 0.03, suppliers: [['PalletPro', 0.6], ['Embalajes del Pacífico', 0.4]] },
      { sub: 'Ferretería y materiales', currency: 'CLP', annual2025: 175_000_000, growth: 0.1, suppliers: [['Ferretería Industrial', 0.55], ['Aceros Cordillera', 0.3], ['Tornillos y Más', 0.15]] },
    ],
  },
  {
    key: 'svc', name: 'Servicios Generales', ref: 'Servicios generales', owner: 'buyer4', backup: 'buyer3', team: 'corp', season: 'flat',
    streams: [
      { sub: 'Aseo y limpieza', currency: 'CLP', annual2025: 120_000_000, growth: 0.02, suppliers: [['Limpieza Total', 0.7], ['Aseo Pro', 0.3]] },
      { sub: 'Alimentación y casino', currency: 'CLP', annual2025: 150_000_000, growth: 0.05, suppliers: [['Casino Andino', 0.7], ['Catering Sur', 0.3]] },
      { sub: 'Seguridad y vigilancia', currency: 'CLP', annual2025: 130_000_000, growth: 0.06, suppliers: [['Seguridad Cordillera', 0.6], ['Vigilancia Norte', 0.4]] },
    ],
  },
  {
    key: 'eq', name: 'Equipos e Infraestructura', ref: 'Infraestructura y mantención', owner: 'buyer1', backup: 'buyer4', team: 'ops', season: 'industrial',
    streams: [
      { sub: 'Compra de equipos', currency: 'USD', annual2025: 380_000, growth: 0.12, suppliers: [['Maquinarias Global', 0.5], ['EquipChile', 0.5]] },
      { sub: 'Mantención de instalaciones', currency: 'CLP', annual2025: 140_000_000, growth: 0.04, suppliers: [['Instalaciones Andes', 0.6], ['Obras Menores SpA', 0.4]] },
    ],
  },
]

export const TEAMS = [
  { key: 'ops', name: 'Equipo Operaciones', description: 'Compras de mantenimiento, logística, materiales y equipos', lead: 'buyer1', members: ['buyer1', 'buyer2'] },
  { key: 'corp', name: 'Equipo Corporativo', description: 'Compras de tecnología y servicios generales', lead: 'buyer3', members: ['buyer3', 'buyer4'] },
]

// Fechas como días respecto de hoy: [inicio, preparación RFx, invitación, recepción, evaluación, comité, formalización].
export const INITIATIVES = [
  // --- 2026 -------------------------------------------------------------------------------------------------
  { key: 'mant', title: 'Mantención preventiva de planta', cat: 'mant', quarter: 'Q4', spend: 200_000, currency: 'USD', pct: 10, owner: 'buyer1', backup: 'buyer2', team: 'ops', status: 'in_progress', dates: [0, 2, 5, 12, 19, 26, 40], actual: 1, flow: 'A' },
  { key: 'mantcorr', title: 'Mantención correctiva y repuestos críticos', cat: 'mant', quarter: 'Q4', spend: 420_000_000, currency: 'CLP', pct: 7, owner: 'buyer1', backup: 'buyer2', team: 'ops', status: 'in_progress', dates: [-60, -48, -35, -22, 4, 15, 32], actual: 4,
    lic: { id: 'DEMO-XC-MANT-002', status: 'evaluation', baseline: 420_000_000, currency: 'CLP' } },
  { key: 'mantelec', title: 'Servicios eléctricos industriales', cat: 'mant', quarter: 'Q1', spend: 180_000_000, currency: 'CLP', pct: 8, owner: 'buyer1', backup: 'buyer2', team: 'ops', status: 'completed', dates: [-330, -318, -305, -290, -275, -260, -240], actual: 7,
    lic: { id: 'DEMO-XC-ELEC-001', status: 'planned', baseline: 180_000_000, currency: 'CLP', awarded: 166_000_000 }, contract: { code: 'CTR-XC-ELEC-001', name: 'Servicios eléctricos industriales', counterparty: 'Eléctrica Cordillera SpA', supplierName: 'Eléctrica Cordillera', amount: 166_000_000, currency: 'CLP', startsOffset: -235, months: 24 }, savings: 'elec' },
  { key: 'tec', title: 'Desarrollo y soporte de aplicaciones corporativas', cat: 'tec', quarter: 'Q4', spend: 300_000, currency: 'USD', pct: 9, owner: 'buyer3', backup: 'buyer4', team: 'corp', status: 'in_progress', dates: [0, 2, 5, 12, 19, 26, 40], actual: 1, flow: 'B' },
  { key: 'telecom', title: 'Renovación de enlaces y telefonía corporativa', cat: 'tec', quarter: 'Q4', spend: 96_000_000, currency: 'CLP', pct: 10, owner: 'buyer3', backup: 'buyer4', team: 'corp', status: 'in_progress', dates: [0, 2, 5, 12, 19, 26, 40], actual: 1, flow: 'T' },
  { key: 'licencias', title: 'Renovación de licencias de software', cat: 'tec', quarter: 'Q4', spend: 410_000, currency: 'USD', pct: 9, owner: 'buyer3', backup: 'buyer4', team: 'corp', status: 'in_progress', dates: [-25, 3, 10, 18, 25, 32, 50], actual: 1,
    block: { index: 1, cause: 'aprobador', note: 'Espera la aprobación del presupuesto de TI' }, lic: { id: 'DEMO-XC-LIC-001', status: 'bases_review', baseline: 410_000, currency: 'USD' } },
  { key: 'transporte', title: 'Licitación de transporte de carga nacional', cat: 'log', quarter: 'Q3', spend: 640_000_000, currency: 'CLP', pct: 8, owner: 'buyer2', backup: 'buyer1', team: 'ops', status: 'in_progress', dates: [-70, -50, -20, 6, 14, 24, 45], actual: 2,
    reschedule: { index: 2, from: -35, cause: 'aprobador', reason: 'El comité postergó la aprobación del presupuesto de transporte' }, lic: { id: 'DEMO-XC-LOG-001', status: 'bases_review', baseline: 640_000_000, currency: 'CLP' } },
  { key: 'bodegaje', title: 'Bodegaje y distribución secundaria', cat: 'log', quarter: 'Q4', spend: 210_000_000, currency: 'CLP', pct: 8, owner: 'buyer2', backup: 'buyer1', team: 'ops', status: 'in_progress', dates: [-40, -32, -25, -12, 6, 18, 40], actual: 4,
    lic: { id: 'DEMO-XC-BOD-001', status: 'evaluation', baseline: 210_000_000, currency: 'CLP' } },
  { key: 'courier', title: 'Courier y correspondencia', cat: 'log', quarter: 'Q1', spend: 38_000_000, currency: 'CLP', pct: 6, owner: 'buyer2', backup: 'buyer1', team: 'ops', status: 'completed', dates: [-300, -290, -280, -270, -255, -245, -230], actual: 7,
    lic: { id: 'DEMO-XC-COUR-001', status: 'planned', awarded: 35_700_000, currency: 'CLP', noBaseline: true }, contract: { code: 'CTR-XC-COUR-001', name: 'Courier y correspondencia', counterparty: 'Courier Express SpA', supplierName: 'Courier Express', amount: 35_700_000, currency: 'CLP', startsOffset: -228, months: 24 } },
  { key: 'ferreteria', title: 'Acuerdo marco de ferretería y materiales', cat: 'mat', quarter: 'Q1', spend: 175_000_000, currency: 'CLP', pct: 8, owner: 'buyer2', backup: 'buyer3', team: 'ops', status: 'planned', dates: [20, 30, 40, 55, 70, 85, 110], actual: 0, fromSpend: true },
  { key: 'epp', title: 'Acuerdo marco de EPP y uniformes', cat: 'mat', quarter: 'Q4', spend: 160_000_000, currency: 'CLP', pct: 6, owner: 'buyer2', backup: 'buyer3', team: 'ops', status: 'in_progress', dates: [-20, 5, 15, 28, 40, 52, 70], actual: 1 },
  { key: 'embalaje', title: 'Embalaje y pallets', cat: 'mat', quarter: 'Q2', spend: 92_000_000, currency: 'CLP', pct: 7, owner: 'buyer2', backup: 'buyer3', team: 'ops', status: 'planned', dates: null },
  { key: 'aseo', title: 'Contrato de aseo y casinos', cat: 'svc', quarter: 'Q1', spend: 120_000_000, currency: 'CLP', pct: 10, owner: 'buyer4', backup: 'buyer3', team: 'corp', status: 'completed', dates: [-330, -315, -300, -285, -270, -260, -250], actual: 7,
    lic: { id: 'DEMO-XC-ASEO-001', status: 'planned', baseline: 120_000_000, currency: 'CLP', awarded: 108_000_000 }, contract: { code: 'CTR-XC-ASEO-001', name: 'Servicio de aseo y casinos', counterparty: 'Limpieza Total Ltda.', supplierName: 'Limpieza Total', amount: 108_000_000, currency: 'CLP', startsOffset: -320, months: 12 }, savings: 'aseo' },
  { key: 'seguridad', title: 'Seguridad y vigilancia', cat: 'svc', quarter: 'Q3', spend: 130_000_000, currency: 'CLP', pct: 6, owner: 'buyer4', backup: 'buyer3', team: 'corp', status: 'in_progress', dates: [-60, -45, -30, -15, -5, 10, 30], actual: 3,
    block: { index: 3, cause: 'proveedor', note: 'El proveedor pidió extender el plazo de entrega de su oferta' }, lic: { id: 'DEMO-XC-SEG-001', status: 'published', baseline: 130_000_000, currency: 'CLP' } },
  { key: 'eqcompra', title: 'Compra de equipos de bodega y planta', cat: 'eq', quarter: 'Q4', spend: 380_000, currency: 'USD', pct: 8, owner: 'buyer1', backup: 'buyer4', team: 'ops', status: 'in_progress', dates: [-50, -38, -28, -18, -8, 4, 20], actual: 5,
    lic: { id: 'DEMO-XC-EQ-001', status: 'evaluation', baseline: 380_000, currency: 'USD' } },
  // --- 2027 (preliminar) --------------------------------------------------------------------------------------
  { key: 'mant27', title: 'Renegociación de mantención 2027', cat: 'mant', quarter: 'Q1', year: 2027, spend: 1_050_000_000, currency: 'CLP', pct: 8, owner: 'buyer1', backup: 'buyer2', team: 'ops', status: 'planned', dates: null },
  { key: 'ciber27', title: 'Servicios de ciberseguridad 2027', cat: 'tec', quarter: 'Q2', year: 2027, spend: 150_000, currency: 'USD', pct: 9, owner: 'buyer3', backup: 'buyer4', team: 'corp', status: 'planned', dates: null },
  { key: 'obras27', title: 'Obras menores y mantención de instalaciones 2027', cat: 'eq', quarter: 'Q2', year: 2027, spend: 145_000_000, currency: 'CLP', pct: 7, owner: 'buyer4', backup: 'buyer1', team: 'ops', status: 'planned', dates: null },
]

// Casos de punta a punta por la interfaz (los mismos pasos que haría una persona).
export const FLOWS = {
  A: {
    plan: 'mant', licitacion: 'DEMO-XC-MANT-001', currency: 'USD', baseline: 200_000, committeeKey: 'committee', responsible: 'buyer1', savings: 'validate', recognize: 20_000,
    suppliers: [
      { key: 'norte', name: 'Servicios Industriales Norte', amount: 150_000, nda: true, text: 'Ejecución con equipo propio y cobertura en toda la planta.' },
      { key: 'mantenpro', name: 'MantenPro Chile', amount: 130_000, nda: true, text: 'Ejecución con subcontrato parcial de especialidades.' },
      { key: 'tecnomant', name: 'TecnoMant Andes', amount: 90_000, nda: false, text: 'Oferta sin NDA aceptado.' },
    ],
    scores: { norte: ['90', 'Equipo propio y cobertura completa.'], mantenpro: ['76', 'Cumple, con parte del trabajo subcontratada.'] },
    recommend: 'Servicios Industriales Norte', contract: { code: 'CTR-XC-MANT-001', startOffset: 14, notice: '60' },
    scope: 'Mantención preventiva y correctiva mensual de los equipos críticos de planta.',
    requirements: 'Técnicos certificados, repuestos originales y reporte mensual de disponibilidad.',
  },
  B: {
    plan: 'tec', licitacion: 'DEMO-XC-TEC-001', currency: 'USD', baseline: 300_000, committeeKey: 'committee', responsible: 'buyer3', savings: 'none', stopAfter: 'recomendación',
    suppliers: [
      { key: 'nubesur', name: 'NubeSur Software', amount: 262_000, nda: true, text: 'Equipo de desarrollo dedicado, soporte 24x7 y arquitectura en la nube.' },
      { key: 'datacore', name: 'DataCore Chile', amount: 248_000, nda: true, text: 'Fábrica de software con soporte en horario hábil y metodología ágil.' },
      { key: 'soporteti', name: 'Soporte TI Chile', amount: 281_000, nda: true, text: 'Soporte de aplicaciones con mesa de ayuda propia y desarrollo bajo demanda.' },
    ],
    scores: { nubesur: ['88', 'Mejor cobertura y arquitectura, precio intermedio.'], datacore: ['80', 'Precio más bajo, soporte solo en horario hábil.'], soporteti: ['72', 'Mesa de ayuda sólida, menos capacidad de desarrollo.'] },
    recommend: 'NubeSur Software',
    scope: 'Desarrollo evolutivo y soporte de las aplicaciones corporativas durante 24 meses.',
    requirements: 'Equipo dedicado, acuerdos de nivel de servicio y transferencia de conocimiento.',
  },
  T: {
    plan: 'telecom', licitacion: 'DEMO-XC-TELCO-001', currency: 'CLP', baseline: 96_000_000, committeeKey: 'committee', responsible: 'buyer3', savings: 'declare', recognize: 0,
    suppliers: [
      { key: 'telcoandes', name: 'Telco Andes', amount: 81_600_000, nda: true, text: 'Enlaces dedicados con respaldo y telefonía IP incluida.' },
      { key: 'fibrasur', name: 'Fibra Sur', amount: 88_200_000, nda: true, text: 'Fibra simétrica con cobertura en las tres sedes.' },
    ],
    scores: { telcoandes: ['86', 'Cobertura completa y respaldo incluido.'], fibrasur: ['78', 'Buena fibra, sin respaldo móvil.'] },
    recommend: 'Telco Andes', contract: { code: 'CTR-XC-TELCO-001', startOffset: 20, notice: '90' },
    scope: 'Enlaces de datos y telefonía corporativa para las tres sedes durante 24 meses.',
    requirements: 'Disponibilidad mensual mínima de 99,5% y soporte en español.',
  },
}

// Devuelve las líneas de gasto 2025 y 2026 (enero a octubre) de una categoría, con estacionalidad, concentración y tendencia.
export function spendLines(category, rand, currentYear, nowMonth) {
  const season = SEASON[category.season]
  const lines = []
  for (const stream of category.streams) {
    for (const year of [currentYear - 1, currentYear]) {
      const growth = year === currentYear ? 1 + stream.growth : 1
      const months = year === currentYear - 1 ? 12 : nowMonth
      for (let month = 1; month <= months; month += 1) {
        for (const [supplier, share] of stream.suppliers) {
          const noise = 0.92 + rand() * 0.16
          const raw = (stream.annual2025 / 12) * season[month - 1] * growth * share * noise
          const amount = stream.currency === 'USD' ? Math.round(raw / 10) * 10 : Math.round(raw / 1000) * 1000
          lines.push({ category: category.name, subcategory: stream.sub, supplier, currency: stream.currency, amount, year, month, day: 4 + Math.floor(rand() * 22) })
        }
      }
    }
  }
  return lines
}

// ---- Escenario Facility Management (scripts/demo/facility.mjs + demo:flow F) ---------------------------------------------
const doc = (deliverable, by, file, title, body, extra = {}) => ({ deliverable, by, file, title, body, ...extra })

export const FACILITY = {
  category: { name: 'Facility Management', subs: [{ key: 'aseo', name: 'Aseo e higiene' }, { key: 'asc', name: 'Ascensores' }, { key: 'clima', name: 'Climatización' }, { key: 'seg', name: 'Seguridad y vigilancia' }] },
  suppliers: [
    { key: 'limpiezatotal', id: 'xc-dir-limpieza-total', fantasy: 'Limpieza Total', legal: 'Limpieza Total SpA', rut: '76.211.430-K', portal: true },
    { key: 'higiene', id: 'xc-sup-higiene', fantasy: 'Higiene Integral Chile', legal: 'Higiene Integral Chile SpA', rut: '76.845.120-3', portal: true },
    { key: 'brillo', id: 'xc-sup-brillo', fantasy: 'Brillo Servicios', legal: 'Brillo Servicios Ltda.', rut: '77.230.448-6', portal: true },
    { key: 'aseopro', id: 'xc-dir-aseo-pro', fantasy: 'Aseo Pro', legal: 'Aseo Pro SpA', rut: '76.318.004-K' },
    { key: 'austral', id: 'xc-dir-aseo-austral', fantasy: 'Aseo Austral', legal: 'Servicios de Aseo Austral SpA', rut: '76.554.901-2' },
    { key: 'ascensores', id: 'xc-dir-ascensores-andinos', fantasy: 'Ascensores Andinos', legal: 'Ascensores Andinos S.A.', rut: '96.771.230-5' },
    { key: 'frio', id: 'xc-dir-frio-industrial', fantasy: 'Frío Industrial', legal: 'Frío Industrial SpA', rut: '76.330.982-1' },
  ],
  initiatives: [
    { key: 'fmaseo', title: 'Renovación de servicios de aseo 2027', cat: 'aseo', spend: 486_000_000, pct: 8, status: 'in_progress', owner: 'buyer4', backup: 'buyer3', quarter: 'Q1', start: -80, end: 150,
      description: 'Renovar los tres contratos de aseo (Santiago, Norte y Sur) antes de su vencimiento, con un estándar de servicio nacional y menor costo total. Iniciativa ficticia (DEMO).' },
    { key: 'fmsanit', title: 'Sanitización y control de plagas 2027', cat: 'aseo', spend: 48_000_000, pct: 6, status: 'in_progress', owner: 'buyer4', backup: 'buyer3', quarter: 'Q1', start: -18, end: 60,
      description: 'Contratar sanitización y control de plagas para plantas y bodegas con un solo proveedor. Iniciativa ficticia (DEMO).' },
    { key: 'fmasc', title: 'Mantención de ascensores 2027', cat: 'asc', spend: 96_000_000, pct: 7, status: 'planned', owner: 'buyer1', backup: 'buyer4', quarter: 'Q1', start: 10, end: 130,
      description: 'Licitar la mantención preventiva y correctiva de los 14 ascensores y montacargas. Iniciativa ficticia (DEMO).' },
    { key: 'fmclima', title: 'Climatización y HVAC 2027', cat: 'clima', spend: 120_000_000, pct: 6, status: 'planned', owner: 'buyer1', backup: 'buyer4', quarter: 'Q2', start: 45, end: 200,
      description: 'Mantención de equipos de climatización de oficinas y salas eléctricas. Iniciativa ficticia (DEMO).',
      milestones: { inicio: 45, preparacion_rfx: 60, invitacion: 80, recepcion: 100, evaluacion: 115, comite_adjudicacion: 125, formalizacion: 140 } },
  ],
  contracts: [
    { key: 'stgo', code: 'CTR-XC-ASEO-STGO', name: 'Aseo Santiago', counterparty: 'Limpieza Total SpA', supplier: 'xc-dir-limpieza-total', start: -655, end: 75, amount: 235_200_000, cat: 'aseo', owner: 'buyer4',
      object: 'Servicio de aseo e higiene de oficinas centrales y centro de distribución de Santiago.', scope: 'Oficinas centrales (Las Condes) y centro de distribución (Pudahuel); dotación de 38 personas.' },
    { key: 'norte', code: 'CTR-XC-ASEO-NORTE', name: 'Aseo Norte', counterparty: 'Aseo Pro SpA', supplier: 'xc-dir-aseo-pro', start: -625, end: 105, amount: 132_000_000, cat: 'aseo', owner: 'buyer4',
      object: 'Servicio de aseo e higiene de instalaciones de la zona norte y bodega Quilicura.', scope: 'Planta Antofagasta, oficinas La Serena y bodega Quilicura; dotación de 21 personas.' },
    { key: 'sur', code: 'CTR-XC-ASEO-SUR', name: 'Aseo Sur', counterparty: 'Servicios de Aseo Austral SpA', supplier: 'xc-dir-aseo-austral', start: -590, end: 140, amount: 118_800_000, cat: 'aseo', owner: 'buyer4',
      object: 'Servicio de aseo e higiene de instalaciones de la zona sur.', scope: 'Planta Concepción y bodega Puerto Montt; dotación de 19 personas.' },
    { key: 'asc', code: 'CTR-XC-ASC-001', name: 'Mantención de ascensores', counterparty: 'Ascensores Andinos S.A.', supplier: 'xc-dir-ascensores-andinos', start: -660, end: 70, amount: 84_000_000, cat: 'asc', owner: 'buyer1',
      object: 'Mantención preventiva y correctiva de ascensores y montacargas.', scope: '14 equipos en oficinas centrales y plantas.' },
    { key: 'clima', code: 'CTR-XC-CLIMA-001', name: 'Climatización oficinas centrales', counterparty: 'Frío Industrial SpA', supplier: 'xc-dir-frio-industrial', start: -700, end: 95, amount: 112_000_000, cat: 'clima', owner: 'buyer1',
      object: 'Mantención de equipos de climatización y HVAC.', scope: 'Oficinas centrales y salas eléctricas de plantas.' },
  ],
  licitaciones: [
    { id: 'DEMO-XC-FM-RFI-001', name: 'RFI identificación de proveedores de aseo', type: 'RFI', stages: ['bases_review', 'published'], published: -50,
      description: 'Solicitud de información para identificar proveedores con cobertura nacional de aseo e higiene. Proceso ficticio (DEMO).',
      document: { file: 'rfi-proveedores-aseo.pdf', title: 'RFI · Identificación de proveedores de aseo', body: 'Objetivo: conocer proveedores con capacidad de prestar servicios de aseo e higiene en Santiago, zona norte y zona sur.\n\nInformación solicitada:\n1. Cobertura geográfica y sedes propias.\n2. Dotación actual y capacidad de reemplazo en 4 horas.\n3. Certificaciones (ISO 9001, ISO 14001) e insumos certificados.\n4. Tres clientes de referencia con más de 30 personas de dotación.\n5. Estados financieros de los dos últimos años.\n\nPlazo de respuesta: 10 días hábiles desde la invitación. La respuesta no obliga a ninguna de las partes.' } },
    { id: 'DEMO-XC-FM-RFP-REG', name: 'RFP aseo regiones (Norte y Sur)', type: 'RFP', baseline: 250_800_000, stages: ['bases_review'], closing: 30,
      description: 'Licitación de aseo para la zona norte y sur, que consolida los contratos Aseo Norte y Aseo Sur. Proceso ficticio (DEMO).',
      document: { file: 'rfp-regiones-bases-anexos-formulario-contrato.pdf', title: 'RFP aseo regiones · Bases, anexos, formulario de cotización y contrato borrador', body: 'BASES ADMINISTRATIVAS\nProceso de licitación privada por invitación. Consultas hasta el día 7; respuestas el día 12; ofertas el día 30.\n\nBASES TÉCNICAS\nSedes: planta Antofagasta, oficinas La Serena, planta Concepción y bodega Puerto Montt. Frecuencias por recinto en el Anexo 1.\nDotación mínima de 36 personas y supervisión en terreno en cada planta.\n\nANEXO 1 · Pautas y frecuencias por recinto.\nANEXO 2 · Declaración jurada de cumplimiento laboral y previsional.\nANEXO 3 · FORMULARIO DE COTIZACIÓN: precio mensual por sede, insumos mensuales por sede, hora extra de dotación y costo de reemplazo.\n\nCONTRATO BORRADOR\nObjeto, vigencia de 24 meses, precio mensual reajustable por IPC cada 12 meses, multas por incumplimiento de pautas (2% por punto bajo 95%, tope 10%) y término anticipado con 60 días de aviso.' } },
  ],
  projects: [
    { key: 'nacional', initiative: 'fmaseo', title: 'Contratación nacional de aseo', template: 'completa', owner: 'buyer4', start: -80, priority: 1,
      description: 'Proyecto de sourcing para reemplazar los contratos de aseo de Santiago, Norte y Sur: RFP Santiago (urgente, vence primero) y RFP regiones que consolida Norte y Sur.',
      assign: { a8: 'buyer3', a9: 'manager', a11: 'manager', a25: 'committee', a27: 'buyer3' },
      done: ['a1', 'a2', 'a3', 'a4', 'a5', 'a10', 'a11', 'a6', 'a7', 'a8', 'a12'], slip: { a3: 3, a7: 2 },
      inProgress: ['a14'],
      block: { key: 'a15', cause: 'area_solicitante', note: 'Operaciones aún no confirma la dotación por sede de regiones; sin ese dato no se pueden responder las consultas.' },
      reschedule: { key: 'a16', start: 2, end: 16, cause: 'proveedor', reason: 'Los oferentes de regiones pidieron extender la visita técnica a las plantas de Antofagasta y Concepción.' },
      documents: [
        doc('gasto_referencia', 'buyer4', 'gasto-referencia-aseo-2025-2026.pdf', 'Gasto de referencia · Aseo e higiene 2025-2026', 'Gasto anual 2025 en aseo e higiene: 243.000.000 CLP en tres contratos.\n\nSantiago (Limpieza Total): 117.600.000 CLP · 38 personas.\nNorte (Aseo Pro): 66.000.000 CLP · 21 personas.\nSur (Aseo Austral): 59.400.000 CLP · 19 personas.\n\nHallazgos: precios por persona dispares entre zonas (hasta 14%), insumos facturados aparte en Norte y Sur, sin indicadores de calidad comunes y vencimientos escalonados entre febrero y abril de 2027.' ),
        doc('iniciativas_ahorro', 'buyer4', 'linea-base-e-iniciativas-de-ahorro.pdf', 'Línea base económica e iniciativas de ahorro', 'Línea base: precios mensuales vigentes por sede reajustados 4,5% (IPC proyectado) e insumos reajustados 3%.\n\nIniciativas:\n1. Estándar nacional de pautas y frecuencias (elimina sobrefrecuencias en oficinas).\n2. Insumos incluidos en el precio con canasta certificada.\n3. Consolidar Norte y Sur en un solo proceso de regiones.\n4. Bodega Quilicura pasa al contrato de Santiago (20% del alcance de Aseo Norte).\n\nAhorro anual esperado: 6% a 9% sobre la línea base, en CLP.'),
        doc('estrategia_categoria', 'buyer4', 'estrategia-categoria-aseo-v1.pdf', 'Estrategia de categoría · Aseo e higiene (v1)', 'Estrategia propuesta: un solo proceso nacional con adjudicación única.\nRiesgo: concentración en un proveedor y menor competencia en regiones.', {
          approver: 'manager', request: 'Estrategia para revisión antes de preparar bases.',
          reject: doc('estrategia_categoria', 'buyer4', 'estrategia-categoria-aseo-v2.pdf', 'Estrategia de categoría · Aseo e higiene (v2)', 'Estrategia aprobada para ejecución:\n\n1. RFP Santiago primero (el contrato vence antes) con adjudicación a un proveedor.\n2. RFP regiones que consolida Norte y Sur, con opción de adjudicar por zona.\n3. Lista corta: Limpieza Total, Higiene Integral Chile y Brillo Servicios para Santiago; cinco proveedores para regiones según el RFI.\n4. Evaluación técnica (60%) antes de la económica (40%); umbral técnico de 70 puntos.\n5. Contrato a 24 meses con multas por pautas y reemplazo de dotación en 4 horas.') }),
        doc('pliego', 'buyer4', 'bases-tecnicas-administrativas-aseo.pdf', 'Bases técnicas y administrativas · Aseo nacional', 'Bases comunes para el RFP Santiago y el RFP regiones.\n\nAlcance, sedes y frecuencias (Anexo 1); requisitos de dotación y supervisión; insumos certificados incluidos; indicadores de calidad (inspección mensual con pauta de 40 puntos); multas y término anticipado; formulario de cotización por sede; contrato tipo a 24 meses.', { approver: 'manager', request: 'Bases listas para publicar el RFP Santiago.' }),
        doc('estrategia_cierre', 'buyer4', 'estrategia-negociacion-final-regiones.pdf', 'Estrategia de negociación final · Regiones', 'Si las ofertas de regiones superan la línea base en más de 5%, se abre una ronda final con los dos mejores puntajes técnicos y se negocia el costo de reemplazo de dotación y la canasta de insumos.', { approver: 'manager', request: 'Para tenerla aprobada antes de abrir las ofertas de regiones.', pending: true }),
      ],
      baseline: { title: 'Línea base nacional de aseo 2027', scope: 'Servicio integral de aseo e higiene en Santiago, zona norte y zona sur; mismo alcance y frecuencias.', conditions: 'Precios vigentes reajustados por IPC proyectado 4,5%; insumos 3%. Cantidades: 12 meses.',
        lines: [
          { item: 'Servicio integral de aseo · Santiago', unit: 'mes', specification: 'Oficinas centrales y centro de distribución; 38 personas', reference_price: 10_050_000, adjustment_pct: 4.5, projected_qty: 12 },
          { item: 'Servicio integral de aseo · Norte', unit: 'mes', specification: 'Antofagasta, La Serena y Quilicura; 21 personas', reference_price: 5_500_000, adjustment_pct: 4.5, projected_qty: 12 },
          { item: 'Servicio integral de aseo · Sur', unit: 'mes', specification: 'Concepción y Puerto Montt; 19 personas', reference_price: 4_950_000, adjustment_pct: 4.5, projected_qty: 12 },
          { item: 'Insumos y consumibles certificados', unit: 'mes', specification: 'Canasta común para todas las sedes', reference_price: 1_850_000, adjustment_pct: 3, projected_qty: 12 },
        ] },
      comments: [
        { by: 'buyer4', task: 'a14', mentions: ['manager'], body: '@Gonzalo Pérez los oferentes de regiones pidieron extender la visita técnica. Propongo mover la recepción de propuestas dos semanas; Santiago sigue en plazo.' },
        { by: 'manager', task: 'a14', mentions: ['buyer4'], body: '@Diego Navarro de acuerdo. Reprogramo con causa «proveedor» y pido a Operaciones que confirme la dotación por sede.' },
        { by: 'buyer3', deliverable: 'pliego', mentions: ['buyer4'], body: '@Diego Navarro revisé el contrato tipo: agregué la cláusula de reemplazo de dotación en 4 horas y la multa por pautas.' },
      ],
      contracts: [['stgo', 'affected', 'Vence antes del inicio del nuevo servicio'], ['norte', 'affected', 'Se licita en el RFP regiones; Quilicura pasa a Santiago'], ['sur', 'affected', 'Se licita en el RFP regiones']] },
    { key: 'sanit', initiative: 'fmsanit', title: 'Sanitización y control de plagas', template: 'light', owner: 'buyer4', start: -18, priority: 2,
      description: 'Proceso simple con metodología Light: un proveedor para plantas y bodegas.',
      baseline: { title: 'Referencia económica sanitización', scope: 'Sanitización mensual y control de plagas en 6 recintos.', conditions: 'Cotizaciones vigentes 2026.',
        lines: [{ item: 'Sanitización y control de plagas por recinto', unit: 'recinto-mes', specification: '6 recintos, frecuencia mensual', reference_price: 620_000, adjustment_pct: 4, projected_qty: 72 }] },
      document: doc('referencia', 'buyer4', 'referencia-sanitizacion.pdf', 'Referencia económica · Sanitización y control de plagas', 'Gasto 2026: 44.640.000 CLP en tres proveedores por recinto. Referencia: 620.000 CLP por recinto al mes, reajustada 4%.', { approver: 'manager', request: 'Referencia para aprobar.' }) },
    { key: 'asc', initiative: 'fmasc', title: 'Mantención de ascensores 2027', template: 'completa', owner: 'buyer1', start: 10, priority: 2,
      description: 'Proyecto planificado: comienza en diez días, antes del vencimiento del contrato vigente.',
      contracts: [['asc', 'affected', 'Vence en 70 días; el proceso debe terminar antes']] },
  ],
  flowLicitacion: 'DEMO-XC-FM-STGO',
  successorStart: 76,
  winner: 'Higiene Integral Chile',
  awardedPrices: { 1: 9_450_000 },
  afterFlowDocuments: [
    doc('matriz_evaluacion', 'buyer4', 'matriz-evaluacion-rfp-santiago.pdf', 'Matriz de evaluación técnica y económica · RFP Santiago', 'Ponderación: técnica 60%, económica 40%; umbral técnico 70.\n\nHigiene Integral Chile: técnica 89 · oferta 226.800.000 CLP (24 meses).\nLimpieza Total: técnica 78 · oferta 238.000.000 CLP.\nBrillo Servicios: sin NDA aceptado; no presentó oferta.\n\nResultado: Higiene Integral Chile obtiene el mejor puntaje combinado.'),
    doc('recomendacion_adjudicacion', 'buyer4', 'recomendacion-adjudicacion-rfp-santiago.pdf', 'Resultado y recomendación de adjudicación · RFP Santiago', 'Se recomienda adjudicar a Higiene Integral Chile por 226.800.000 CLP en 24 meses (9.450.000 CLP al mes), 10% bajo la línea base de Santiago.\nRiesgos: transición de dotación desde el proveedor actual; se mitiga con un plan de implementación de 30 días.', { approver: 'committee', request: 'Recomendación para el comité.' }),
    doc('acta_contratos', 'buyer3', 'acta-adjudicacion-y-contrato-santiago-demo.pdf', 'Acta de adjudicación y contrato formalizado · Santiago (DEMO)', 'Acta: el comité aprobó la recomendación con una persona distinta de quien recomendó. Adjudicación formal registrada en XPEND.\n\nContrato CTR-XC-FM-STGO: generado desde la adjudicación, revisado y aprobado por otra persona. Inicio del servicio al vencer el contrato Aseo Santiago.\n\nDocumento ficticio: no tiene validez legal ni firma electrónica.'),
    doc('plan_implementacion', 'buyer4', 'plan-implementacion-aseo-santiago.pdf', 'Plan de implementación · Aseo Santiago', 'Semana 1: kick-off con Operaciones y el proveedor; levantamiento de pautas por recinto.\nSemana 2: traspaso de dotación y entrega de insumos certificados.\nSemana 3: inicio del servicio con supervisión reforzada.\nSemana 4: primera inspección mensual con pauta de 40 puntos y reporte de indicadores.'),
    doc('brechas_acciones', 'buyer4', 'plan-acciones-correctivas-transicion.pdf', 'Plan de acciones correctivas · Transición Santiago (borrador)', 'Brechas detectadas en la visita de transición:\n1. Bodega Quilicura sin pauta de frecuencias → definirla antes del inicio.\n2. Insumos del proveedor saliente sin certificación → reemplazo en la semana 2.\n3. Turno noche sin supervisor → el nuevo contrato exige supervisión 24/7.\nResponsable: Category Manager de Servicios Generales. Seguimiento mensual en el proyecto.'),
  ],
  tours: (ref) => [
    { tour_key: 'principal', name: 'Del gasto al ahorro: Facility Management', audience: 'internal', enabled: true,
      description: 'Diez pasos sobre el caso de aseo: gasto, categoría, plan, proyecto, Gantt, RFx, ofertas, contratos, ahorro y atención gerencial.',
      steps: [
        { key: 'gasto', title: 'Todo parte del gasto', body: 'XPEND carga y clasifica el gasto. Aquí se ve cuánto se gasta en aseo, con quién y en qué moneda: es la base de la oportunidad.', href: '/spend', ...(ref.upload ? { record: { table: 'si_uploads', id: ref.upload, label: 'Carga de gasto histórico' } } : {}) },
        { key: 'categoria', title: 'Categoría Facility Management', body: 'Las categorías ordenan el gasto y tienen responsable. Aseo e higiene es una subcategoría con su propio Category Manager.', href: '/equipos', record: { table: 'procurement_categories', id: ref.category, label: 'Aseo e higiene' } },
        { key: 'plan', title: 'Plan anual 2027', body: 'La iniciativa «Renovación de servicios de aseo 2027» vive en el plan con su meta de ahorro. La vista Árbol muestra categoría, iniciativa, proyecto, RFx y contratos.', href: '/plan-anual?anio=2027&vista=arbol', record: { table: 'sourcing_plans', id: ref.plan, label: 'Renovación de servicios de aseo 2027' }, target: 'vista-arbol' },
        { key: 'proyecto', title: 'Proyecto «Contratación nacional de aseo»', body: 'Metodología Completa: 8 etapas y 29 actividades. El resumen dice qué falta, quién lo hace y cuál es la siguiente acción.', href: `/proyectos/${ref.project}`, record: { table: 'sourcing_projects', id: ref.project, label: 'Contratación nacional de aseo' }, target: 'siguiente-accion' },
        { key: 'gantt', title: 'Gantt y entregables', body: 'Barras con fecha comprometida, línea original, atrasos, bloqueos y dependencias. Una reprogramación queda con causa y motivo.', href: `/proyectos/${ref.project}?tab=gantt`, record: { table: 'sourcing_projects', id: ref.project }, target: 'gantt-proyecto' },
        { key: 'rfx', title: 'Procesos RFx del proyecto', body: 'RFI para conocer el mercado, RFP Santiago ya adjudicado y RFP regiones en preparación. Los hitos del Gantt se cumplen con estos registros, no a mano.', href: `/proyectos/${ref.project}?tab=rfx`, record: { table: 'licitaciones', id: ref.licitacion, label: 'RFP aseo Santiago' } },
        { key: 'ofertas', title: 'Ofertas y evaluación', body: 'Sobres cerrados hasta la apertura, NDA obligatorio y evaluación técnica antes de la económica. El proveedor sin NDA no pudo ofertar.', href: ref.event ? `/sala/${ref.event}/evaluacion` : `/licitaciones/${ref.licitacion}`, ...(ref.event ? { record: { table: 'offer_events', id: ref.event, label: 'Sala RFP Santiago' } } : {}) },
        { key: 'contratos', title: 'Contratos anteriores y nuevos', body: 'Situación anterior, proceso y nueva situación: Aseo Santiago se reemplaza y el 20% de Aseo Norte pasa al nuevo contrato. Los anteriores siguen vigentes hasta su término.', href: `/proyectos/${ref.project}?tab=contratos`, record: { table: 'sourcing_projects', id: ref.project }, target: 'situacion-contratos' },
        { key: 'ahorro', title: 'Línea base y ahorro', body: 'Ahorro anualizado = (precio de referencia ajustado − precio adjudicado) × cantidad proyectada. La línea base formal se aprobó antes de publicar; el ahorro realizado requiere validación de otra persona.', href: `/proyectos/${ref.project}?tab=ahorro`, ...(ref.baseline ? { record: { table: 'economic_baselines', id: ref.baseline, label: 'Línea base nacional de aseo 2027' } } : {}) },
        { key: 'atencion', title: 'Lo que requiere tu atención', body: 'La gerencia ve atrasos, bloqueos, aprobaciones detenidas y contratos por vencer sin renovación, con la explicación y el enlace para resolverlos.', href: '/dashboard?vista=gerencia', target: 'atencion-gerencia' },
      ] },
    { tour_key: 'proveedor', name: 'Portal de proveedores', audience: 'supplier', enabled: true,
      description: 'Cómo un proveedor ve sus invitaciones, acepta el NDA y presenta su oferta.',
      steps: [
        { key: 'portal', title: 'Tus procesos', body: 'Aquí aparecen solo las invitaciones de tu empresa. No ves otras ofertas ni documentos internos.', href: '/sala' },
        { key: 'nda', title: 'NDA antes de los documentos', body: 'Las bases técnicas y el formulario de oferta se habilitan al aceptar el NDA de la versión vigente.', href: ref.event ? `/sala/${ref.event}/participar` : '/sala' },
      ] },
  ],
}

FLOWS.F = {
  plan: 'fmaseo', name: 'RFP aseo Santiago', licitacion: 'DEMO-XC-FM-STGO', currency: 'CLP', baseline: 252_000_000, overrideBaseline: true, committeeKey: 'committee', responsible: 'buyer4', savings: 'declare', recognize: 0,
  suppliers: [
    { key: 'limpiezatotal', name: 'Limpieza Total', amount: 238_000_000, nda: true, text: 'Continuidad del servicio actual con 38 personas y supervisión diurna.' },
    { key: 'higiene', name: 'Higiene Integral Chile', amount: 226_800_000, nda: true, text: 'Dotación de 40 personas, maquinaria propia, supervisión 24/7 y control de calidad mensual con indicadores.' },
    { key: 'brillo', name: 'Brillo Servicios', amount: 205_000_000, nda: false, text: 'Oferta sin NDA aceptado.' },
  ],
  scores: { limpiezatotal: ['78', 'Cumple, sin supervisión nocturna.'], higiene: ['89', 'Mejor plan de calidad, maquinaria propia y dotación de reemplazo.'] },
  recommend: 'Higiene Integral Chile', contract: { code: 'CTR-XC-FM-STGO', startOffset: 76, notice: '60', years: 2 },
  scope: 'Servicio integral de aseo e higiene de oficinas centrales, centro de distribución y bodega Quilicura en Santiago durante 24 meses.',
  requirements: 'Dotación mínima de 40 personas, supervisión 24/7, insumos certificados incluidos y reporte mensual de indicadores de calidad.',
}
