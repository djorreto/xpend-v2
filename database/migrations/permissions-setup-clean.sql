-- ============================================================================
-- PERMISSIONS SYSTEM - CLEAN SETUP
-- ============================================================================
-- Script limpio para crear el sistema de permisos desde cero
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- 1. CREAR TABLAS
-- ============================================================================

-- Tabla de permisos
CREATE TABLE permissions (
  id TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  PRIMARY KEY (id, company_id)
);

-- Tabla de permisos por rol
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'analyst', 'viewer')),
  permission_id TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (company_id, role, permission_id)
);

-- 2. CREAR ÍNDICES
-- ============================================================================

CREATE INDEX idx_permissions_company ON permissions(company_id);
CREATE INDEX idx_permissions_category ON permissions(category);
CREATE INDEX idx_role_permissions_company ON role_permissions(company_id);
CREATE INDEX idx_role_permissions_role ON role_permissions(role);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

-- 3. COMENTARIOS
-- ============================================================================

COMMENT ON TABLE permissions IS 'Definición de permisos disponibles en el sistema';
COMMENT ON TABLE role_permissions IS 'Matriz de permisos por rol de usuario';
COMMENT ON COLUMN permissions.category IS 'Categoría del permiso (ej: Dashboard, Licitaciones, etc.)';
COMMENT ON COLUMN role_permissions.granted IS 'True si el rol tiene el permiso, false si no';

-- 4. TRIGGERS
-- ============================================================================

-- Función para updated_at (si no existe)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER trigger_update_permissions_updated_at
  BEFORE UPDATE ON permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_role_permissions_updated_at
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. RLS
-- ============================================================================

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Policies para permissions
CREATE POLICY "Users can view permissions from their company"
  ON permissions FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Only admins can manage permissions"
  ON permissions FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policies para role_permissions
CREATE POLICY "Users can view role permissions from their company"
  ON role_permissions FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Only admins can manage role permissions"
  ON role_permissions FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 6. INSERTAR PERMISOS POR DEFECTO
-- ============================================================================

INSERT INTO permissions (id, company_id, name, description, category)
SELECT
  p.id,
  c.id as company_id,
  p.name,
  p.description,
  p.category
FROM companies c
CROSS JOIN (
  SELECT 'dashboard_view' as id, 'Ver Dashboard' as name, 'Acceso al dashboard principal' as description, 'Dashboard' as category
  UNION ALL SELECT 'sourcing_plan_view', 'Ver Sourcing Plan', 'Ver el plan de sourcing', 'Sourcing Plan'
  UNION ALL SELECT 'sourcing_plan_create', 'Crear Iniciativas', 'Crear nuevas iniciativas en el plan', 'Sourcing Plan'
  UNION ALL SELECT 'sourcing_plan_edit', 'Editar Iniciativas', 'Modificar iniciativas existentes', 'Sourcing Plan'
  UNION ALL SELECT 'sourcing_plan_delete', 'Eliminar Iniciativas', 'Eliminar iniciativas del plan', 'Sourcing Plan'
  UNION ALL SELECT 'sourcing_plan_export', 'Exportar Plan', 'Exportar el plan a CSV/Excel', 'Sourcing Plan'
  UNION ALL SELECT 'licitaciones_view', 'Ver Licitaciones', 'Ver lista de licitaciones', 'Licitaciones'
  UNION ALL SELECT 'licitaciones_create', 'Crear Licitaciones', 'Crear nuevas licitaciones', 'Licitaciones'
  UNION ALL SELECT 'licitaciones_edit', 'Editar Licitaciones', 'Modificar licitaciones existentes', 'Licitaciones'
  UNION ALL SELECT 'licitaciones_delete', 'Eliminar Licitaciones', 'Eliminar licitaciones', 'Licitaciones'
  UNION ALL SELECT 'projects_view', 'Ver Proyectos', 'Ver lista de proyectos', 'Proyectos'
  UNION ALL SELECT 'projects_create', 'Crear Proyectos', 'Crear nuevos proyectos', 'Proyectos'
  UNION ALL SELECT 'projects_edit', 'Editar Proyectos', 'Modificar proyectos existentes', 'Proyectos'
  UNION ALL SELECT 'projects_delete', 'Eliminar Proyectos', 'Eliminar proyectos', 'Proyectos'
  UNION ALL SELECT 'suppliers_view', 'Ver Proveedores', 'Ver lista de proveedores', 'Proveedores'
  UNION ALL SELECT 'suppliers_create', 'Crear Proveedores', 'Crear nuevos proveedores', 'Proveedores'
  UNION ALL SELECT 'suppliers_edit', 'Editar Proveedores', 'Modificar proveedores existentes', 'Proveedores'
  UNION ALL SELECT 'suppliers_delete', 'Eliminar Proveedores', 'Eliminar proveedores', 'Proveedores'
  UNION ALL SELECT 'reports_view', 'Ver Reportes', 'Acceso a reportes y análisis', 'Reportes'
  UNION ALL SELECT 'reports_export', 'Exportar Reportes', 'Exportar reportes a PDF/Excel', 'Reportes'
  UNION ALL SELECT 'users_view', 'Ver Usuarios', 'Ver lista de usuarios', 'Usuarios'
  UNION ALL SELECT 'users_create', 'Crear Usuarios', 'Invitar nuevos usuarios', 'Usuarios'
  UNION ALL SELECT 'users_edit', 'Editar Usuarios', 'Modificar usuarios existentes', 'Usuarios'
  UNION ALL SELECT 'users_delete', 'Eliminar Usuarios', 'Eliminar usuarios', 'Usuarios'
  UNION ALL SELECT 'settings_view', 'Ver Configuración', 'Acceso a configuración', 'Configuración'
  UNION ALL SELECT 'settings_edit', 'Editar Configuración', 'Modificar configuración', 'Configuración'
  UNION ALL SELECT 'permissions_edit', 'Gestionar Permisos', 'Modificar permisos de roles', 'Configuración'
) p;

