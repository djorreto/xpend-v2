-- =====================================================
-- RFx MAKER - Schema de Base de Datos
-- Sistema de generación de Bases Administrativas y Técnicas
-- =====================================================

-- =====================================================
-- 1. PLANTILLAS ADMINISTRATIVAS (Templates)
-- =====================================================

CREATE TABLE IF NOT EXISTS rfx_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Metadatos
  name VARCHAR(255) NOT NULL,
  description TEXT,
  language VARCHAR(10) DEFAULT 'es-CL',
  status VARCHAR(50) DEFAULT 'draft', -- draft, active, archived

  -- Contenido (HTML/Texto enriquecido con placeholders)
  template_structure TEXT NOT NULL, -- Contenido con {{placeholders}}
  placeholder_definitions JSONB DEFAULT '[]', -- Definiciones de placeholders (alternativa a tabla separada)

  -- Configuración
  include_toc BOOLEAN DEFAULT true,
  auto_numbering BOOLEAN DEFAULT true,
  branding_settings JSONB DEFAULT '{}', -- colores, logos, fonts

  -- Versionado
  version_number INTEGER DEFAULT 1,
  is_active_version BOOLEAN DEFAULT false,
  parent_template_id UUID REFERENCES rfx_templates(id),

  -- Auditoría
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rfx_templates_company ON rfx_templates(company_id);
CREATE INDEX idx_rfx_templates_status ON rfx_templates(status);
CREATE INDEX idx_rfx_templates_active ON rfx_templates(is_active_version) WHERE is_active_version = true;

-- Unique index para garantizar solo una plantilla activa por empresa
CREATE UNIQUE INDEX idx_rfx_templates_unique_active_per_company
  ON rfx_templates(company_id)
  WHERE is_active_version = true;

-- =====================================================
-- 2. VARIABLES/PLACEHOLDERS (Template Variables)
-- =====================================================

CREATE TABLE IF NOT EXISTS rfx_template_variables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES rfx_templates(id) ON DELETE CASCADE,

  -- Definición de variable
  field_key VARCHAR(100) NOT NULL, -- ej: "currency", "performance_bond_percent"
  label VARCHAR(255) NOT NULL,
  help_text TEXT,
  variable_group VARCHAR(100), -- Moneda, Garantías, Plazos, etc.

  -- Tipo y validación
  field_type VARCHAR(50) NOT NULL, -- text, number, enum, bool, date
  default_value TEXT,
  validation_rules JSONB DEFAULT '{}', -- {min, max, regex, allowed_values}

  -- Permisos
  editable_by VARCHAR(50) DEFAULT 'user', -- admin, user, both
  required BOOLEAN DEFAULT false,

  -- Orden de visualización
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_field_key_per_template UNIQUE(template_id, field_key)
);

CREATE INDEX idx_rfx_template_variables_template ON rfx_template_variables(template_id);

-- =====================================================
-- 3. POLÍTICAS ADMINISTRATIVAS (Company Policies)
-- =====================================================

CREATE TABLE IF NOT EXISTS rfx_company_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_id UUID REFERENCES rfx_templates(id),

  -- Metadatos
  policy_name VARCHAR(255) DEFAULT 'Política por Defecto',
  description TEXT,

  -- Snapshot de valores por defecto
  policy_values JSONB NOT NULL DEFAULT '{}', -- {field_key: value}

  -- Estado
  is_active BOOLEAN DEFAULT true,

  -- Auditoría
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rfx_company_policies_company ON rfx_company_policies(company_id);

-- Unique index para garantizar solo una política activa por empresa
CREATE UNIQUE INDEX idx_rfx_company_policies_unique_active
  ON rfx_company_policies(company_id)
  WHERE is_active = true;

-- =====================================================
-- 4. PROYECTOS DE BASES (RFx Projects)
-- =====================================================

CREATE TABLE IF NOT EXISTS rfx_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Metadatos del proyecto
  project_code VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  rfx_type VARCHAR(50) NOT NULL, -- RFP, RFQ, RFI

  -- Referencias
  template_id UUID NOT NULL REFERENCES rfx_templates(id),
  template_version_snapshot INTEGER NOT NULL,
  policy_snapshot JSONB NOT NULL DEFAULT '{}', -- Snapshot de política al crear

  -- Estado del proyecto
  status VARCHAR(50) DEFAULT 'draft', -- draft, ready, closed, archived

  -- Parámetros administrativos (pueden cambiar)
  admin_parameters JSONB NOT NULL DEFAULT '{}',
  admin_parameters_last_modified TIMESTAMPTZ,

  -- Base Técnica
  technical_base_content TEXT, -- HTML/Markdown generado por IA
  technical_base_generated_at TIMESTAMPTZ,
  technical_base_is_valid BOOLEAN DEFAULT false,
  technical_base_manually_edited BOOLEAN DEFAULT false,

  -- Contexto para IA
  project_context JSONB DEFAULT '{}', -- Info adicional para generar base técnica

  -- Versionado de documentos
  version_number INTEGER DEFAULT 1,
  parent_version_id UUID REFERENCES rfx_projects(id),

  -- Auditoría
  responsible_user_id UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);

