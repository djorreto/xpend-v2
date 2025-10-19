// Mock data for demo purposes
export const mockDashboardData = {
  projects: {
    total: 12,
    active: 8,
    completed: 3,
    onHold: 1
  },
  licitaciones: {
    total: 15,
    active: 7,
    completed: 6,
    cancelled: 2
  },
  spend: {
    total: 2450000,
    thisMonth: 180000,
    byCategory: [
      { category: 'Tecnología', amount: 850000, percentage: 34.7 },
      { category: 'Servicios Profesionales', amount: 620000, percentage: 25.3 },
      { category: 'Suministros', amount: 480000, percentage: 19.6 },
      { category: 'Marketing', amount: 320000, percentage: 13.1 },
      { category: 'Infraestructura', amount: 180000, percentage: 7.3 }
    ]
  },
  recentProjects: [
    {
      id: '1',
      name: 'Modernización de Infraestructura IT',
      status: 'active',
      progress: 65,
      dueDate: '2025-02-15',
      budget: 500000,
      spent: 325000
    },
    {
      id: '2',
      name: 'Optimización de Proveedores',
      status: 'completed',
      progress: 100,
      dueDate: '2024-12-20',
      budget: 200000,
      spent: 195000
    },
    {
      id: '3',
      name: 'Implementación de ERP',
      status: 'active',
      progress: 30,
      dueDate: '2025-03-30',
      budget: 800000,
      spent: 240000
    },
    {
      id: '4',
      name: 'Renovación de Contratos',
      status: 'planning',
      progress: 15,
      dueDate: '2025-01-31',
      budget: 300000,
      spent: 45000
    },
    {
      id: '5',
      name: 'Análisis de Mercado',
      status: 'on_hold',
      progress: 45,
      dueDate: '2025-02-28',
      budget: 150000,
      spent: 67500
    }
  ],
  upcomingMilestones: [
    {
      id: '1',
      projectName: 'Modernización de Infraestructura IT',
      milestone: 'Análisis de Requerimientos',
      dueDate: '2025-01-15',
      daysLeft: 3,
      status: 'upcoming'
    },
    {
      id: '2',
      projectName: 'Implementación de ERP',
      milestone: 'Selección de Proveedor',
      dueDate: '2025-01-20',
      daysLeft: 8,
      status: 'upcoming'
    },
    {
      id: '3',
      projectName: 'Renovación de Contratos',
      milestone: 'Evaluación de Propuestas',
      dueDate: '2025-01-25',
      daysLeft: 13,
      status: 'upcoming'
    }
  ]
}

export const mockProjectsData = [
  {
    id: '1',
    name: 'Modernización de Infraestructura IT',
    description: 'Actualización completa de la infraestructura tecnológica de la empresa',
    status: 'active',
    priority: 'high',
    budget: 500000,
    spent: 325000,
    progress: 65,
    startDate: '2024-10-01',
    dueDate: '2025-02-15',
    created_at: '2024-09-15T10:00:00Z',
    company_id: 'company-1',
    created_by: 'user-1'
  },
  {
    id: '2',
    name: 'Optimización de Proveedores',
    description: 'Análisis y optimización de la cadena de proveedores actual',
    status: 'completed',
    priority: 'medium',
    budget: 200000,
    spent: 195000,
    progress: 100,
    startDate: '2024-08-01',
    dueDate: '2024-12-20',
    created_at: '2024-07-20T14:30:00Z',
    company_id: 'company-1',
    created_by: 'user-1'
  },
  {
    id: '3',
    name: 'Implementación de ERP',
    description: 'Implementación de sistema ERP para gestión empresarial',
    status: 'active',
    priority: 'high',
    budget: 800000,
    spent: 240000,
    progress: 30,
    startDate: '2024-11-01',
    dueDate: '2025-03-30',
    created_at: '2024-10-15T09:15:00Z',
    company_id: 'company-1',
    created_by: 'user-2'
  },
  {
    id: '4',
    name: 'Renovación de Contratos',
    description: 'Renovación y optimización de contratos existentes',
    status: 'planning',
    priority: 'medium',
    budget: 300000,
    spent: 45000,
    progress: 15,
    startDate: '2025-01-01',
    dueDate: '2025-01-31',
    created_at: '2024-12-10T16:45:00Z',
    company_id: 'company-1',
    created_by: 'user-1'
  },
  {
    id: '5',
    name: 'Análisis de Mercado',
    description: 'Estudio de mercado para nuevos productos y servicios',
    status: 'on_hold',
    priority: 'low',
    budget: 150000,
    spent: 67500,
    progress: 45,
    startDate: '2024-09-15',
    dueDate: '2025-02-28',
    created_at: '2024-09-01T11:20:00Z',
    company_id: 'company-1',
    created_by: 'user-3'
  }
]

