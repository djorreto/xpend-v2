-- ============================================================================
-- ADD ACTIVE STATUS FIELDS TO COMPANIES AND PROFILES
-- ============================================================================
-- Este script agrega campos para habilitar/inhabilitar empresas y usuarios
-- ============================================================================

-- 1. AGREGAR CAMPO IS_ACTIVE A COMPANIES
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'companies'
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE companies
        ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

        COMMENT ON COLUMN companies.is_active IS 'Indica si la empresa está activa. Si está inactiva, ningún usuario de esta empresa puede acceder.';
    END IF;
END $$;

-- 2. AGREGAR CAMPO IS_ACTIVE A PROFILES
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE profiles
        ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

        COMMENT ON COLUMN profiles.is_active IS 'Indica si el usuario está activo. Si está inactivo, no puede acceder a la plataforma.';
    END IF;
END $$;

-- 3. ÍNDICES PARA OPTIMIZACIÓN
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_companies_is_active ON companies(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_company_active ON profiles(company_id, is_active);

-- 4. FUNCIÓN PARA VERIFICAR ACCESO
-- ============================================================================

-- Función para verificar si un usuario puede acceder (usuario activo + empresa activa)
CREATE OR REPLACE FUNCTION can_user_access(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_active BOOLEAN;
    user_company_id UUID;
    company_active BOOLEAN;
BEGIN
    -- Obtener estado del usuario y su empresa
    SELECT is_active, company_id INTO user_active, user_company_id
    FROM profiles
    WHERE id = user_id;

    -- Si el usuario no existe o está inactivo, retornar false
    IF user_active IS NULL OR user_active = FALSE THEN
        RETURN FALSE;
    END IF;

    -- Si el usuario no tiene empresa, solo verificar su estado
    IF user_company_id IS NULL THEN
        RETURN user_active;
    END IF;

    -- Obtener estado de la empresa
    SELECT is_active INTO company_active
    FROM companies
    WHERE id = user_company_id;

    -- Retornar true solo si ambos están activos
    RETURN user_active AND COALESCE(company_active, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_user_access(UUID) IS 'Verifica si un usuario puede acceder a la plataforma (usuario activo + empresa activa)';

-- 5. VISTA PARA USUARIOS CON ESTADO COMPUESTO
-- ============================================================================

CREATE OR REPLACE VIEW user_access_status AS
SELECT
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.is_active as user_is_active,
    p.company_id,
    c.name as company_name,
    c.is_active as company_is_active,
    can_user_access(p.id) as can_access
FROM profiles p
LEFT JOIN companies c ON p.company_id = c.id;

COMMENT ON VIEW user_access_status IS 'Vista que muestra el estado de acceso de cada usuario, considerando su estado y el de su empresa';

-- ============================================================================
-- FINALIZADO
-- ============================================================================

