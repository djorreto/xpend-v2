-- ============================================================================
-- FIX PROFILES RLS POLICIES
-- ============================================================================
-- Actualiza las políticas RLS de la tabla profiles para permitir
-- que los usuarios actualicen sus propios perfiles
-- ============================================================================

-- 1. ELIMINAR POLÍTICAS EXISTENTES DE UPDATE
-- ============================================================================

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- 2. CREAR NUEVAS POLÍTICAS DE UPDATE
-- ============================================================================

-- Política para que usuarios actualicen su propio perfil
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Política para que admins actualicen cualquier perfil de su empresa
CREATE POLICY "Admins can update company profiles"
  ON profiles FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 3. VERIFICAR POLÍTICAS DE SELECT (ASEGURAR QUE EXISTAN)
-- ============================================================================

-- Eliminar política de select si existe
DROP POLICY IF EXISTS "Users can view profiles from their company" ON profiles;

-- Crear política de select
CREATE POLICY "Users can view profiles from their company"
  ON profiles FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 4. VERIFICAR QUE RLS ESTÉ HABILITADO
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ✅ POLÍTICAS RLS ACTUALIZADAS
-- ============================================================================
-- Los usuarios ahora pueden:
-- 1. Actualizar su propio perfil
-- 2. Los admins pueden actualizar cualquier perfil de su empresa
-- 3. Todos pueden ver perfiles de su empresa
-- ============================================================================