export const mockLicitacionesData = [
  {
    id: 'LIC-2025-001',
    name: 'Suministro de Equipos de Oficina',
    description: 'Adquisición de equipos de oficina para renovación de espacios de trabajo',
    status: 'published',
    type: 'RFQ',
    category: 'non_recurring_service',
    baseline_currency: 'USD',
    baseline_amount: 150000,
    baseline_source: 'budget',
    awarded_amount: 135000,
    savings_amount: 15000,
    savings_percentage: 10,
    department_id: 'dept-1',
    responsible_user_id: 'user-1',
    request_date: '2024-12-01',
    publication_date: '2024-12-15',
    proposal_closing_date: '2025-01-15',
    committee_date: '2025-01-20',
    created_at: '2024-12-15T10:00:00Z',
    updated_at: '2024-12-15T10:00:00Z',
    company_id: 'company-1',
    created_by: 'user-1'
  },
  {
    id: 'LIC-2024-045',
    name: 'Servicios de Consultoría IT',
    description: 'Servicios de consultoría para modernización de sistemas',
    status: 'awarded',
    type: 'RFP',
    category: 'improvement_project',
    baseline_currency: 'USD',
    baseline_amount: 200000,
    baseline_source: 'historical',
    awarded_amount: 180000,
    savings_amount: 20000,
    savings_percentage: 10,
    department_id: 'dept-2',
    responsible_user_id: 'user-2',
    request_date: '2024-10-01',
    publication_date: '2024-10-20',
    proposal_closing_date: '2024-11-20',
    committee_date: '2024-11-25',
    award_date: '2024-12-01',
    created_at: '2024-10-20T14:30:00Z',
    updated_at: '2024-12-01T16:00:00Z',
    company_id: 'company-1',
    created_by: 'user-2'
  },
  {
    id: 'LIC-2025-002',
    name: 'Mantenimiento de Infraestructura',
    description: 'Servicios de mantenimiento preventivo y correctivo',
    status: 'evaluation',
    type: 'RFP',
    category: 'recurring_service',
    baseline_currency: 'USD',
    baseline_amount: 300000,
    baseline_source: 'budget',
    department_id: 'dept-3',
    responsible_user_id: 'user-1',
    request_date: '2024-12-10',
    publication_date: '2024-12-20',
    proposal_closing_date: '2025-01-20',
    committee_date: '2025-01-25',
    created_at: '2024-12-20T09:15:00Z',
    updated_at: '2024-12-20T09:15:00Z',
    company_id: 'company-1',
    created_by: 'user-1'
  }
]

export const mockSpendData = [
  {
    id: '1',
    category: 'Tecnología',
    vendor: 'TechCorp Solutions',
    amount: 250000,
    date: '2024-12-15',
    description: 'Licencias de software y hardware',
    project_id: '1'
  },
  {
    id: '2',
    category: 'Servicios Profesionales',
    vendor: 'Consulting Pro',
    amount: 180000,
    date: '2024-12-10',
    description: 'Servicios de consultoría estratégica',
    project_id: '2'
  },
  {
    id: '3',
    category: 'Suministros',
    vendor: 'Office Supply Co',
    amount: 45000,
    date: '2024-12-05',
    description: 'Materiales de oficina',
    project_id: '1'
  },
  {
    id: '4',
    category: 'Marketing',
    vendor: 'Digital Marketing Agency',
    amount: 120000,
    date: '2024-11-28',
    description: 'Campaña digital Q4',
    project_id: '3'
  },
  {
    id: '5',
    category: 'Infraestructura',
    vendor: 'InfraBuild Ltd',
    amount: 320000,
    date: '2024-11-20',
    description: 'Mejoras en infraestructura física',
    project_id: '1'
  }
]

