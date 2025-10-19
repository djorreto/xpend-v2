-- Script para limpiar proveedores existentes
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar proveedores existentes
SELECT 'Proveedores existentes:' as status;
SELECT * FROM suppliers LIMIT 5;

-- 2. Eliminar todos los proveedores
DELETE FROM suppliers;

-- 3. Verificar que se eliminaron
SELECT 'Proveedores después de eliminar:' as status;
SELECT * FROM suppliers LIMIT 5;

SELECT 'Base de datos limpia - Lista para crear nuevos proveedores' as final_status;
