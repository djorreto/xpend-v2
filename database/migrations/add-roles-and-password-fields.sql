-- ============================================================================
-- ADD ROLES AND PASSWORD FIELDS TO PROFILES
-- ============================================================================
-- Este script actualiza la tabla profiles para incluir:
-- 1. Roles: super_admin, admin, manager, user, demo
-- 2. Campo must_change_password para contraseña temporal
-- ============================================================================

-- 1. ACTUALIZAR TIPO DE ENUM PARA ROLES
-- ============================================================================

-- Primero, verificar si el tipo existe y eliminarlo si es necesario
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_new') THEN
        DROP TYPE user_role_new CASCADE;
    END IF;
END $$;

-- Crear nuevo tipo con todos los roles
CREATE TYPE user_role_new AS ENUM ('super_admin', 'admin', 'manager', 'user', 'demo');

-- Migrar datos existentes
ALTER TABLE profiles
ALTER COLUMN role TYPE user_role_new
USING (
    CASE role::text
        WHEN 'admin' THEN 'admin'::user_role_new
        WHEN 'manager' THEN 'manager'::user_role_new
        WHEN 'user' THEN 'user'::user_role_new
        ELSE 'user'::user_role_new  -- Por defecto, convertir roles desconocidos a 'user'
    END
);

-- Eliminar tipo anterior si existe
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        DROP TYPE user_role;
    END IF;
END $$;

-- Renombrar nuevo tipo
ALTER TYPE user_role_new RENAME TO user_role;

-- 2. AGREGAR CAMPO MUST_CHANGE_PASSWORD
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND column_name = 'must_change_password'
    ) THEN
        ALTER TABLE profiles
        ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

        COMMENT ON COLUMN profiles.must_change_password IS 'Indica si el usuario debe cambiar su contraseña en el próximo login';
    END IF;
END $$;

-- 3. COMENTARIOS Y DOCUMENTACIÓN
-- ============================================================================

COMMENT ON COLUMN profiles.role IS 'Rol del usuario: super_admin (acceso total), admin (gestión de empresa), manager (gestión de equipo), user (usuario estándar), demo (solo vista mockup)';

-- 4. CREAR UN SUPER ADMIN INICIAL (OPCIONAL - DESCOMENTAR SI ES NECESARIO)
-- ============================================================================

-- NOTA: Ejecutar solo una vez y luego comentar o eliminar
-- Reemplazar 'TU_EMAIL@example.com' con el email del super admin

/*
DO $$
DECLARE
    super_admin_user_id UUID;
BEGIN
    -- Buscar el usuario por email en auth.users
    SELECT id INTO super_admin_user_id
    FROM auth.users
    WHERE email = 'TU_EMAIL@example.com';

    -- Si existe, actualizar su rol a super_admin
    IF super_admin_user_id IS NOT NULL THEN
        UPDATE profiles
        SET role = 'super_admin'
        WHERE id = super_admin_user_id;

        RAISE NOTICE 'Super admin creado correctamente para el usuario: %', super_admin_user_id;
    ELSE
        RAISE NOTICE 'No se encontró el usuario con ese email. Crea primero el usuario en Supabase Auth.';
    END IF;
END $$;
*/

-- 5. ÍNDICES Y OPTIMIZACIONES
-- ============================================================================

-- Crear índice para búsqueda rápida por rol
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Crear índice para usuarios que deben cambiar contraseña
CREATE INDEX IF NOT EXISTS idx_profiles_must_change_password ON profiles(must_change_password) WHERE must_change_password = TRUE;

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================

-- Para verificar los cambios:
-- SELECT id, email, role, must_change_password FROM profiles;