export const mockUsersData = [
  {
    id: 'user-1',
    full_name: 'Juan Pérez',
    email: 'juan.perez@empresa.com',
    role: 'admin',
    company_id: 'company-1',
    avatar: null,
    created_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 'user-2',
    full_name: 'María González',
    email: 'maria.gonzalez@empresa.com',
    role: 'analyst',
    company_id: 'company-1',
    avatar: null,
    created_at: '2024-02-20T14:30:00Z'
  },
  {
    id: 'user-3',
    full_name: 'Carlos Rodríguez',
    email: 'carlos.rodriguez@empresa.com',
    role: 'manager',
    company_id: 'company-1',
    avatar: null,
    created_at: '2024-03-10T09:15:00Z'
  }
]

export const mockCompanyData = {
  id: 'company-1',
  name: 'Xpend',
  industry: 'Tecnología',
  size: '100-500 empleados',
  created_at: '2024-01-01T00:00:00Z'
}

// ===== DATOS MOCK PARA PROVEEDORES =====

export const mockSuppliersData = [
  {
    id: 'supplier-1',
    company_id: '550e8400-e29b-41d4-a716-446655440000',
    fantasy_name: 'TechSolutions Pro',
    legal_name: 'TechSolutions Pro SpA',
    rut: '76.123.456-7',
    service_type: 'tecnologia',
    contact_name: 'María González',
    contact_email: 'maria@techsolutions.cl',
    contact_phone: '+56 9 1234 5678',
    website: 'https://techsolutions.cl',
    nda_signed: true,
    nda_signed_date: '2024-01-15',
    comments: 'Proveedor confiable con amplia experiencia en desarrollo de software',
    is_active: true,
    created_at: '2024-01-10T10:00:00Z',
    updated_at: '2024-01-15T14:30:00Z',
    created_by: '550e8400-e29b-41d4-a716-446655440001'
  },
  {
    id: 'supplier-2',
    company_id: '550e8400-e29b-41d4-a716-446655440000',
    fantasy_name: 'Construcciones del Norte',
    legal_name: 'Construcciones del Norte Ltda.',
    rut: '96.789.123-4',
    service_type: 'construccion',
    contact_name: 'Carlos Mendoza',
    contact_email: 'carlos@construccionesnorte.cl',
    contact_phone: '+56 9 8765 4321',
    website: 'https://construccionesnorte.cl',
    nda_signed: true,
    nda_signed_date: '2024-02-20',
    comments: 'Especialistas en proyectos de infraestructura',
    is_active: true,
    created_at: '2024-02-15T09:00:00Z',
    updated_at: '2024-02-20T16:45:00Z',
    created_by: '550e8400-e29b-41d4-a716-446655440001'
  },
  {
    id: 'supplier-3',
    company_id: '550e8400-e29b-41d4-a716-446655440000',
    fantasy_name: 'Marketing Digital Plus',
    legal_name: 'Marketing Digital Plus SpA',
    rut: '65.456.789-0',
    service_type: 'marketing',
    contact_name: 'Ana Rodríguez',
    contact_email: 'ana@marketingplus.cl',
    contact_phone: '+56 9 5555 1234',
    website: 'https://marketingplus.cl',
    nda_signed: false,
    comments: 'Agencia de marketing digital con enfoque en redes sociales',
    is_active: true,
    created_at: '2024-03-01T11:00:00Z',
    updated_at: '2024-03-01T11:00:00Z',
    created_by: '550e8400-e29b-41d4-a716-446655440001'
  },
  {
    id: 'supplier-4',
    company_id: '550e8400-e29b-41d4-a716-446655440000',
    fantasy_name: 'Consultoría Empresarial',
    legal_name: 'Consultoría Empresarial Ltda.',
    rut: '78.321.654-9',
    service_type: 'consultoria',
    contact_name: 'Roberto Silva',
    contact_email: 'roberto@consultoria.cl',
    contact_phone: '+56 9 9999 8888',
    website: 'https://consultoria.cl',
    nda_signed: true,
    nda_signed_date: '2024-01-30',
    comments: 'Consultores especializados en procesos empresariales',
    is_active: true,
    created_at: '2024-01-25T08:00:00Z',
    updated_at: '2024-01-30T12:15:00Z',
    created_by: '550e8400-e29b-41d4-a716-446655440001'
  },
  {
    id: 'supplier-5',
    company_id: '550e8400-e29b-41d4-a716-446655440000',
    fantasy_name: 'Suministros Industriales',
    legal_name: 'Suministros Industriales SpA',
    rut: '89.654.321-2',
    service_type: 'suministros',
    contact_name: 'Patricia López',
    contact_email: 'patricia@suministros.cl',
    contact_phone: '+56 9 7777 6666',
    website: 'https://suministros.cl',
    nda_signed: true,
    nda_signed_date: '2024-02-10',
    comments: 'Proveedor de suministros industriales y equipos',
    is_active: false,
    created_at: '2024-02-05T14:00:00Z',
    updated_at: '2024-02-10T10:30:00Z',
    created_by: '550e8400-e29b-41d4-a716-446655440001'
  }
]

