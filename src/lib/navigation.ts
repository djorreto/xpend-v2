export type Role = 'super_admin' | 'admin' | 'manager' | 'analyst' | 'viewer' | 'supplier'

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super administrador',
  admin: 'Administrador',
  manager: 'Gerente de abastecimiento',
  analyst: 'Comprador',
  viewer: 'Consulta',
  supplier: 'Proveedor',
}

export function roleLabel(role?: string | null) {
  return (role && ROLE_LABELS[role]) || 'Usuario'
}

// Mirrors the RLS write policies (licitaciones, offer_events, sourcing_plans, suppliers: admin/manager;
// contracts: admin/manager/analyst). Hiding an entry never replaces those policies.
export const CAPABILITY_ROLES = {
  createInitiative: ['super_admin', 'admin', 'manager'],
  createLicitacion: ['super_admin', 'admin', 'manager'],
  openSala: ['super_admin', 'admin', 'manager'],
  createRfx: ['super_admin', 'admin', 'manager', 'analyst'],
  readContracts: ['super_admin', 'admin', 'manager', 'analyst'],
  writeContracts: ['super_admin', 'admin', 'manager', 'analyst'],
  writeSuppliers: ['super_admin', 'admin', 'manager'],
  approve: ['super_admin', 'admin', 'manager'],
  readSpend: ['super_admin', 'admin', 'manager', 'analyst'],
  manageSpend: ['super_admin', 'admin', 'manager'],
  manageTeams: ['super_admin', 'admin', 'manager'],
  declareSavings: ['super_admin', 'admin', 'manager', 'analyst'],
  validateSavings: ['super_admin', 'admin', 'manager'],
  administer: ['super_admin', 'admin'],
  platform: ['super_admin'],
} as const satisfies Record<string, readonly Role[]>

export type Capability = keyof typeof CAPABILITY_ROLES

export const CAPABILITY_LABELS: Record<Capability, string> = {
  createInitiative: 'Crear y editar iniciativas del plan',
  createLicitacion: 'Crear licitaciones',
  openSala: 'Abrir salas de ofertas',
  createRfx: 'Preparar bases (RFx)',
  readContracts: 'Ver contratos',
  writeContracts: 'Cargar y redactar contratos',
  writeSuppliers: 'Crear y editar proveedores',
  approve: 'Aprobar bases y decisiones',
  readSpend: 'Ver el gasto',
  manageSpend: 'Cargar gasto y cerrar el mes',
  manageTeams: 'Asignar categorías, responsables y equipos de compras',
  declareSavings: 'Declarar ahorros de sus iniciativas',
  validateSavings: 'Validar y reconocer ahorros',
  administer: 'Administrar usuarios y configuración',
  platform: 'Administrar la plataforma',
}

export function isInternal(role?: string | null) {
  return Boolean(role) && role !== 'supplier'
}

export function can(role: string | null | undefined, capability: Capability) {
  return Boolean(role) && (CAPABILITY_ROLES[capability] as readonly string[]).includes(role as string)
}

export type NavItem = {
  id: string
  label: string
  href: string
  description: string
  match: string[]
  requires?: Capability
  flag?: 'invoices'
}

