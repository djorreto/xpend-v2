-- =====================================================
-- SOURCING PLAN MODULE
-- Módulo de planificación anual de Strategic Sourcing
-- =====================================================

-- Tabla principal: sourcing_plans
CREATE TABLE IF NOT EXISTS sourcing_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Información de planificación
  plan_year INTEGER NOT NULL,
  quarter VARCHAR(2) NOT NULL CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
  
  -- Tipo y descripción
  initiative_type VARCHAR(20) NOT NULL CHECK (initiative_type IN ('licitacion', 'project')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Categoría y departamento
  category VARCHAR(100),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  
  -- Montos y ahorros proyectados
  estimated_spend DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  projected_savings_percentage DECIMAL(5,2) DEFAULT 0,
  projected_savings_amount DECIMAL(15,2) DEFAULT 0,
  
  -- Proveedores actuales (si aplica)
  current_suppliers JSONB DEFAULT '[]', -- Array de {id, name}
  
  -- Estado del plan
  status VARCHAR(20) NOT NULL DEFAULT 'planned' 
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  
  -- Resultado real (cuando se completa)
  actual_spend DECIMAL(15,2),
  actual_savings_amount DECIMAL(15,2),
  actual_savings_percentage DECIMAL(5,2),
  
  -- Asociación con ejecución real
  linked_licitacion_id UUID REFERENCES licitaciones(id) ON DELETE SET NULL,
  linked_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  is_spot BOOLEAN DEFAULT false, -- Marcado como iniciativa Spot si no estaba planificada
  
  -- Fechas
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_completion_date DATE,
  
  -- Responsable
  responsible_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Notas y observaciones
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices compuestos
  CONSTRAINT unique_plan_year_quarter UNIQUE (company_id, plan_year, title)
);

-- Índices para mejorar performance
CREATE INDEX idx_sourcing_plans_company ON sourcing_plans(company_id);
CREATE INDEX idx_sourcing_plans_year ON sourcing_plans(plan_year);
CREATE INDEX idx_sourcing_plans_quarter ON sourcing_plans(quarter);
CREATE INDEX idx_sourcing_plans_status ON sourcing_plans(status);
CREATE INDEX idx_sourcing_plans_type ON sourcing_plans(initiative_type);
CREATE INDEX idx_sourcing_plans_licitacion ON sourcing_plans(linked_licitacion_id);
CREATE INDEX idx_sourcing_plans_project ON sourcing_plans(linked_project_id);
CREATE INDEX idx_sourcing_plans_year_quarter ON sourcing_plans(company_id, plan_year, quarter);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_sourcing_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sourcing_plans_updated_at
  BEFORE UPDATE ON sourcing_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_sourcing_plans_updated_at();

-- Trigger para calcular savings automáticamente
CREATE OR REPLACE FUNCTION calculate_sourcing_plan_savings()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular projected savings amount si solo se dio el porcentaje
  IF NEW.projected_savings_percentage IS NOT NULL AND NEW.estimated_spend IS NOT NULL THEN
    NEW.projected_savings_amount = (NEW.estimated_spend * NEW.projected_savings_percentage / 100);
  END IF;
  
  -- Calcular actual savings amount y percentage cuando se completa
  IF NEW.status = 'completed' AND NEW.estimated_spend IS NOT NULL AND NEW.actual_spend IS NOT NULL THEN
    NEW.actual_savings_amount = NEW.estimated_spend - NEW.actual_spend;
    IF NEW.estimated_spend > 0 THEN
      NEW.actual_savings_percentage = ((NEW.estimated_spend - NEW.actual_spend) / NEW.estimated_spend) * 100;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_sourcing_plan_savings
  BEFORE INSERT OR UPDATE ON sourcing_plans
  FOR EACH ROW
  EXECUTE FUNCTION calculate_sourcing_plan_savings();

-- =====================================================
-- MODIFICACIONES A TABLAS EXISTENTES
-- =====================================================

-- Agregar campos a licitaciones para asociación con plan
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS sourcing_plan_id UUID REFERENCES sourcing_plans(id) ON DELETE SET NULL;
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS is_spot BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_licitaciones_sourcing_plan ON licitaciones(sourcing_plan_id);

-- Agregar campos a projects para asociación con plan
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sourcing_plan_id UUID REFERENCES sourcing_plans(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_spot BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_projects_sourcing_plan ON projects(sourcing_plan_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE sourcing_plans ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios solo ven planes de su empresa
CREATE POLICY sourcing_plans_select_policy ON sourcing_plans
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Solo Admin y Procurement pueden insertar
CREATE POLICY sourcing_plans_insert_policy ON sourcing_plans
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Policy: Solo Admin y Procurement pueden actualizar
CREATE POLICY sourcing_plans_update_policy ON sourcing_plans
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Policy: Solo Admin puede eliminar
CREATE POLICY sourcing_plans_delete_policy ON sourcing_plans
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- =====================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE sourcing_plans IS 'Plan anual de Strategic Sourcing - iniciativas planificadas vs ejecutadas';
COMMENT ON COLUMN sourcing_plans.plan_year IS 'Año del plan de sourcing';
COMMENT ON COLUMN sourcing_plans.quarter IS 'Trimestre planificado (Q1-Q4)';
COMMENT ON COLUMN sourcing_plans.initiative_type IS 'Tipo de iniciativa: licitacion o project';
COMMENT ON COLUMN sourcing_plans.estimated_spend IS 'Gasto estimado en el plan';
COMMENT ON COLUMN sourcing_plans.projected_savings_percentage IS 'Porcentaje de ahorro proyectado';
COMMENT ON COLUMN sourcing_plans.projected_savings_amount IS 'Monto de ahorro proyectado (calculado)';
COMMENT ON COLUMN sourcing_plans.actual_savings_amount IS 'Ahorro real obtenido al completar';
COMMENT ON COLUMN sourcing_plans.status IS 'Estado: planned, in_progress, completed, cancelled';
COMMENT ON COLUMN sourcing_plans.is_spot IS 'TRUE si es iniciativa fuera del plan';
COMMENT ON COLUMN sourcing_plans.linked_licitacion_id IS 'ID de licitación asociada si existe';
COMMENT ON COLUMN sourcing_plans.linked_project_id IS 'ID de proyecto asociado si existe';