export const mockAdministrativeEvaluationsData = [
  {
    id: 'admin-eval-1',
    supplier_id: 'supplier-1',
    company_id: '550e8400-e29b-41d4-a716-446655440000',
    documentation_score: 85,
    documentation_notes: 'Documentación completa y actualizada',
    financial_score: 90,
    financial_notes: 'Situación financiera sólida',
    experience_score: 88,
    experience_notes: 'Amplia experiencia en proyectos similares',
    final_score: 87.67,
    evaluation_date: '2024-01-15',
    valid_until: '2025-01-15',
    evaluator_id: '550e8400-e29b-41d4-a716-446655440001',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 'admin-eval-2',
    supplier_id: 'supplier-2',
    company_id: '550e8400-e29b-41d4-a716-446655440000',
    documentation_score: 92,
    documentation_notes: 'Excelente documentación técnica',
    financial_score: 85,
    financial_notes: 'Buena solvencia financiera',
    experience_score: 95,
    experience_notes: 'Experiencia excepcional en construcción',
    final_score: 90.67,
    evaluation_date: '2024-02-20',
    valid_until: '2025-02-20',
    evaluator_id: '550e8400-e29b-41d4-a716-446655440001',
    created_at: '2024-02-20T09:00:00Z',
    updated_at: '2024-02-20T09:00:00Z'
  },
  {
    id: 'admin-eval-3',
    supplier_id: 'supplier-4',
    company_id: '550e8400-e29b-41d4-a716-446655440000',
    documentation_score: 78,
    documentation_notes: 'Documentación básica pero suficiente',
    financial_score: 82,
    financial_notes: 'Situación financiera estable',
    experience_score: 85,
    experience_notes: 'Buena experiencia en consultoría',
    final_score: 81.67,
    evaluation_date: '2024-01-30',
    valid_until: '2025-01-30',
    evaluator_id: '550e8400-e29b-41d4-a716-446655440001',
    created_at: '2024-01-30T11:00:00Z',
    updated_at: '2024-01-30T11:00:00Z'
  }
]

export const mockTechnicalEvaluationsData = [
  {
    id: 'tech-eval-1',
    licitacion_id: 'LIC-2025-001',
    supplier_id: 'supplier-1',
    company_id: '550e8400-e29b-41d4-a716-446655440000',
    risk_prevention_score: 88,
    risk_prevention_notes: 'Excelente plan de prevención de riesgos',
    technical_proposal_score: 92,
    technical_proposal_notes: 'Propuesta técnica muy sólida',
    final_score: 90.0,
    evaluator_id: '550e8400-e29b-41d4-a716-446655440001',
    created_at: '2024-12-20T14:00:00Z',
    updated_at: '2024-12-20T14:00:00Z'
  },
  {
    id: 'tech-eval-2',
    licitacion_id: 'LIC-2025-001',
    supplier_id: 'supplier-2',
    company_id: '550e8400-e29b-41d4-a716-446655440000',
    risk_prevention_score: 85,
    risk_prevention_notes: 'Buen plan de prevención',
    technical_proposal_score: 87,
    technical_proposal_notes: 'Propuesta técnica adecuada',
    final_score: 86.0,
    evaluator_id: '550e8400-e29b-41d4-a716-446655440001',
    created_at: '2024-12-21T10:00:00Z',
    updated_at: '2024-12-21T10:00:00Z'
  },
  {
    id: 'tech-eval-3',
    licitacion_id: 'LIC-2024-045',
    supplier_id: 'supplier-4',
    company_id: '550e8400-e29b-41d4-a716-446655440000',
    risk_prevention_score: 90,
    risk_prevention_notes: 'Plan de riesgos muy completo',
    technical_proposal_score: 88,
    technical_proposal_notes: 'Propuesta técnica bien estructurada',
    final_score: 89.0,
    evaluator_id: '550e8400-e29b-41d4-a716-446655440001',
    created_at: '2024-11-15T16:00:00Z',
    updated_at: '2024-11-15T16:00:00Z'
  }
]

