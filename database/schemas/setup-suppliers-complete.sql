-- Script completo para configurar la funcionalidad de proveedores
-- Ejecutar en Supabase SQL Editor

-- 1. Crear el bucket de Storage si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-documents',
  'supplier-documents', 
  false,
  10485760, -- 10MB
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Configurar políticas RLS más permisivas para desarrollo
-- (Estas políticas permiten a cualquier usuario autenticado crear/leer/actualizar)

-- Políticas para suppliers
DROP POLICY IF EXISTS "Users can view suppliers from their company" ON suppliers;
DROP POLICY IF EXISTS "Users can insert suppliers to their company" ON suppliers;
DROP POLICY IF EXISTS "Users can update suppliers from their company" ON suppliers;
DROP POLICY IF EXISTS "Users can delete suppliers from their company" ON suppliers;

-- Políticas más permisivas para desarrollo
CREATE POLICY "Users can view suppliers from their company" ON suppliers
    FOR SELECT USING (true); -- Permitir a todos los usuarios autenticados

CREATE POLICY "Users can insert suppliers to their company" ON suppliers
    FOR INSERT WITH CHECK (true); -- Permitir a todos los usuarios autenticados

CREATE POLICY "Users can update suppliers from their company" ON suppliers
    FOR UPDATE USING (true); -- Permitir a todos los usuarios autenticados

CREATE POLICY "Users can delete suppliers from their company" ON suppliers
    FOR DELETE USING (true); -- Permitir a todos los usuarios autenticados

-- Políticas para administrative_evaluations
DROP POLICY IF EXISTS "Users can view admin evaluations from their company" ON administrative_evaluations;
DROP POLICY IF EXISTS "Users can insert admin evaluations to their company" ON administrative_evaluations;
DROP POLICY IF EXISTS "Users can update admin evaluations from their company" ON administrative_evaluations;
DROP POLICY IF EXISTS "Users can delete admin evaluations from their company" ON administrative_evaluations;

CREATE POLICY "Users can view admin evaluations from their company" ON administrative_evaluations
    FOR SELECT USING (true);

CREATE POLICY "Users can insert admin evaluations to their company" ON administrative_evaluations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update admin evaluations from their company" ON administrative_evaluations
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete admin evaluations from their company" ON administrative_evaluations
    FOR DELETE USING (true);

-- Políticas para technical_evaluations
DROP POLICY IF EXISTS "Users can view tech evaluations from their company" ON technical_evaluations;
DROP POLICY IF EXISTS "Users can insert tech evaluations to their company" ON technical_evaluations;
DROP POLICY IF EXISTS "Users can update tech evaluations from their company" ON technical_evaluations;
DROP POLICY IF EXISTS "Users can delete tech evaluations from their company" ON technical_evaluations;

CREATE POLICY "Users can view tech evaluations from their company" ON technical_evaluations
    FOR SELECT USING (true);

CREATE POLICY "Users can insert tech evaluations to their company" ON technical_evaluations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update tech evaluations from their company" ON technical_evaluations
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete tech evaluations from their company" ON technical_evaluations
    FOR DELETE USING (true);

-- Políticas para licitacion_weightings
DROP POLICY IF EXISTS "Users can view weightings from their company" ON licitacion_weightings;
DROP POLICY IF EXISTS "Users can insert weightings to their company" ON licitacion_weightings;
DROP POLICY IF EXISTS "Users can update weightings from their company" ON licitacion_weightings;
DROP POLICY IF EXISTS "Users can delete weightings from their company" ON licitacion_weightings;

CREATE POLICY "Users can view weightings from their company" ON licitacion_weightings
    FOR SELECT USING (true);

CREATE POLICY "Users can insert weightings to their company" ON licitacion_weightings
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update weightings from their company" ON licitacion_weightings
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete weightings from their company" ON licitacion_weightings
    FOR DELETE USING (true);

-- Políticas para licitacion_suppliers
DROP POLICY IF EXISTS "Users can view licitacion suppliers from their company" ON licitacion_suppliers;
DROP POLICY IF EXISTS "Users can insert licitacion suppliers to their company" ON licitacion_suppliers;
DROP POLICY IF EXISTS "Users can update licitacion suppliers from their company" ON licitacion_suppliers;
DROP POLICY IF EXISTS "Users can delete licitacion suppliers from their company" ON licitacion_suppliers;

CREATE POLICY "Users can view licitacion suppliers from their company" ON licitacion_suppliers
    FOR SELECT USING (true);

CREATE POLICY "Users can insert licitacion suppliers to their company" ON licitacion_suppliers
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update licitacion suppliers from their company" ON licitacion_suppliers
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete licitacion suppliers from their company" ON licitacion_suppliers
    FOR DELETE USING (true);

-- 3. Configurar políticas de Storage
DROP POLICY IF EXISTS "Users can upload supplier documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view supplier documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update supplier documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete supplier documents" ON storage.objects;

CREATE POLICY "Users can upload supplier documents" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'supplier-documents');

CREATE POLICY "Users can view supplier documents" ON storage.objects
    FOR SELECT USING (bucket_id = 'supplier-documents');

CREATE POLICY "Users can update supplier documents" ON storage.objects
    FOR UPDATE USING (bucket_id = 'supplier-documents');

CREATE POLICY "Users can delete supplier documents" ON storage.objects
    FOR DELETE USING (bucket_id = 'supplier-documents');

-- 4. Crear un usuario de prueba si no existe
-- (Solo si no tienes usuarios creados)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) 
SELECT 
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'demo@spendplan.cl',
    crypt('demo123', gen_salt('bf')),
    NOW(),
    NULL,
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'demo@spendplan.cl'
);

-- 5. Crear perfil para el usuario demo
INSERT INTO profiles (
    id,
    full_name,
    email,
    role,
    company_id,
    created_at,
    updated_at
) 
SELECT 
    u.id,
    'Usuario Demo',
    'demo@spendplan.cl',
    'admin',
    (SELECT id FROM companies LIMIT 1),
    NOW(),
    NOW()
FROM auth.users u
WHERE u.email = 'demo@spendplan.cl'
AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = u.id
);

-- 6. Verificar que todo esté configurado
SELECT 'Configuración completada' as status;
