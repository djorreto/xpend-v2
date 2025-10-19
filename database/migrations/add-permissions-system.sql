-- ============================================================================
-- PERMISSIONS SYSTEM
-- ============================================================================
-- Sistema de permisos granular para roles de usuario
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- 1. TABLA PERMISSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_permission_per_company UNIQUE (id, company_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_permissions_company ON permissions(company_id);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);

-- Comentarios
COMMENT ON TABLE permissions IS 'Definición de permisos disponibles en el sistema';
COMMENT ON COLUMN permissions.category IS 'Categoría del permiso (ej: Dashboard, Licitaciones, etc.)';

-- ============================================================================
-- 2. TABLA ROLE_PERMISSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'analyst', 'viewer')),
  permission_id TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_role_permission UNIQUE (company_id, role, permission_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_company ON role_permissions(company_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

-- Comentarios
COMMENT ON TABLE role_permissions IS 'Matriz de permisos por rol de usuario';
COMMENT ON COLUMN role_permissions.granted IS 'True si el rol tiene el permiso, false si no';

-- ============================================================================
-- 3. TRIGGERS
-- ============================================================================

-- Trigger para actualizar updated_at en permissions
DROP TRIGGER IF EXISTS trigger_update_permissions_updated_at ON permissions;
CREATE TRIGGER trigger_update_permissions_updated_at
  BEFORE UPDATE ON permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para actualizar updated_at en role_permissions
DROP TRIGGER IF EXISTS trigger_update_role_permissions_updated_at ON role_permissions;
CREATE TRIGGER trigger_update_role_permissions_updated_at
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Policies para permissions
DROP POLICY IF EXISTS "Users can view permissions from their company" ON permissions;
CREATE POLICY "Users can view permissions from their company"
  ON permissions FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Only admins can manage permissions" ON permissions;
CREATE POLICY "Only admins can manage permissions"
  ON permissions FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policies para role_permissions
DROP POLICY IF EXISTS "Users can view role permissions from their company" ON role_permissions;
CREATE POLICY "Users can view role permissions from their company"
  ON role_permissions FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Only admins can manage role permissions" ON role_permissions;
CREATE POLICY "Only admins can manage role permissions"
  ON role_permissions FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- 5. PERMISOS POR DEFECTO
-- ============================================================================

-- Insertar permisos por defecto para todas las empresas existentes
INSERT INTO permissions (id, company_id, name, description, category)
SELECT 
  permission_id,
  c.id as company_id,
  permission_name,
  permission_description,
  permission_category
FROM companies c
CROSS JOIN (
  VALUES 
    -- Dashboard
    ('dashboard_view', 'Ver Dashboard', 'Acceso al dashboard principal', 'Dashboard'),
    
    -- Sourcing Plan
    ('sourcing_plan_view', 'Ver Sourcing Plan', 'Ver el plan de sourcing', 'Sourcing Plan'),
    ('sourcing_plan_create', 'Crear Iniciativas', 'Crear nuevas iniciativas en el plan', 'Sourcing Plan'),
    ('sourcing_plan_edit', 'Editar Iniciativas', 'Modificar iniciativas existentes', 'Sourcing Plan'),
    ('sourcing_plan_delete', 'Eliminar Iniciativas', 'Eliminar iniciativas del plan', 'Sourcing Plan'),
    ('sourcing_plan_export', 'Exportar Plan', 'Exportar el plan a CSV/Excel', 'Sourcing Plan'),
    
    -- Licitaciones
    ('licitaciones_view', 'Ver Licitaciones', 'Ver lista de licitaciones', 'Licitaciones'),
    ('licitaciones_create', 'Crear Licitaciones', 'Crear nuevas licitaciones', 'Licitaciones'),
    ('licitaciones_edit', 'Editar Licitaciones', 'Modificar licitaciones existentes', 'Licitaciones'),
    ('licitaciones_delete', 'Eliminar Licitaciones', 'Eliminar licitaciones', 'Licitaciones'),
    
    -- Proyectos
    ('projects_view', 'Ver Proyectos', 'Ver lista de proyectos', 'Proyectos'),
    ('projects_create', 'Crear Proyectos', 'Crear nuevos proyectos', 'Proyectos'),
    ('projects_edit', 'Editar Proyectos', 'Modificar proyectos existentes', 'Proyectos'),
    ('projects_delete', 'Eliminar Proyectos', 'Eliminar proyectos', 'Proyectos'),
    
    -- Proveedores
    ('suppliers_view', 'Ver Proveedores', 'Ver lista de proveedores', 'Proveedores'),
    ('suppliers_create', 'Crear Proveedores', 'Crear nuevos proveedores', 'Proveedores'),
    ('suppliers_edit', 'Editar Proveedores', 'Modificar proveedores existentes', 'Proveedores'),
    ('suppliers_delete', 'Eliminar Proveedores', 'Eliminar proveedores', 'Proveedores'),
    
    -- Reportes
    ('reports_view', 'Ver Reportes', 'Acceso a reportes y análisis', 'Reportes'),
    ('reports_export', 'Exportar Reportes', 'Exportar reportes a PDF/Excel', 'Reportes'),
    
    -- Usuarios
    ('users_view', 'Ver Usuarios', 'Ver lista de usuarios', 'Usuarios'),
    ('users_create', 'Crear Usuarios', 'Invitar nuevos usuarios', 'Usuarios'),
    ('users_edit', 'Editar Usuarios', 'Modificar usuarios existentes', 'Usuarios'),
    ('users_delete', 'Eliminar Usuarios', 'Eliminar usuarios', 'Usuarios'),
    
    -- Configuración
    ('settings_view', 'Ver Configuración', 'Acceso a configuración', 'Configuración'),
    ('settings_edit', 'Editar Configuración', 'Modificar configuración', 'Configuración'),
    ('permissions_edit', 'Gestionar Permisos', 'Modificar permisos de roles', 'Configuración')
) AS permissions(permission_id, permission_name, permission_description, permission_category)
WHERE NOT EXISTS (
  SELECT 1 FROM permissions p 
  WHERE p.company_id = c.id AND p.id = permissions.permission_id
);

-- ============================================================================
-- 6. PERMISOS DE ROLES POR DEFECTO
-- ============================================================================

-- Insertar permisos por defecto para cada rol
INSERT INTO role_permissions (company_id, role, permission_id, granted)
SELECT 
  c.id as company_id,
  role_name,
  permission_id,
  CASE 
    WHEN role_name = 'admin' THEN true
    WHEN role_name = 'manager' AND permission_id IN (
      'dashboard_view',
      'sourcing_plan_view', 'sourcing_plan_create', 'sourcing_plan_edit', 'sourcing_plan_export',
      'licitaciones_view', 'licitaciones_create', 'licitaciones_edit',
      'projects_view', 'projects_create', 'projects_edit',
      'suppliers_view', 'suppliers_create', 'suppliers_edit',
      'reports_view', 'reports_export',
      'users_view', 'users_create', 'users_edit',
      'settings_view'
    ) THEN true
    WHEN role_name = 'analyst' AND permission_id IN (
      'dashboard_view',
      'sourcing_plan_view', 'sourcing_plan_create', 'sourcing_plan_edit',
      'licitaciones_view', 'licitaciones_create', 'licitaciones_edit',
      'projects_view', 'projects_create', 'projects_edit',
      'suppliers_view', 'suppliers_create', 'suppliers_edit',
      'reports_view', 'reports_export'
    ) THEN true
    WHEN role_name = 'viewer' AND permission_id IN (
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
CROSS JOIN (VALUES ('admin'), ('manager'), ('analyst'), ('viewer')) AS roles(role_name)
CROSS JOIN (
  SELECT DISTINCT id as permission_id FROM permissions WHERE company_id = c.id
) AS company_permissions
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.company_id = c.id 
  AND rp.role = role_name 
  AND rp.permission_id = company_permissions.permission_id
);

-- ============================================================================
-- 7. VERIFICACIÓN
-- ============================================================================

-- Verificar que las tablas se crearon correctamente
SELECT 
  'permissions' as table_name,
  COUNT(*) as permission_count
FROM permissions;

SELECT 
  'role_permissions' as table_name,
  COUNT(*) as role_permission_count
FROM role_permissions;

-- Verificar RLS
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('permissions', 'role_permissions');

-- ============================================================================
-- SETUP COMPLETO ✅
-- ============================================================================
-- El sistema de permisos está listo para usar