export const mockLicitacionWeightingsData = [
  {
    id: 'weight-1',
    licitacion_id: 'LIC-2025-001',
    company_id: '550e8400-e29b-41d4-a716-446655440000',
    administrative_weight: 0.4,
    technical_weight: 0.6,
    created_at: '2024-12-15T10:00:00Z',
    updated_at: '2024-12-15T10:00:00Z'
  },
  {
    id: 'weight-2',
    licitacion_id: 'LIC-2024-045',
    company_id: '550e8400-e29b-41d4-a716-446655440000',
    administrative_weight: 0.3,
    technical_weight: 0.7,
    created_at: '2024-10-19T09:00:00Z',
    updated_at: '2024-10-19T09:00:00Z'
  }
]

export const mockLicitacionSuppliersData = [
  {
    id: 'lic-supplier-1',
    licitacion_id: 'LIC-2025-001',
    supplier_id: 'supplier-1',
    company_id: '550e8400-e29b-41d4-a716-446655440000',
    status: 'evaluated',
    administrative_score: 87.67,
    technical_score: 90.0,
    final_weighted_score: 89.07,
    registered_at: '2024-12-15T10:00:00Z',
    updated_at: '2024-12-20T14:00:00Z'
  },
  {
    id: 'lic-supplier-2',
    licitacion_id: 'LIC-2025-001',
    supplier_id: 'supplier-2',
    company_id: '550e8400-e29b-41d4-a716-446655440000',
    status: 'evaluated',
    administrative_score: 90.67,
    technical_score: 86.0,
    final_weighted_score: 87.87,
    registered_at: '2024-12-15T10:00:00Z',
    updated_at: '2024-12-21T10:00:00Z'
  },
  {
    id: 'lic-supplier-3',
    licitacion_id: 'LIC-2024-045',
    supplier_id: 'supplier-4',
    company_id: '550e8400-e29b-41d4-a716-446655440000',
    status: 'awarded',
    administrative_score: 81.67,
    technical_score: 89.0,
    final_weighted_score: 86.80,
    registered_at: '2024-10-19T09:00:00Z',
    updated_at: '2024-11-20T15:00:00Z'
  }
]

// Datos adicionales para gráficos
export const mockChartData = {
  monthlyTrend: [
    { month: 'Ene', gastos: 180000, ahorros: 25000, proyectos: 3 },
    { month: 'Feb', gastos: 220000, ahorros: 35000, proyectos: 4 },
    { month: 'Mar', gastos: 195000, ahorros: 40000, proyectos: 5 },
    { month: 'Abr', gastos: 250000, ahorros: 30000, proyectos: 6 },
    { month: 'May', gastos: 210000, ahorros: 45000, proyectos: 7 },
    { month: 'Jun', gastos: 180000, ahorros: 50000, proyectos: 8 },
    { month: 'Jul', gastos: 230000, ahorros: 35000, proyectos: 9 },
    { month: 'Ago', gastos: 200000, ahorros: 40000, proyectos: 10 },
    { month: 'Sep', gastos: 240000, ahorros: 30000, proyectos: 11 },
    { month: 'Oct', gastos: 190000, ahorros: 55000, proyectos: 12 },
    { month: 'Nov', gastos: 220000, ahorros: 40000, proyectos: 12 },
    { month: 'Dic', gastos: 180000, ahorros: 60000, proyectos: 12 }
  ],

  projectEvolution: [
    { month: 'Ene', activos: 2, completados: 1, enPausa: 0 },
    { month: 'Feb', activos: 3, completados: 1, enPausa: 1 },
    { month: 'Mar', activos: 4, completados: 2, enPausa: 1 },
    { month: 'Abr', activos: 5, completados: 2, enPausa: 1 },
    { month: 'May', activos: 6, completados: 3, enPausa: 1 },
    { month: 'Jun', activos: 7, completados: 3, enPausa: 1 },
    { month: 'Jul', activos: 8, completados: 4, enPausa: 1 },
    { month: 'Ago', activos: 9, completados: 4, enPausa: 1 },
    { month: 'Sep', activos: 10, completados: 5, enPausa: 1 },
    { month: 'Oct', activos: 11, completados: 5, enPausa: 1 },
    { month: 'Nov', activos: 12, completados: 6, enPausa: 1 },
    { month: 'Dic', activos: 12, completados: 6, enPausa: 1 }
  ],

  savingsByProject: [
    { project: 'Modernización IT', ahorro: 75000, presupuesto: 500000 },
    { project: 'Optimización Proveedores', ahorro: 5000, presupuesto: 200000 },
    { project: 'Implementación ERP', ahorro: 120000, presupuesto: 800000 },
    { project: 'Renovación Contratos', ahorro: 25000, presupuesto: 300000 },
    { project: 'Análisis de Mercado', ahorro: 15000, presupuesto: 150000 }
  ]
}

