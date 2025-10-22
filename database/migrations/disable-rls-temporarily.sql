-- ============================================================================
-- DESHABILITAR RLS TEMPORALMENTE PARA TESTING
-- ============================================================================
-- Este script deshabilita temporalmente RLS para permitir acceso completo
-- SOLO para desarrollo. NO usar en producción.
-- ============================================================================

-- Deshabilitar RLS en tablas críticas
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE licitaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_plans DISABLE ROW LEVEL SECURITY;

-- Si existen estas tablas, también deshabilitarlas
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'permissions') THEN
        EXECUTE 'ALTER TABLE permissions DISABLE ROW LEVEL SECURITY';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'role_permissions') THEN
        EXECUTE 'ALTER TABLE role_permissions DISABLE ROW LEVEL SECURITY';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments') THEN
        EXECUTE 'ALTER TABLE departments DISABLE ROW LEVEL SECURITY';
    END IF;
END $$;

-- Verificar que RLS está deshabilitado
SELECT
    tablename,
    rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'companies', 'projects', 'licitaciones', 'suppliers', 'sourcing_plans')
ORDER BY tablename;