-- 7. INSERTAR PERMISOS DE ROLES
-- ============================================================================

INSERT INTO role_permissions (company_id, role, permission_id, granted)
SELECT
  c.id as company_id,
  r.role,
  p.id as permission_id,
  CASE
    -- Admin tiene todos los permisos
    WHEN r.role = 'admin' THEN true

    -- Manager puede ver, crear y editar (no eliminar)
    WHEN r.role = 'manager' AND p.id IN (
      'dashboard_view',
      'sourcing_plan_view', 'sourcing_plan_create', 'sourcing_plan_edit', 'sourcing_plan_export',
      'licitaciones_view', 'licitaciones_create', 'licitaciones_edit',
      'projects_view', 'projects_create', 'projects_edit',
      'suppliers_view', 'suppliers_create', 'suppliers_edit',
      'reports_view', 'reports_export',
      'users_view', 'users_create', 'users_edit',
      'settings_view'
    ) THEN true

    -- Analyst puede ver, crear y editar (no eliminar, no usuarios)
    WHEN r.role = 'analyst' AND p.id IN (
      'dashboard_view',
      'sourcing_plan_view', 'sourcing_plan_create', 'sourcing_plan_edit',
      'licitaciones_view', 'licitaciones_create', 'licitaciones_edit',
      'projects_view', 'projects_create', 'projects_edit',
      'suppliers_view', 'suppliers_create', 'suppliers_edit',
      'reports_view', 'reports_export'
    ) THEN true

    -- Viewer solo puede ver
    WHEN r.role = 'viewer' AND p.id IN (
      'dashboard_view',
      'sourcing_plan_view',
      'licitaciones_view',
      'projects_view',
      'suppliers_view',
      'reports_view'
    ) THEN true

    ELSE false
  END as granted
FROM companies c
CROSS JOIN (
  SELECT 'admin' as role
  UNION ALL SELECT 'manager'
  UNION ALL SELECT 'analyst'
  UNION ALL SELECT 'viewer'
) r
CROSS JOIN permissions p
WHERE p.company_id = c.id;

-- 8. VERIFICACIÓN
-- ============================================================================

SELECT
  'PERMISOS CREADOS' as tipo,
  COUNT(*) as cantidad
FROM permissions
UNION ALL
SELECT
  'PERMISOS DE ROLES CREADOS' as tipo,
  COUNT(*) as cantidad
FROM role_permissions;

-- ============================================================================
-- ✅ SETUP COMPLETO
-- ============================================================================