// ===== MOCK DATA PARA SOURCING PLAN =====
export const mockSourcingPlansData = [
  // ===== AÑO 2025 - Q1 =====
  {
    id: 'sp-2025-q1-001',
    company_id: 'company-1',
    plan_year: 2025,
    quarter: 'Q1',
    initiative_type: 'licitacion',
    title: 'Renovación Servicios Cloud Computing',
    description: 'Renovación y optimización de servicios de cloud (AWS, Azure)',
    category: 'Tecnología',
    estimated_spend: 350000,
    currency: 'USD',
    projected_savings_percentage: 15,
    projected_savings_amount: 52500,
    current_suppliers: [
      { id: 'supp-1', name: 'AWS' },
      { id: 'supp-2', name: 'Microsoft Azure' }
    ],
    status: 'completed',
    actual_spend: 315000,
    actual_savings_amount: 35000,
    actual_savings_percentage: 10,
    is_spot: false,
    planned_start_date: '2025-01-15',
    planned_end_date: '2025-03-31',
    actual_start_date: '2025-01-20',
    actual_completion_date: '2025-03-25',
    responsible_user_id: 'user-1',
    created_by: 'user-1',
    notes: 'Completado exitosamente. Ahorro menor al proyectado por cambios en requerimientos.',
    created_at: '2024-11-01T10:00:00Z',
    updated_at: '2025-03-25T15:30:00Z'
  },
  {
    id: 'sp-2025-q1-002',
    company_id: 'company-1',
    plan_year: 2025,
    quarter: 'Q1',
    initiative_type: 'project',
    title: 'Consolidación de Proveedores de Limpieza',
    description: 'Consolidar múltiples proveedores de limpieza en contrato marco',
    category: 'Servicios Profesionales',
    estimated_spend: 120000,
    currency: 'USD',
    projected_savings_percentage: 20,
    projected_savings_amount: 24000,
    current_suppliers: [
      { id: 'supp-3', name: 'CleanCo' },
      { id: 'supp-4', name: 'Facilities Plus' }
    ],
    status: 'in_progress',
    actual_start_date: '2025-02-01',
    is_spot: false,
    planned_start_date: '2025-02-01',
    planned_end_date: '2025-03-31',
    responsible_user_id: 'user-2',
    created_by: 'user-1',
    notes: 'En proceso de negociación. Avance 70%',
    created_at: '2024-11-01T10:00:00Z',
    updated_at: '2025-03-15T10:00:00Z'
  },

  // ===== AÑO 2025 - Q2 =====
  {
    id: 'sp-2025-q2-001',
    company_id: 'company-1',
    plan_year: 2025,
    quarter: 'Q2',
    initiative_type: 'licitacion',
    title: 'Licitación Seguros Corporativos',
    description: 'Renovación de pólizas de seguros corporativos',
    category: 'Seguros',
    estimated_spend: 280000,
    currency: 'USD',
    projected_savings_percentage: 12,
    projected_savings_amount: 33600,
    current_suppliers: [
      { id: 'supp-5', name: 'Seguros Generales S.A.' }
    ],
    status: 'planned',
    is_spot: false,
    planned_start_date: '2025-04-01',
    planned_end_date: '2025-06-30',
    responsible_user_id: 'user-3',
    created_by: 'user-1',
    notes: 'Pendiente de inicio. Preparación de bases técnicas.',
    created_at: '2024-12-01T10:00:00Z',
    updated_at: '2024-12-01T10:00:00Z'
  },
  {
    id: 'sp-2025-q2-002',
    company_id: 'company-1',
    plan_year: 2025,
    quarter: 'Q2',
    initiative_type: 'licitacion',
    title: 'Renovación Flota Vehículos',
    description: 'Licitación para renovación de flota de vehículos corporativos',
    category: 'Vehículos',
    estimated_spend: 450000,
    currency: 'USD',
    projected_savings_percentage: 8,
    projected_savings_amount: 36000,
    current_suppliers: [
      { id: 'supp-6', name: 'Automotriz Premium' }
    ],
    status: 'planned',
    is_spot: false,
    planned_start_date: '2025-05-01',
    planned_end_date: '2025-06-30',
    responsible_user_id: 'user-2',
    created_by: 'user-1',
    notes: 'Alta prioridad para Q2.',
    created_at: '2024-12-01T10:00:00Z',
    updated_at: '2024-12-01T10:00:00Z'
  },
  {
    id: 'sp-2025-q2-003',
    company_id: 'company-1',
    plan_year: 2025,
    quarter: 'Q2',
    initiative_type: 'project',
    title: 'Optimización Gastos Marketing Digital',
    description: 'Renegociación con proveedores de marketing digital',
    category: 'Marketing',
    estimated_spend: 180000,
    currency: 'USD',
    projected_savings_percentage: 18,
    projected_savings_amount: 32400,
    current_suppliers: [
      { id: 'supp-7', name: 'Digital Agency Pro' },
      { id: 'supp-8', name: 'Social Media Experts' }
    ],
    status: 'planned',
    is_spot: false,
    planned_start_date: '2025-04-15',
    planned_end_date: '2025-06-15',
    responsible_user_id: 'user-3',
    created_by: 'user-1',
    created_at: '2024-12-01T10:00:00Z',
    updated_at: '2024-12-01T10:00:00Z'
  },

  // ===== AÑO 2025 - Q3 =====
  {
    id: 'sp-2025-q3-001',
    company_id: 'company-1',
    plan_year: 2025,
    quarter: 'Q3',
    initiative_type: 'licitacion',
    title: 'Renovación Licencias Software',
    description: 'Renovación de licencias Microsoft, Adobe, etc.',
    category: 'Tecnología',
    estimated_spend: 220000,
    currency: 'USD',
    projected_savings_percentage: 10,
    projected_savings_amount: 22000,
    current_suppliers: [
      { id: 'supp-9', name: 'Microsoft' },
      { id: 'supp-10', name: 'Adobe Systems' }
    ],
    status: 'planned',
    is_spot: false,
    planned_start_date: '2025-07-01',
    planned_end_date: '2025-09-30',
    responsible_user_id: 'user-1',
    created_by: 'user-1',
    created_at: '2024-12-15T10:00:00Z',
    updated_at: '2024-12-15T10:00:00Z'
  },
  {
    id: 'sp-2025-q3-002',
    company_id: 'company-1',
    plan_year: 2025,
    quarter: 'Q3',
    initiative_type: 'project',
    title: 'Consolidación Servicios TI',
    description: 'Integración de múltiples contratos de soporte TI',
    category: 'Tecnología',
    estimated_spend: 380000,
    currency: 'USD',
    projected_savings_percentage: 22,
    projected_savings_amount: 83600,
    status: 'planned',
    is_spot: false,
    planned_start_date: '2025-08-01',
    planned_end_date: '2025-09-30',
    responsible_user_id: 'user-2',
    created_by: 'user-1',
    created_at: '2024-12-15T10:00:00Z',
    updated_at: '2024-12-15T10:00:00Z'
  },

  // ===== AÑO 2025 - Q4 =====
  {
    id: 'sp-2025-q4-001',
    company_id: 'company-1',
    plan_year: 2025,
    quarter: 'Q4',
    initiative_type: 'licitacion',
    title: 'Suministros de Oficina 2026',
    description: 'Licitación anual de suministros y materiales de oficina',
    category: 'Suministros',
    estimated_spend: 95000,
    currency: 'USD',
    projected_savings_percentage: 15,
    projected_savings_amount: 14250,
    status: 'planned',
    is_spot: false,
    planned_start_date: '2025-10-01',
    planned_end_date: '2025-12-15',
    responsible_user_id: 'user-3',
    created_by: 'user-1',
    created_at: '2025-01-10T10:00:00Z',
    updated_at: '2025-01-10T10:00:00Z'
  },

  // ===== INICIATIVAS SPOT (No planificadas) =====
  {
    id: 'sp-spot-001',
    company_id: 'company-1',
    plan_year: 2025,
    quarter: 'Q1',
    initiative_type: 'licitacion',
    title: 'Reparación Urgente Infraestructura',
    description: 'Licitación spot para reparaciones urgentes',
    category: 'Infraestructura',
    estimated_spend: 85000,
    currency: 'USD',
    projected_savings_percentage: 0,
    projected_savings_amount: 0,
    status: 'completed',
    actual_spend: 82000,
    actual_savings_amount: 3000,
    actual_savings_percentage: 3.5,
    is_spot: true,
    actual_start_date: '2025-01-10',
    actual_completion_date: '2025-02-28',
    responsible_user_id: 'user-2',
    created_by: 'user-2',
    notes: 'Iniciativa no planificada por necesidad urgente.',
    created_at: '2025-01-10T08:00:00Z',
    updated_at: '2025-02-28T16:00:00Z'
  },

  // ===== AÑO 2024 (Histórico) =====
  {
    id: 'sp-2024-q4-001',
    company_id: 'company-1',
    plan_year: 2024,
    quarter: 'Q4',
    initiative_type: 'licitacion',
    title: 'Servicios de Seguridad 2025',
    description: 'Licitación de servicios de seguridad para el año 2025',
    category: 'Servicios Profesionales',
    estimated_spend: 240000,
    currency: 'USD',
    projected_savings_percentage: 18,
    projected_savings_amount: 43200,
    status: 'completed',
    actual_spend: 205000,
    actual_savings_amount: 35000,
    actual_savings_percentage: 14.6,
    is_spot: false,
    planned_start_date: '2024-10-01',
    planned_end_date: '2024-12-15',
    actual_start_date: '2024-10-05',
    actual_completion_date: '2024-12-10',
    responsible_user_id: 'user-1',
    created_by: 'user-1',
    notes: 'Completado exitosamente. Buenos resultados.',
    created_at: '2024-08-01T10:00:00Z',
    updated_at: '2024-12-10T17:00:00Z'
  },
  {
    id: 'sp-2024-q3-001',
    company_id: 'company-1',
    plan_year: 2024,
    quarter: 'Q3',
    initiative_type: 'project',
    title: 'Modernización Infraestructura IT',
    description: 'Proyecto de actualización de infraestructura tecnológica',
    category: 'Tecnología',
    estimated_spend: 500000,
    currency: 'USD',
    projected_savings_percentage: 25,
    projected_savings_amount: 125000,
    status: 'completed',
    actual_spend: 420000,
    actual_savings_amount: 80000,
    actual_savings_percentage: 16,
    is_spot: false,
    planned_start_date: '2024-07-01',
    planned_end_date: '2024-09-30',
    actual_start_date: '2024-07-10',
    actual_completion_date: '2024-09-25',
    responsible_user_id: 'user-2',
    created_by: 'user-1',
    notes: 'Proyecto estratégico completado con éxito.',
    created_at: '2024-05-01T10:00:00Z',
    updated_at: '2024-09-25T18:00:00Z'
  }
]

