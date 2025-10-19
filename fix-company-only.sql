-- Script simplificado para crear solo la empresa
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar si hay empresas existentes
SELECT 'Verificando empresas existentes:' as status;
SELECT * FROM companies LIMIT 5;

-- 2. Crear empresa demo si no existe
INSERT INTO companies (
    id,
    name,
    description,
    created_at,
    updated_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'SpendPlan.cl Demo',
    'Empresa demo para desarrollo',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- 3. Verificar que la empresa se creó
SELECT 'Empresa creada:' as status;
SELECT * FROM companies WHERE id = '550e8400-e29b-41d4-a716-446655440000';

SELECT 'Configuración completada - Solo empresa creada' as final_status;
