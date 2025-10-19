-- ============================================================================
-- SOURCING PLAN - COMPLETE SETUP
-- ============================================================================
-- Este script configura todo lo necesario para el módulo Sourcing Plan
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- 1. CREAR TABLA SOURCING_PLANS
-- ============================================================================

CREATE TABLE IF NOT EXISTS sourcing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Planificación temporal
  plan_year INTEGER NOT NULL,
  quarter TEXT NOT NULL CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
  
  -- Información básica
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  initiative_type TEXT NOT NULL CHECK (initiative_type IN ('licitacion', 'project')),
  
  -- Montos estimados
  estimated_spend DECIMAL(15,2) NOT NULL,
  actual_spend DECIMAL(15,2),
  currency TEXT NOT NULL DEFAULT 'CLP',
  
  -- Ahorros proyectados
  projected_savings_percentage DECIMAL(5,2),
  projected_savings_amount DECIMAL(15,2),
  
  -- Ahorros reales
  actual_savings_percentage DECIMAL(5,2),
  actual_savings_amount DECIMAL(15,2),
  
  -- Estado y seguimiento
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  is_spot BOOLEAN DEFAULT FALSE,
  
  -- Asociaciones
  licitacion_id TEXT REFERENCES licitaciones(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  
  -- Responsables
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  responsible_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Notas
  notes TEXT,
  
  -- Auditoría
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Constraints
  CONSTRAINT unique_plan_initiative UNIQUE (company_id, plan_year, quarter, title)
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_sourcing_plans_company ON sourcing_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_plans_year_quarter ON sourcing_plans(plan_year, quarter);
CREATE INDEX IF NOT EXISTS idx_sourcing_plans_status ON sourcing_plans(status);
CREATE INDEX IF NOT EXISTS idx_sourcing_plans_type ON sourcing_plans(initiative_type);
CREATE INDEX IF NOT EXISTS idx_sourcing_plans_licitacion ON sourcing_plans(licitacion_id) WHERE licitacion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sourcing_plans_project ON sourcing_plans(project_id) WHERE project_id IS NOT NULL;

-- Comentarios de documentación
COMMENT ON TABLE sourcing_plans IS 'Annual sourcing plan with initiatives and savings tracking';
COMMENT ON COLUMN sourcing_plans.is_spot IS 'True if this is an unplanned (spot) initiative';
COMMENT ON COLUMN sourcing_plans.projected_savings_amount IS 'Automatically calculated from estimated_spend * projected_savings_percentage';
COMMENT ON COLUMN sourcing_plans.actual_savings_amount IS 'Automatically calculated from actual_spend * actual_savings_percentage';

-- ============================================================================
-- 2. TRIGGERS PARA CÁLCULO AUTOMÁTICO DE AHORROS
-- ============================================================================

-- Función para calcular ahorros proyectados
CREATE OR REPLACE FUNCTION calculate_projected_savings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estimated_spend IS NOT NULL AND NEW.projected_savings_percentage IS NOT NULL THEN
    NEW.projected_savings_amount := (NEW.estimated_spend * NEW.projected_savings_percentage / 100);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para ahorros proyectados
DROP TRIGGER IF EXISTS trigger_calculate_projected_savings ON sourcing_plans;
CREATE TRIGGER trigger_calculate_projected_savings
  BEFORE INSERT OR UPDATE OF estimated_spend, projected_savings_percentage
  ON sourcing_plans
  FOR EACH ROW
  EXECUTE FUNCTION calculate_projected_savings();

-- Función para calcular ahorros reales
CREATE OR REPLACE FUNCTION calculate_actual_savings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.actual_spend IS NOT NULL AND NEW.actual_savings_percentage IS NOT NULL THEN
    NEW.actual_savings_amount := (NEW.actual_spend * NEW.actual_savings_percentage / 100);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para ahorros reales
DROP TRIGGER IF EXISTS trigger_calculate_actual_savings ON sourcing_plans;
CREATE TRIGGER trigger_calculate_actual_savings
  BEFORE INSERT OR UPDATE OF actual_spend, actual_savings_percentage
  ON sourcing_plans
  FOR EACH ROW
  EXECUTE FUNCTION calculate_actual_savings();

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_update_sourcing_plans_updated_at ON sourcing_plans;
CREATE TRIGGER trigger_update_sourcing_plans_updated_at
  BEFORE UPDATE ON sourcing_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS
ALTER TABLE sourcing_plans ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios pueden ver los planes de su empresa
DROP POLICY IF EXISTS "Users can view sourcing plans from their company" ON sourcing_plans;
CREATE POLICY "Users can view sourcing plans from their company"
  ON sourcing_plans FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Los usuarios pueden insertar planes en su empresa
DROP POLICY IF EXISTS "Users can insert sourcing plans in their company" ON sourcing_plans;
CREATE POLICY "Users can insert sourcing plans in their company"
  ON sourcing_plans FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Los usuarios pueden actualizar planes de su empresa
DROP POLICY IF EXISTS "Users can update sourcing plans from their company" ON sourcing_plans;
CREATE POLICY "Users can update sourcing plans from their company"
  ON sourcing_plans FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Solo admins pueden eliminar planes
DROP POLICY IF EXISTS "Only admins can delete sourcing plans" ON sourcing_plans;
CREATE POLICY "Only admins can delete sourcing plans"
  ON sourcing_plans FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- 4. AGREGAR COLUMNAS A LICITACIONES Y PROJECTS
-- ============================================================================

-- Add sourcing_plan_id to licitaciones table
ALTER TABLE licitaciones 
ADD COLUMN IF NOT EXISTS sourcing_plan_id UUID REFERENCES sourcing_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_licitaciones_sourcing_plan 
ON licitaciones(sourcing_plan_id) 
WHERE sourcing_plan_id IS NOT NULL;

COMMENT ON COLUMN licitaciones.sourcing_plan_id IS 'Link to the sourcing plan initiative (optional)';

-- Add sourcing_plan_id to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS sourcing_plan_id UUID REFERENCES sourcing_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_sourcing_plan 
ON projects(sourcing_plan_id) 
WHERE sourcing_plan_id IS NOT NULL;

COMMENT ON COLUMN projects.sourcing_plan_id IS 'Link to the sourcing plan initiative (optional)';

-- ============================================================================
-- 5. VERIFICACIÓN
-- ============================================================================

-- Verificar que la tabla se creó correctamente
SELECT 
  'sourcing_plans' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'sourcing_plans';

-- Verificar RLS
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'sourcing_plans';

-- ============================================================================
-- SETUP COMPLETO ✅
-- ============================================================================
-- Si no hay errores, el módulo Sourcing Plan está listo para usar

