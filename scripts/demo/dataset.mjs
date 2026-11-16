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
