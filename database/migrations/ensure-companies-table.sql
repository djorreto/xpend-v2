-- ============================================================================
-- ASEGURAR QUE LA TABLA COMPANIES EXISTE CON TODOS LOS CAMPOS
-- ============================================================================

-- Agregar campo tax_id si no existe
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

-- Verificar la estructura de la tabla
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'companies'
ORDER BY ordinal_position;

