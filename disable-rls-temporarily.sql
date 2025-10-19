-- Script para deshabilitar RLS temporalmente (SOLO PARA DESARROLLO)
-- Ejecutar en Supabase SQL Editor

-- Deshabilitar RLS en todas las tablas de proveedores
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE administrative_evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE technical_evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE licitacion_weightings DISABLE ROW LEVEL SECURITY;
ALTER TABLE licitacion_suppliers DISABLE ROW LEVEL SECURITY;

-- Verificar que RLS está deshabilitado
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('suppliers', 'administrative_evaluations', 'technical_evaluations', 'licitacion_weightings', 'licitacion_suppliers')
AND schemaname = 'public';

SELECT 'RLS deshabilitado temporalmente para desarrollo' as status;
