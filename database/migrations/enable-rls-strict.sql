-- ============================================================================
-- RLS PRODUCCIÓN - OPCIÓN B (RESTRICTIVA)
-- ============================================================================
-- Políticas estrictas con aislamiento por company_id
-- ============================================================================

-- PASO 1: LIMPIAR TODO
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

-- PASO 3: POLÍTICAS RESTRICTIVAS
-- ============================================================================

-- SELECT: Solo perfiles de la misma empresa
CREATE POLICY "profiles_select_by_company"
ON profiles FOR SELECT
TO authenticated
USING (
  company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1
  )
);

-- UPDATE: Su propio perfil O admin de la empresa
CREATE POLICY "profiles_update_own_or_admin"
ON profiles FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'admin'
    AND p.company_id = profiles.company_id
  )
)
WITH CHECK (
  id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'admin'
    AND p.company_id = profiles.company_id
  )
);

-- INSERT: Solo admins pueden crear usuarios
CREATE POLICY "profiles_insert_admin"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'admin'
    AND p.company_id = profiles.company_id
  )
);

-- DELETE: Solo admins (no pueden borrar su propio perfil)
CREATE POLICY "profiles_delete_admin"
ON profiles FOR DELETE
TO authenticated
USING (
  id != auth.uid()
  AND
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'admin'
    AND p.company_id = profiles.company_id
  )
);

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Ver políticas creadas
SELECT
    policyname,
    cmd,
    permissive,
    roles::text
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- Verificar RLS habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'profiles';

-- ============================================================================
-- ✅ RLS ESTRICTO HABILITADO
-- ============================================================================
--
-- POLÍTICAS ACTIVAS:
--
-- SELECT:
--   ✓ Solo perfiles de la misma empresa
--   ✓ Basado en company_id del usuario autenticado
--
-- UPDATE:
--   ✓ Usuarios: Solo su propio perfil
--   ✓ Admins: Cualquier perfil de su empresa
--
-- INSERT:
--   ✓ Solo admins pueden crear nuevos usuarios
--   ✓ Deben ser de la misma empresa
--
-- DELETE:
--   ✓ Solo admins pueden eliminar usuarios
--   ✓ No pueden eliminarse a sí mismos
--   ✓ Solo usuarios de su empresa
--
-- IMPORTANTE:
-- - Requiere que auth.uid() devuelva el user_id correcto
-- - La sesión debe estar activa y válida
-- - Las cookies de Supabase deben estar configuradas
--
-- ============================================================================