export type NavSection = {
  id: 'inicio' | 'abastecimiento' | 'gasto' | 'contratos' | 'proveedores' | 'administracion'
  label: string
  description: string
  requires?: Capability
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'inicio',
    label: 'Inicio',
    description: 'Tu centro de trabajo',
    items: [
      { id: 'inicio', label: 'Inicio', href: '/dashboard', description: 'Lo que requiere tu atención hoy', match: ['/dashboard'] },
    ],
  },
  {
    id: 'abastecimiento',
    label: 'Abastecimiento',
    description: 'De la iniciativa a la adjudicación',
    items: [
      { id: 'plan', label: 'Plan de abastecimiento', href: '/sourcing-plan', description: 'Iniciativas del año', match: ['/sourcing-plan'] },
      { id: 'plan-anual', label: 'Plan anual y calendario', href: '/plan-anual', description: 'Metas, hitos y fechas del año', match: ['/plan-anual'] },
      { id: 'equipos', label: 'Equipos y categorías', href: '/equipos', description: 'Quién lleva cada categoría', match: ['/equipos'] },
      { id: 'procesos', label: 'Procesos', href: '/procesos', description: 'RFx, licitaciones y salas de ofertas', match: ['/procesos', '/rfx-maker', '/licitaciones', '/sala'] },
      { id: 'ahorros', label: 'Control de ahorros', href: '/ahorros', description: 'Negociado, validado y realizado', match: ['/ahorros'] },
      { id: 'adjudicaciones', label: 'Adjudicaciones', href: '/adjudicaciones', description: 'Decisiones del comité y su contrato', match: ['/adjudicaciones'] },
      { id: 'reportes', label: 'Reportes y exportaciones', href: '/reports', description: 'Descargas en CSV', match: ['/reports'] },
    ],
  },
  {
    id: 'gasto',
    label: 'Inteligencia de gasto',
    description: 'Gasto, categorías y oportunidades',
    requires: 'readSpend',
    items: [
      { id: 'resumen', label: 'Resumen y análisis', href: '/spend', description: 'Gasto por categoría y proveedor', match: ['/spend'] },
      { id: 'clasificacion', label: 'Clasificación y categorías', href: '/sourcing-intelligence', description: 'Cargar, clasificar y validar el gasto', match: ['/sourcing-intelligence'] },
      { id: 'oportunidades', label: 'Oportunidades', href: '/oportunidades', description: 'Categorías sugeridas para el plan', match: ['/oportunidades'] },
      { id: 'cierre', label: 'Cierre mensual de gasto', href: '/comite', description: 'Cerrar el período y preparar la reunión', match: ['/comite'] },
    ],
  },
  {
    id: 'contratos',
    label: 'Contratos',
    description: 'Repositorio y redacción',
    requires: 'readContracts',
    items: [
      { id: 'repositorio', label: 'Repositorio', href: '/contratos', description: 'Todos los contratos', match: ['/contratos'] },
      { id: 'pendientes', label: 'Pendientes de revisión', href: '/contratos?vista=pendientes', description: 'Borradores y versiones en revisión', match: [] },
      { id: 'redactar', label: 'Redactar contrato', href: '/contratos/builder', description: 'Desde una plantilla', match: ['/contratos/builder'], requires: 'writeContracts' },
      { id: 'cargar', label: 'Cargar y analizar', href: '/contratos/nuevo', description: 'Subir un contrato existente', match: ['/contratos/nuevo', '/contratos/desde-adjudicacion'], requires: 'writeContracts' },
    ],
  },
  {
    id: 'proveedores',
    label: 'Proveedores',
    description: 'Directorio y altas',
    items: [
      { id: 'directorio', label: 'Directorio', href: '/suppliers', description: 'Proveedores y evaluación administrativa', match: ['/suppliers'] },
      { id: 'nuevo-proveedor', label: 'Agregar proveedor', href: '/suppliers/new', description: 'Alta de un proveedor', match: ['/suppliers/new'], requires: 'writeSuppliers' },
      { id: 'facturas', label: 'Facturas (experimental)', href: '/invoices', description: 'Módulo en pruebas', match: ['/invoices'], flag: 'invoices' },
    ],
  },
  {
    id: 'administracion',
    label: 'Administración',
    description: 'Usuarios, roles y configuración',
    requires: 'administer',
    items: [
      { id: 'usuarios', label: 'Usuarios', href: '/users', description: 'Invitar y administrar usuarios', match: ['/users'] },
      { id: 'roles', label: 'Roles y permisos', href: '/administracion/roles', description: 'Qué puede hacer cada rol', match: ['/administracion/roles'] },
      { id: 'configuracion', label: 'Configuración', href: '/settings', description: 'Empresa y cuenta', match: ['/settings'] },
      { id: 'super-admin', label: 'Super Admin', href: '/super-admin', description: 'Plataforma', match: ['/super-admin'], requires: 'platform' },
    ],
  },
]

