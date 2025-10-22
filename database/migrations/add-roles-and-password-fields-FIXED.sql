-- ============================================================================
-- ADD ROLES AND PASSWORD FIELDS TO PROFILES (FIXED VERSION)
-- ============================================================================
-- Este script actualiza la tabla profiles para incluir:
-- 1. Roles: super_admin, admin, manager, user, demo
-- 2. Campo must_change_password para contraseña temporal
-- ============================================================================

-- 1. AGREGAR CAMPO MUST_CHANGE_PASSWORD PRIMERO
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

-- 2. ACTUALIZAR TIPO DE ENUM PARA ROLES - MÉTODO SEGURO
-- ============================================================================

-- Paso 1: Agregar los nuevos valores al enum existente (si no existen)
DO $$
BEGIN
    -- Intentar agregar 'super_admin' si no existe
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'super_admin' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
        ALTER TYPE user_role ADD VALUE 'super_admin';
    END IF;

    -- Intentar agregar 'demo' si no existe
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'demo' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
        ALTER TYPE user_role ADD VALUE 'demo';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Ignorar si ya existe
END $$;

-- Paso 2: Si el tipo user_role no existe, crearlo con todos los valores
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'manager', 'user', 'demo');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Ignorar si ya existe
END $$;

-- 3. ACTUALIZAR COLUMNA ROLE SI ES NECESARIO
-- ============================================================================

-- Verificar si la columna role existe y tiene el tipo correcto
DO $$
BEGIN
    -- Si la columna role no existe, crearla
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND column_name = 'role'
    ) THEN
        ALTER TABLE profiles
        ADD COLUMN role user_role NOT NULL DEFAULT 'user';
    END IF;
END $$;

-- 4. COMENTARIOS Y DOCUMENTACIÓN
-- ============================================================================

COMMENT ON COLUMN profiles.role IS 'Rol del usuario: super_admin (acceso total), admin (gestión de empresa), manager (gestión de equipo), user (usuario estándar), demo (solo vista mockup)';

-- 5. ÍNDICES Y OPTIMIZACIONES
-- ============================================================================

-- Crear índice para búsqueda rápida por rol
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Crear índice para usuarios que deben cambiar contraseña
CREATE INDEX IF NOT EXISTS idx_profiles_must_change_password ON profiles(must_change_password) WHERE must_change_password = TRUE;

-- ============================================================================
-- 6. CREAR UN SUPER ADMIN INICIAL (OPCIONAL)
-- ============================================================================

-- IMPORTANTE: Descomenta y ejecuta SOLO UNA VEZ después de crear tu primer usuario
-- Reemplaza 'TU_EMAIL@example.com' con el email del super admin

/*
UPDATE profiles
SET role = 'super_admin'
WHERE email = 'TU_EMAIL@example.com';
*/

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================

-- Para verificar los cambios:
SELECT id, email, role, must_change_password FROM profiles LIMIT 5;

-- Para ver todos los valores posibles del enum:
SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role') ORDER BY enumsortorder;

