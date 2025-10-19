-- ============================================================================
-- FIX PROFILES RLS - SIMPLE Y FUNCIONAL
-- ============================================================================

-- 1. ELIMINAR TODAS LAS POLÍTICAS
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON profiles';
    END LOOP;
END $$;

-- 2. HABILITAR RLS
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICA SIMPLE PARA SELECT
-- ============================================================================

CREATE POLICY "select_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- 4. POLÍTICA PARA UPDATE - PROPIOS
-- ============================================================================

CREATE POLICY "update_own_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 5. POLÍTICA PARA UPDATE - ADMINS
-- ============================================================================

CREATE POLICY "admins_update_profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- 6. POLÍTICA PARA INSERT - ADMINS
-- ============================================================================

CREATE POLICY "admins_insert_profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- 7. POLÍTICA PARA DELETE - ADMINS
-- ============================================================================

CREATE POLICY "admins_delete_profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- ============================================================================
-- ✅ SETUP COMPLETO
-- ============================================================================
