-- ============================================================================
-- FIX COMPANIES TABLE - AGREGAR TODAS LAS COLUMNAS NECESARIAS
-- ============================================================================
-- Este script agrega todas las columnas que faltan en la tabla companies
-- ============================================================================

-- 1. Agregar columna industry si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'companies'
        AND column_name = 'industry'
    ) THEN
        ALTER TABLE companies ADD COLUMN industry TEXT;
        COMMENT ON COLUMN companies.industry IS 'Industria o rubro de la empresa';
    END IF;
END $$;

-- 2. Agregar columna tax_id si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'companies'
        AND column_name = 'tax_id'
    ) THEN
        ALTER TABLE companies ADD COLUMN tax_id TEXT;
        COMMENT ON COLUMN companies.tax_id IS 'RUT o Tax ID de la empresa';
    END IF;
END $$;

-- 3. Verificar que todas las columnas necesarias existan
-- Si alguna falta, la tabla podría estar incompleta
DO $$
BEGIN
    -- Verificar que existan las columnas básicas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'name') THEN
        RAISE EXCEPTION 'La tabla companies no tiene la columna name. Podría estar corrupta o no creada correctamente.';
    END IF;
END $$;

-- 4. Mostrar estructura final de la tabla
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'companies'
ORDER BY ordinal_position;

-- 5. Mostrar datos actuales (si hay)
SELECT
    id,
    name,
    industry,
    tax_id,
    created_at
FROM companies
LIMIT 5;

