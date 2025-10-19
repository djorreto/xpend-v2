-- ============================================================================
-- SOLUCIÓN DEFINITIVA - PROFILES RLS
-- ============================================================================
-- Políticas RLS profesionales y funcionales para la tabla profiles
-- ============================================================================

-- PASO 1: LIMPIAR TODO
-- ============================================================================

-- Deshabilitar RLS temporalmente
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Eliminar todas las políticas existentes
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

-- PASO 3: POLÍTICAS PARA SELECT
-- ============================================================================

-- Política 1: Usuarios autenticados pueden ver perfiles de su empresa
CREATE POLICY "authenticated_select_own_company"
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

-- Política 2: Service role puede ver todo (para admin de Supabase)
CREATE POLICY "service_role_select_all"
ON profiles FOR SELECT
TO service_role
USING (true);

-- PASO 4: POLÍTICAS PARA UPDATE
-- ============================================================================

-- Política 1: Usuarios pueden actualizar su propio perfil
CREATE POLICY "users_update_own_profile"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Política 2: Admins pueden actualizar perfiles de su empresa
CREATE POLICY "admins_update_company_profiles"
ON profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles admin_profile
    WHERE admin_profile.id = auth.uid()
    AND admin_profile.role = 'admin'
    AND admin_profile.company_id = profiles.company_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles admin_profile
    WHERE admin_profile.id = auth.uid()
    AND admin_profile.role = 'admin'
    AND admin_profile.company_id = profiles.company_id
  )
);

-- Política 3: Service role puede actualizar todo
CREATE POLICY "service_role_update_all"
ON profiles FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- PASO 5: POLÍTICAS PARA INSERT
-- ============================================================================

-- Política 1: Admins pueden crear perfiles en su empresa
CREATE POLICY "admins_insert_company_profiles"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles admin_profile
    WHERE admin_profile.id = auth.uid()
    AND admin_profile.role = 'admin'
    AND admin_profile.company_id = profiles.company_id
  )
);

-- Política 2: Service role puede insertar
CREATE POLICY "service_role_insert_all"
ON profiles FOR INSERT
TO service_role
WITH CHECK (true);

-- PASO 6: POLÍTICAS PARA DELETE
-- ============================================================================

-- Política 1: Solo admins pueden eliminar perfiles de su empresa (excepto su propio perfil)
CREATE POLICY "admins_delete_company_profiles"
ON profiles FOR DELETE
TO authenticated
USING (
  profiles.id != auth.uid() -- No puede eliminar su propio perfil
  AND
  EXISTS (
    SELECT 1
    FROM profiles admin_profile
    WHERE admin_profile.id = auth.uid()
    AND admin_profile.role = 'admin'
    AND admin_profile.company_id = profiles.company_id
  )
);

-- Política 2: Service role puede eliminar
CREATE POLICY "service_role_delete_all"
ON profiles FOR DELETE
TO service_role
USING (true);

-- PASO 7: VERIFICACIÓN
-- ============================================================================

-- Ver todas las políticas creadas
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- Ver estado de RLS
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'profiles';

-- ============================================================================
-- ✅ SETUP COMPLETO Y PROFESIONAL
-- ============================================================================
--
-- RESUMEN DE PERMISOS:
--
-- SELECT (Ver perfiles):
--   ✓ Usuarios autenticados: Solo perfiles de su empresa
--   ✓ Service role: Todos los perfiles
--
-- UPDATE (Actualizar perfiles):
--   ✓ Usuarios: Solo su propio perfil
--   ✓ Admins: Cualquier perfil de su empresa
--   ✓ Service role: Todos los perfiles
--
-- INSERT (Crear perfiles):
--   ✓ Admins: Solo en su empresa
--   ✓ Service role: Cualquier perfil
--
-- DELETE (Eliminar perfiles):
--   ✓ Admins: Perfiles de su empresa (excepto el propio)
--   ✓ Service role: Cualquier perfil
--
-- SEGURIDAD:
--   ✓ Aislamiento por empresa (company_id)
--   ✓ Control de roles (admin tiene privilegios)
--   ✓ Protección contra auto-eliminación
--   ✓ Service role para operaciones administrativas
--
-- ============================================================================
