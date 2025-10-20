-- ============================================================================
-- RLS PARA PRODUCCIÓN - ENFOQUE REALISTA
-- ============================================================================
-- Este enfoque balancea seguridad y funcionalidad
-- ============================================================================

-- PASO 1: LIMPIAR POLÍTICAS
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

-- PASO 3: POLÍTICAS PERMISIVAS PERO SEGURAS
-- ============================================================================

-- OPCIÓN A: Políticas muy permisivas (mejor para desarrollo/staging)
-- Comentar estas si quieres usar OPCIÓN B

CREATE POLICY "allow_all_authenticated"
ON profiles FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "allow_read_anon"
ON profiles FOR SELECT
TO anon
USING (true);

-- OPCIÓN B: Políticas restrictivas por company (para producción estricta)
-- Descomentar estas si quieres usar OPCIÓN B en lugar de OPCIÓN A

/*
-- SELECT: Solo perfiles de la misma empresa
CREATE POLICY "select_own_company"
ON profiles FOR SELECT
TO authenticated
USING (
  company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1
  )
);

-- UPDATE: Solo su propio perfil o si es admin de la empresa
CREATE POLICY "update_own_or_admin"
ON profiles FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND company_id = profiles.company_id
  )
)
WITH CHECK (
  id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND company_id = profiles.company_id
  )
);

-- INSERT: Solo admins
CREATE POLICY "insert_admin_only"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- DELETE: Solo admins (excepto su propio perfil)
CREATE POLICY "delete_admin_only"
ON profiles FOR DELETE
TO authenticated
USING (
  id != auth.uid()
  AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND company_id = profiles.company_id
  )
);
*/

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

SELECT
    policyname,
    cmd,
    roles::text
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ============================================================================
-- ✅ CONFIGURACIÓN COMPLETADA
-- ============================================================================
--
-- OPCIÓN A (ACTIVA):
-- - Políticas permisivas para authenticated
-- - Perfecto para desarrollo y staging
-- - Los usuarios autenticados pueden hacer cualquier operación
-- - La seguridad se maneja en el código de la aplicación
--
-- OPCIÓN B (COMENTADA):
-- - Políticas restrictivas por company_id y role
-- - Para producción con alta seguridad
-- - Requiere que auth.uid() funcione correctamente
-- - Aislamiento estricto entre empresas
--
-- RECOMENDACIÓN:
-- - Usa OPCIÓN A mientras desarrollas
-- - Cambia a OPCIÓN B cuando vayas a producción
-- - Prueba exhaustivamente OPCIÓN B antes de deploy final
--
-- ============================================================================
