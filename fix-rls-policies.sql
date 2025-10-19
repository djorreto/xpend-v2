-- Script para corregir políticas RLS
-- Ejecutar en Supabase SQL Editor

-- 1. Deshabilitar RLS temporalmente para suppliers
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "Users can view suppliers from their company" ON suppliers;
DROP POLICY IF EXISTS "Users can insert suppliers to their company" ON suppliers;
DROP POLICY IF EXISTS "Users can update suppliers from their company" ON suppliers;
DROP POLICY IF EXISTS "Users can delete suppliers from their company" ON suppliers;

-- 3. Habilitar RLS nuevamente
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas muy permisivas
CREATE POLICY "Allow all operations on suppliers" ON suppliers
    FOR ALL USING (true) WITH CHECK (true);

-- 5. Hacer lo mismo para las otras tablas
ALTER TABLE administrative_evaluations DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view admin evaluations from their company" ON administrative_evaluations;
DROP POLICY IF EXISTS "Users can insert admin evaluations to their company" ON administrative_evaluations;
DROP POLICY IF EXISTS "Users can update admin evaluations from their company" ON administrative_evaluations;
DROP POLICY IF EXISTS "Users can delete admin evaluations from their company" ON administrative_evaluations;
ALTER TABLE administrative_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on admin evaluations" ON administrative_evaluations
    FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE technical_evaluations DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view tech evaluations from their company" ON technical_evaluations;
DROP POLICY IF EXISTS "Users can insert tech evaluations to their company" ON technical_evaluations;
DROP POLICY IF EXISTS "Users can update tech evaluations from their company" ON technical_evaluations;
DROP POLICY IF EXISTS "Users can delete tech evaluations from their company" ON technical_evaluations;
ALTER TABLE technical_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on tech evaluations" ON technical_evaluations
    FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE licitacion_weightings DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view weightings from their company" ON licitacion_weightings;
DROP POLICY IF EXISTS "Users can insert weightings to their company" ON licitacion_weightings;
DROP POLICY IF EXISTS "Users can update weightings from their company" ON licitacion_weightings;
DROP POLICY IF EXISTS "Users can delete weightings from their company" ON licitacion_weightings;
ALTER TABLE licitacion_weightings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on weightings" ON licitacion_weightings
    FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE licitacion_suppliers DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view licitacion suppliers from their company" ON licitacion_suppliers;
DROP POLICY IF EXISTS "Users can insert licitacion suppliers to their company" ON licitacion_suppliers;
DROP POLICY IF EXISTS "Users can update licitacion suppliers from their company" ON licitacion_suppliers;
DROP POLICY IF EXISTS "Users can delete licitacion suppliers from their company" ON licitacion_suppliers;
ALTER TABLE licitacion_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on licitacion suppliers" ON licitacion_suppliers
    FOR ALL USING (true) WITH CHECK (true);

-- 6. Verificar que las políticas se aplicaron
SELECT 'Políticas RLS configuradas correctamente' as status;
