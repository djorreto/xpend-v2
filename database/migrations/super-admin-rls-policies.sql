-- ============================================================================
-- SUPER ADMIN RLS POLICIES
-- ============================================================================
-- Este script crea políticas RLS que permiten a los usuarios con rol
-- 'super_admin' acceso total a todas las tablas de la plataforma
-- ============================================================================

-- NOTA: Ejecutar DESPUÉS de aplicar add-roles-and-password-fields.sql

-- ============================================================================
-- 1. PROFILES - Super Admin puede ver y modificar todos los perfiles
-- ============================================================================

-- Policy: Super admins can view all profiles
CREATE POLICY "Super admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policy: Super admins can update all profiles
CREATE POLICY "Super admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policy: Super admins can insert profiles
CREATE POLICY "Super admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policy: Super admins can delete profiles
CREATE POLICY "Super admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ============================================================================
-- 2. COMPANIES - Super Admin puede gestionar todas las empresas
-- ============================================================================

-- Policy: Super admins can view all companies
CREATE POLICY "Super admins can view all companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policy: Super admins can insert companies
CREATE POLICY "Super admins can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policy: Super admins can update companies
CREATE POLICY "Super admins can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policy: Super admins can delete companies
CREATE POLICY "Super admins can delete companies"
  ON companies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ============================================================================
-- 3. PROJECTS - Super Admin puede ver todos los proyectos
-- ============================================================================

CREATE POLICY "Super admins can view all projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ============================================================================
-- 4. LICITACIONES - Super Admin puede ver todas las licitaciones
-- ============================================================================

CREATE POLICY "Super admins can view all licitaciones"
  ON licitaciones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ============================================================================
-- 5. SUPPLIERS - Super Admin puede ver todos los proveedores
-- ============================================================================

CREATE POLICY "Super admins can view all suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ============================================================================
-- 6. SOURCING_PLANS - Super Admin puede ver todos los planes
-- ============================================================================

CREATE POLICY "Super admins can view all sourcing plans"
  ON sourcing_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ============================================================================
-- 7. DEPARTMENTS - Super Admin puede ver todos los departamentos
-- ============================================================================

CREATE POLICY "Super admins can view all departments"
  ON departments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================

-- Para verificar las políticas creadas:
-- SELECT schemaname, tablename, policyname, roles, cmd
-- FROM pg_policies
-- WHERE policyname LIKE '%super admin%'
-- ORDER BY tablename, policyname;

