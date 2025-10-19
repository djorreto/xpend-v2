-- Script para verificar y corregir el problema de company_id
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar si hay empresas en la tabla companies
SELECT 'Verificando empresas existentes:' as status;
SELECT * FROM companies LIMIT 5;

-- 2. Si no hay empresas, crear una empresa demo
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

-- 4. Verificar si hay perfiles de usuario
SELECT 'Verificando perfiles:' as status;
SELECT * FROM profiles LIMIT 5;

-- 5. Si no hay perfiles, crear un perfil demo
INSERT INTO profiles (
    id,
    full_name,
    email,
    role,
    company_id,
    created_at,
    updated_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    'Usuario Demo',
    'demo@spendplan.cl',
    'admin',
    '550e8400-e29b-41d4-a716-446655440000',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- 6. Verificar que el perfil se creó
SELECT 'Perfil creado:' as status;
SELECT * FROM profiles WHERE id = '550e8400-e29b-41d4-a716-446655440001';

SELECT 'Configuración completada' as final_status;