// Estadísticas calculadas del Sourcing Plan
export const mockSourcingPlanStats = {
  year: 2025,
  total_planned: 9,
  total_completed: 1,
  total_in_progress: 1,
  total_cancelled: 0,
  total_spot: 1,

  total_estimated_spend: 2165000,
  total_actual_spend: 315000,
  total_projected_savings: 300350,
  total_actual_savings: 35000,

  completion_rate: 11.1, // 1 de 9
  savings_achievement_rate: 66.7, // 35000 de 52500 proyectado

  by_quarter: [
    {
      quarter: 'Q1',
      planned: 2,
      completed: 1,
      projected_savings: 76500,
      actual_savings: 35000,
      achievement_rate: 45.8
    },
    {
      quarter: 'Q2',
      planned: 3,
      completed: 0,
      projected_savings: 102000,
      actual_savings: 0,
      achievement_rate: 0
    },
    {
      quarter: 'Q3',
      planned: 2,
      completed: 0,
      projected_savings: 105600,
      actual_savings: 0,
      achievement_rate: 0
    },
    {
      quarter: 'Q4',
      planned: 1,
      completed: 0,
      projected_savings: 14250,
      actual_savings: 0,
      achievement_rate: 0
    }
  ],

  by_type: [
    {
      type: 'licitacion',
      count: 6,
      projected_savings: 192350,
      actual_savings: 35000
    },
    {
      type: 'project',
      count: 3,
      projected_savings: 140000,
      actual_savings: 0
    }
  ]
}