CREATE INDEX idx_rfx_projects_company ON rfx_projects(company_id);
CREATE INDEX idx_rfx_projects_status ON rfx_projects(status);
CREATE INDEX idx_rfx_projects_responsible ON rfx_projects(responsible_user_id);
CREATE INDEX idx_rfx_projects_code ON rfx_projects(project_code);

-- =====================================================
-- 5. HISTORIAL DE VERSIONES (Version History)
-- =====================================================

CREATE TABLE IF NOT EXISTS rfx_project_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES rfx_projects(id) ON DELETE CASCADE,

  version_number INTEGER NOT NULL,
  snapshot_data JSONB NOT NULL, -- Snapshot completo del proyecto
  change_description TEXT,

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_version_per_project UNIQUE(project_id, version_number)
);

CREATE INDEX idx_rfx_project_versions_project ON rfx_project_versions(project_id);

-- =====================================================
-- 6. DESCARGAS Y EXPORTS (Download History)
-- =====================================================

CREATE TABLE IF NOT EXISTS rfx_project_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES rfx_projects(id) ON DELETE CASCADE,

  document_type VARCHAR(50) NOT NULL, -- admin_docx, admin_pdf, technical_docx, technical_pdf, full_zip
  file_size_bytes BIGINT,

  downloaded_by UUID REFERENCES profiles(id),
  downloaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rfx_project_downloads_project ON rfx_project_downloads(project_id);

-- =====================================================
-- 7. COMENTARIOS Y NOTAS (Comments)
-- =====================================================

CREATE TABLE IF NOT EXISTS rfx_project_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES rfx_projects(id) ON DELETE CASCADE,

  comment_text TEXT NOT NULL,
  section VARCHAR(100), -- admin, technical, general

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rfx_project_comments_project ON rfx_project_comments(project_id);

-- =====================================================
-- 8. AUDITORÍA DE CAMBIOS (Audit Log)
-- =====================================================

CREATE TABLE IF NOT EXISTS rfx_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  entity_type VARCHAR(50) NOT NULL, -- template, project, policy
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- created, updated, status_changed, generated, downloaded

  changes JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',

  performed_by UUID REFERENCES profiles(id),
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rfx_audit_log_entity ON rfx_audit_log(entity_type, entity_id);
CREATE INDEX idx_rfx_audit_log_performed_at ON rfx_audit_log(performed_at);

-- =====================================================
-- 9. FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_rfx_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_rfx_templates_updated_at
  BEFORE UPDATE ON rfx_templates
  FOR EACH ROW EXECUTE FUNCTION update_rfx_updated_at();

CREATE TRIGGER update_rfx_template_variables_updated_at
  BEFORE UPDATE ON rfx_template_variables
  FOR EACH ROW EXECUTE FUNCTION update_rfx_updated_at();

CREATE TRIGGER update_rfx_company_policies_updated_at
  BEFORE UPDATE ON rfx_company_policies
  FOR EACH ROW EXECUTE FUNCTION update_rfx_updated_at();

CREATE TRIGGER update_rfx_projects_updated_at
  BEFORE UPDATE ON rfx_projects
  FOR EACH ROW EXECUTE FUNCTION update_rfx_updated_at();

-- Función para invalidar base técnica cuando cambian parámetros administrativos
CREATE OR REPLACE FUNCTION invalidate_technical_base_on_params_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.admin_parameters IS DISTINCT FROM OLD.admin_parameters THEN
    NEW.technical_base_is_valid = false;
    NEW.admin_parameters_last_modified = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invalidate_technical_base
  BEFORE UPDATE ON rfx_projects
  FOR EACH ROW EXECUTE FUNCTION invalidate_technical_base_on_params_change();

-- =====================================================
-- 10. ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE rfx_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfx_template_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfx_company_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfx_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfx_project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfx_project_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfx_project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfx_audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas RLS básicas (ajustar según permisos existentes)

-- Templates: Solo admins pueden crear/editar, todos pueden ver activas
CREATE POLICY "Users can view active templates from their company"
  ON rfx_templates FOR SELECT
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage templates"
  ON rfx_templates FOR ALL
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- Projects: Usuarios pueden ver/editar proyectos de su company
CREATE POLICY "Users can view projects from their company"
  ON rfx_projects FOR SELECT
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create projects"
  ON rfx_projects FOR INSERT
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their company projects"
  ON rfx_projects FOR UPDATE
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE rfx_templates IS 'Plantillas administrativas con contenido HTML y placeholders';
COMMENT ON TABLE rfx_template_variables IS 'Variables/placeholders definidos en las plantillas';
COMMENT ON TABLE rfx_company_policies IS 'Políticas administrativas por defecto de cada empresa';
COMMENT ON TABLE rfx_projects IS 'Proyectos de Bases RFx con sus estados y contenidos';
COMMENT ON TABLE rfx_project_versions IS 'Historial de versiones de proyectos';
COMMENT ON TABLE rfx_audit_log IS 'Registro de auditoría de todas las acciones';

