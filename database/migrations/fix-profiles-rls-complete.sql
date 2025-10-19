-- ============================================================================
-- FIX PROFILES RLS POLICIES - COMPLETE
-- ============================================================================
-- Soluciona completamente las políticas RLS de profiles
-- ============================================================================

-- 1. DESHABILITAR RLS TEMPORALMENTE PARA LIMPIAR
-- ============================================================================

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. ELIMINAR TODAS LAS POLÍTICAS EXISTENTES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view profiles from their company" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update company profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert their profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;

-- 3. HABILITAR RLS
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. CREAR POLÍTICAS CORRECTAS
-- ============================================================================

-- SELECT: Ver perfiles de la misma empresa
CREATE POLICY "Users can view profiles from their company"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- UPDATE: Usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- UPDATE: Admins pueden actualizar perfiles de su empresa
CREATE POLICY "Admins can update company profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND company_id = profiles.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND company_id = profiles.company_id
    )
  );

-- INSERT: Solo admins pueden crear nuevos perfiles en su empresa
CREATE POLICY "Admins can insert profiles in their company"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND company_id = profiles.company_id
    )
  );

-- DELETE: Solo admins pueden eliminar perfiles de su empresa
CREATE POLICY "Admins can delete profiles in their company"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND company_id = profiles.company_id
    )
  );

-- ============================================================================
-- ✅ POLÍTICAS RLS CONFIGURADAS CORRECTAMENTE
-- ============================================================================
-- SELECT: Todos pueden ver perfiles de su empresa
-- UPDATE: Usuarios actualizan su perfil, admins actualizan cualquiera de su empresa
-- INSERT: Solo admins pueden crear usuarios en su empresa
-- DELETE: Solo admins pueden eliminar usuarios de su empresa
-- ============================================================================
