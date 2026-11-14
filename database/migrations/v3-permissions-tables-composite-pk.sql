-- Matriz de permisos: PK compuesta (company_id, id) para que el mismo código exista por empresa
-- Compatible con src/components/forms/permissions-matrix.tsx (id = dashboard_view, etc.)

CREATE TABLE IF NOT EXISTS permissions (
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (company_id, id)
);

CREATE INDEX IF NOT EXISTS idx_permissions_company ON permissions(company_id);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'analyst', 'viewer')),
  permission_id TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_role_permission UNIQUE (company_id, role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_company ON role_permissions(company_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

ALTER TABLE role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_permission_fk;
ALTER TABLE role_permissions
  ADD CONSTRAINT role_permissions_permission_fk
  FOREIGN KEY (company_id, permission_id)
  REFERENCES permissions(company_id, id)
  ON DELETE CASCADE;

DROP TRIGGER IF EXISTS trigger_update_permissions_updated_at ON permissions;
CREATE TRIGGER trigger_update_permissions_updated_at
  BEFORE UPDATE ON permissions
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS trigger_update_role_permissions_updated_at ON role_permissions;
CREATE TRIGGER trigger_update_role_permissions_updated_at
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view permissions from their company" ON permissions;
CREATE POLICY "Users can view permissions from their company"
  ON permissions FOR SELECT
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage permissions" ON permissions;
CREATE POLICY "Admins can manage permissions"
  ON permissions FOR ALL
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Users can view role permissions from their company" ON role_permissions;
CREATE POLICY "Users can view role permissions from their company"
  ON role_permissions FOR SELECT
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage role permissions" ON role_permissions;
CREATE POLICY "Admins can manage role permissions"
  ON role_permissions FOR ALL
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

INSERT INTO permissions (company_id, id, name, description, category)
SELECT c.id, v.pid, v.pname, v.pdesc, v.pcat
FROM companies c
CROSS JOIN (
  VALUES
    ('dashboard_view', 'Ver Dashboard', 'Acceso al dashboard principal', 'Dashboard'),
    ('sourcing_plan_view', 'Ver Sourcing Plan', 'Ver el plan de sourcing', 'Sourcing Plan'),
    ('sourcing_plan_create', 'Crear Iniciativas', 'Crear nuevas iniciativas en el plan', 'Sourcing Plan'),
    ('sourcing_plan_edit', 'Editar Iniciativas', 'Modificar iniciativas existentes', 'Sourcing Plan'),
    ('sourcing_plan_delete', 'Eliminar Iniciativas', 'Eliminar iniciativas del plan', 'Sourcing Plan'),
    ('sourcing_plan_export', 'Exportar Plan', 'Exportar el plan a CSV/Excel', 'Sourcing Plan'),
    ('licitaciones_view', 'Ver Licitaciones', 'Ver lista de licitaciones', 'Licitaciones'),
    ('licitaciones_create', 'Crear Licitaciones', 'Crear nuevas licitaciones', 'Licitaciones'),
    ('licitaciones_edit', 'Editar Licitaciones', 'Modificar licitaciones existentes', 'Licitaciones'),
    ('licitaciones_delete', 'Eliminar Licitaciones', 'Eliminar licitaciones', 'Licitaciones'),
    ('suppliers_view', 'Ver Proveedores', 'Ver lista de proveedores', 'Proveedores'),
    ('suppliers_create', 'Crear Proveedores', 'Crear nuevos proveedores', 'Proveedores'),
    ('suppliers_edit', 'Editar Proveedores', 'Modificar proveedores existentes', 'Proveedores'),
    ('suppliers_delete', 'Eliminar Proveedores', 'Eliminar proveedores', 'Proveedores'),
    ('reports_view', 'Ver Reportes', 'Acceso a reportes y análisis', 'Reportes'),
    ('reports_export', 'Exportar Reportes', 'Exportar reportes a PDF/Excel', 'Reportes'),
    ('users_view', 'Ver Usuarios', 'Ver lista de usuarios', 'Usuarios'),
    ('users_create', 'Crear Usuarios', 'Invitar nuevos usuarios', 'Usuarios'),
    ('users_edit', 'Editar Usuarios', 'Modificar usuarios existentes', 'Usuarios'),
    ('users_delete', 'Eliminar Usuarios', 'Eliminar usuarios', 'Usuarios'),
    ('settings_view', 'Ver Configuración', 'Acceso a configuración', 'Configuración'),
    ('settings_edit', 'Editar Configuración', 'Modificar configuración', 'Configuración'),
    ('permissions_edit', 'Gestionar Permisos', 'Modificar permisos de roles', 'Configuración')
) AS v(pid, pname, pdesc, pcat)
ON CONFLICT (company_id, id) DO NOTHING;

INSERT INTO role_permissions (company_id, role, permission_id, granted)
SELECT c.id, r.role, p.id,
  CASE
    WHEN r.role = 'admin' THEN true
    WHEN r.role = 'manager' AND p.id IN (
      'dashboard_view',
      'sourcing_plan_view', 'sourcing_plan_create', 'sourcing_plan_edit', 'sourcing_plan_export',
      'licitaciones_view', 'licitaciones_create', 'licitaciones_edit',
      'suppliers_view', 'suppliers_create', 'suppliers_edit',
      'reports_view', 'reports_export',
      'users_view', 'users_create', 'users_edit',
      'settings_view'
    ) THEN true
    WHEN r.role = 'analyst' AND p.id IN (
      'dashboard_view',
      'sourcing_plan_view', 'sourcing_plan_create', 'sourcing_plan_edit',
      'licitaciones_view', 'licitaciones_create', 'licitaciones_edit',
      'suppliers_view', 'suppliers_create', 'suppliers_edit',
      'reports_view', 'reports_export'
    ) THEN true
    WHEN r.role = 'viewer' AND p.id IN (
      'dashboard_view',
      'sourcing_plan_view',
      'licitaciones_view',
      'suppliers_view',
      'reports_view'
    ) THEN true
    ELSE false
  END
FROM companies c
CROSS JOIN (VALUES ('admin'), ('manager'), ('analyst'), ('viewer')) AS r(role)
JOIN permissions p ON p.company_id = c.id
ON CONFLICT (company_id, role, permission_id) DO NOTHING;