export const SUPPLIER_NAV: NavSection[] = [
  {
    id: 'inicio',
    label: 'Mis procesos',
    description: 'Invitaciones, NDA y ofertas',
    items: [
      { id: 'sala', label: 'Mis procesos', href: '/sala', description: 'Invitaciones, NDA y ofertas', match: ['/sala'] },
    ],
  },
]

export type NavOptions = { invoices?: boolean }

export function navigationFor(role: string | null | undefined, options: NavOptions = {}): NavSection[] {
  if (role === 'supplier') return SUPPLIER_NAV
  if (!role) return []
  return NAV_SECTIONS
    .filter(section => !section.requires || can(role, section.requires))
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        (!item.requires || can(role, item.requires)) &&
        (item.flag !== 'invoices' || options.invoices)
      ),
    }))
    .filter(section => section.items.length > 0)
}

function matches(prefix: string, pathname: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function activeNav(pathname: string, sections: NavSection[] = NAV_SECTIONS, search = '') {
  let best: { section: NavSection; item: NavItem; length: number } | null = null
  for (const section of sections) {
    for (const item of section.items) {
      for (const prefix of item.match) {
        if (matches(prefix, pathname) && (!best || prefix.length > best.length)) {
          best = { section, item, length: prefix.length }
        }
      }
    }
  }
  if (best?.item.id === 'repositorio' && pathname === '/contratos' && new URLSearchParams(search).get('vista') === 'pendientes') {
    const pending = best.section.items.find(item => item.id === 'pendientes')
    if (pending) return { section: best.section, item: pending }
  }
  return best ? { section: best.section, item: best.item } : null
}

export const PROCESS_TABS = [
  { id: 'todos', label: 'Todos', href: '/procesos', prefix: '/procesos' },
  { id: 'rfx', label: 'RFx (bases)', href: '/rfx-maker', prefix: '/rfx-maker' },
  { id: 'licitacion', label: 'Licitaciones', href: '/licitaciones', prefix: '/licitaciones' },
  { id: 'sala', label: 'Salas de ofertas', href: '/sala', prefix: '/sala' },
] as const

const SEGMENT_LABELS: Record<string, string> = {
  new: 'Nuevo',
  nuevo: 'Nuevo',
  edit: 'Editar',
  evaluacion: 'Evaluación',
  decision: 'Decisión',
  participar: 'Participar',
  templates: 'Plantillas',
  policies: 'Políticas',
  taxonomia: 'Taxonomía',
  validacion: 'Validación',
  cerebro: 'Cerebro de clasificación',
  'learning-rules': 'Reglas aprendidas',
  upload: 'Cargar gasto',
  classify: 'Clasificar',
  insights: 'Análisis',
  kraljic: 'Kraljic',
  plan: 'Estrategias por categoría',
  mapear: 'Mapear columnas',
  grupo: 'Grupo',
  flujo: 'Flujo de clasificación',
  comparar: 'Comparar',
  'desde-adjudicacion': 'Desde la adjudicación',
}

export type Crumb = { label: string; href?: string }

export function breadcrumbsFor(pathname: string, sections: NavSection[] = NAV_SECTIONS, search = ''): Crumb[] {
  const active = activeNav(pathname, sections, search)
  if (!active || active.section.id === 'inicio') return []
  const crumbs: Crumb[] = [{ label: active.section.label, href: active.section.items[0]?.href }]
  crumbs.push({ label: active.item.label, href: active.item.href })

  let base = active.item.match
    .filter(prefix => matches(prefix, pathname))
    .sort((a, b) => b.length - a.length)[0] || active.item.href
  if (active.item.id === 'procesos') {
    const tab = PROCESS_TABS.find(item => item.id !== 'todos' && matches(item.prefix, pathname))
    if (tab) crumbs.push({ label: tab.label, href: tab.href })
  }

  const rest = pathname.slice(base.length).split('/').filter(Boolean)
  for (const segment of rest) {
    base = `${base}/${segment}`
    const label = SEGMENT_LABELS[segment] || 'Detalle'
    if (label === 'Detalle' && crumbs[crumbs.length - 1]?.label === 'Detalle') continue
    crumbs.push({ label, href: base })
  }
  delete crumbs[crumbs.length - 1].href
  return crumbs
}
