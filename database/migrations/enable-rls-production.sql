-- ============================================================================
-- HABILITAR RLS PARA PRODUCCIÓN
-- ============================================================================
-- Políticas RLS seguras que funcionan con autenticación de Supabase
-- ============================================================================

-- PASO 1: LIMPIAR POLÍTICAS EXISTENTES
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON profiles';
    END LOOP;
END $$;

-- PASO 2: HABILITAR RLS
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- PASO 3: POLÍTICAS DE SELECT (Ver perfiles)
-- ============================================================================

-- Los usuarios autenticados pueden ver perfiles de su empresa
CREATE POLICY "profiles_select_authenticated"
ON profiles FOR SELECT
TO authenticated
USING (
  company_id = (
    SELECT company_id
    FROM profiles
    WHERE id = auth.uid()
    LIMIT 1
  )
);

-- El anon puede ver perfiles (necesario para login/signup)
CREATE POLICY "profiles_select_anon"
ON profiles FOR SELECT
TO anon
USING (true);

-- PASO 4: POLÍTICAS DE UPDATE (Actualizar perfiles)
-- ============================================================================

-- Los usuarios pueden actualizar su propio perfil
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Los admins pueden actualizar perfiles de su empresa
CREATE POLICY "profiles_update_admin"
ON profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND company_id = profiles.company_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND company_id = profiles.company_id
  )
);

-- PASO 5: POLÍTICAS DE INSERT (Crear perfiles)
-- ============================================================================

-- Los admins pueden crear perfiles en su empresa
CREATE POLICY "profiles_insert_admin"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND company_id = profiles.company_id
  )
);

-- El anon puede crear perfiles (necesario para signup)
CREATE POLICY "profiles_insert_anon"
ON profiles FOR INSERT
TO anon
WITH CHECK (true);

-- PASO 6: POLÍTICAS DE DELETE (Eliminar perfiles)
-- ============================================================================

-- Solo admins pueden eliminar perfiles de su empresa (excepto el propio)
CREATE POLICY "profiles_delete_admin"
ON profiles FOR DELETE
TO authenticated
USING (
  id != auth.uid()
  AND
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND company_id = profiles.company_id
  )
);

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Ver políticas creadas
SELECT
    policyname,
    cmd,
    roles::text,
    permissive
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- Ver estado de RLS
SELECT
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'profiles';

-- ============================================================================
-- ✅ RLS HABILITADO PARA PRODUCCIÓN
-- ============================================================================
--
-- POLÍTICAS CONFIGURADAS:
--
-- SELECT:
--   ✓ authenticated: Solo perfiles de su empresa
--   ✓ anon: Todos (necesario para login)
--
-- UPDATE:
--   ✓ authenticated: Su propio perfil
--   ✓ admin: Cualquier perfil de su empresa
--
-- INSERT:
--   ✓ admin: Perfiles en su empresa
--   ✓ anon: Cualquier perfil (necesario para signup)
--
-- DELETE:
--   ✓ admin: Perfiles de su empresa (excepto el propio)
--
-- ============================================================================
