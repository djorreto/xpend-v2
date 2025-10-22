-- ============================================================================
-- SOURCING INTELLIGENCE MODULE
-- ============================================================================
-- Este módulo permite analizar datos de gasto cargados desde Excel/CSV,
-- clasificarlos automáticamente con IA, y generar un Plan de Compras
-- preliminar con Matriz de Kraljic interactiva.
-- ============================================================================

-- 1. TABLA: SI_UPLOADS (Archivos cargados)
-- ============================================================================
CREATE TABLE IF NOT EXISTS si_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'classified', 'reviewed', 'completed', 'error')),
  column_mapping JSONB, -- Mapeo de columnas detectadas
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_si_uploads_company_id ON si_uploads(company_id);
CREATE INDEX IF NOT EXISTS idx_si_uploads_user_id ON si_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_si_uploads_status ON si_uploads(status);

COMMENT ON TABLE si_uploads IS 'Archivos de gasto cargados por usuarios para análisis IA';
COMMENT ON COLUMN si_uploads.column_mapping IS 'JSON con mapeo de columnas del archivo (ej: {"oc": "A", "descripcion": "B"})';

-- 2. TABLA: SI_SPEND_LINES (Líneas de gasto del archivo)
-- ============================================================================
CREATE TABLE IF NOT EXISTS si_spend_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES si_uploads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Datos originales
  purchase_order TEXT,
  line_number INTEGER,
  description TEXT NOT NULL,
  supplier_name TEXT,
  supplier_code TEXT,
  amount NUMERIC(18, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  cost_center TEXT,
  purchase_date DATE,

  -- Clasificación IA
  category TEXT,
  subcategory TEXT,
  ai_confidence NUMERIC(3, 2), -- 0.00 a 1.00
  ai_justification TEXT,
  needs_review BOOLEAN DEFAULT TRUE,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,

  -- Metadatos
  raw_data JSONB, -- Datos completos del Excel
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_si_spend_lines_upload_id ON si_spend_lines(upload_id);
CREATE INDEX IF NOT EXISTS idx_si_spend_lines_company_id ON si_spend_lines(company_id);
CREATE INDEX IF NOT EXISTS idx_si_spend_lines_category ON si_spend_lines(category);
CREATE INDEX IF NOT EXISTS idx_si_spend_lines_needs_review ON si_spend_lines(needs_review);
CREATE INDEX IF NOT EXISTS idx_si_spend_lines_supplier_name ON si_spend_lines(supplier_name);

COMMENT ON TABLE si_spend_lines IS 'Líneas individuales de gasto con clasificación IA';
COMMENT ON COLUMN si_spend_lines.ai_confidence IS 'Nivel de confianza de la IA (0.0 a 1.0)';
COMMENT ON COLUMN si_spend_lines.needs_review IS 'TRUE si requiere revisión humana (baja confianza)';

-- 3. TABLA: SI_CATEGORIES (Categorías de gasto aprendidas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS si_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_category TEXT,
  description TEXT,
  keywords JSONB, -- Array de palabras clave
  spend_total NUMERIC(18, 2) DEFAULT 0,
  supplier_count INTEGER DEFAULT 0,

  -- Parámetros Kraljic
  impact_score NUMERIC(3, 2), -- 0.00 a 1.00
  risk_score NUMERIC(3, 2), -- 0.00 a 1.00
  kraljic_quadrant TEXT CHECK (kraljic_quadrant IN ('non_critical', 'leverage', 'bottleneck', 'strategic')),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_category_per_company UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_si_categories_company_id ON si_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_si_categories_kraljic ON si_categories(kraljic_quadrant);

COMMENT ON TABLE si_categories IS 'Categorías de gasto con parámetros Kraljic';
COMMENT ON COLUMN si_categories.keywords IS 'Array JSON de palabras clave para clasificación';
COMMENT ON COLUMN si_categories.impact_score IS 'Impacto en negocio (0.0 a 1.0)';
COMMENT ON COLUMN si_categories.risk_score IS 'Riesgo de abastecimiento (0.0 a 1.0)';

-- 4. TABLA: SI_LEARNING_RULES (Reglas aprendidas del usuario)
-- ============================================================================
CREATE TABLE IF NOT EXISTS si_learning_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('keyword', 'supplier', 'correction', 'few_shot')),

  -- Patrón de la regla
  pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  confidence_boost NUMERIC(3, 2) DEFAULT 0.1, -- Incremento de confianza al aplicar

  -- Metadata
  source TEXT, -- 'user_correction', 'ai_suggestion', 'manual'
  usage_count INTEGER DEFAULT 0,
  success_rate NUMERIC(3, 2) DEFAULT 1.0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_si_learning_rules_company_id ON si_learning_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_si_learning_rules_rule_type ON si_learning_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_si_learning_rules_category ON si_learning_rules(category);

COMMENT ON TABLE si_learning_rules IS 'Reglas de clasificación aprendidas del usuario';
COMMENT ON COLUMN si_learning_rules.pattern IS 'Patrón a buscar (keyword, nombre de proveedor, etc.)';
COMMENT ON COLUMN si_learning_rules.confidence_boost IS 'Incremento de confianza cuando se aplica la regla';

-- 5. TABLA: SI_PROCUREMENT_PLANS (Planes de compras generados)
-- ============================================================================
CREATE TABLE IF NOT EXISTS si_procurement_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES si_uploads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  plan_year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'proposed', 'approved', 'in_progress', 'completed')),

  -- Metadata del análisis
  total_spend NUMERIC(18, 2) NOT NULL,
  category_count INTEGER NOT NULL,
  supplier_count INTEGER NOT NULL,
  projected_savings_amount NUMERIC(18, 2),
  projected_savings_percentage NUMERIC(5, 2),

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_si_procurement_plans_company_id ON si_procurement_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_si_procurement_plans_upload_id ON si_procurement_plans(upload_id);

COMMENT ON TABLE si_procurement_plans IS 'Planes de compras generados desde análisis IA';

-- 6. TABLA: SI_PLAN_ITEMS (Líneas del plan de compras)
-- ============================================================================
CREATE TABLE IF NOT EXISTS si_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES si_procurement_plans(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL,

  -- Análisis de gasto
  total_spend NUMERIC(18, 2) NOT NULL,
  supplier_count INTEGER NOT NULL,
  main_supplier TEXT,
  supplier_concentration NUMERIC(5, 2), -- % del proveedor principal

  -- Estrategia sugerida
  strategy TEXT NOT NULL, -- 'licitar', 'consolidar', 'negociar_marco', 'dual_sourcing', 'monitorear'
  recommended_quarter TEXT, -- 'Q1', 'Q2', 'Q3', 'Q4'
  projected_savings_percentage NUMERIC(5, 2),
  projected_savings_amount NUMERIC(18, 2),

  -- Justificación IA
  ai_reasoning TEXT,

  -- Kraljic
  impact_score NUMERIC(3, 2),
  risk_score NUMERIC(3, 2),
  kraljic_quadrant TEXT CHECK (kraljic_quadrant IN ('non_critical', 'leverage', 'bottleneck', 'strategic')),

  -- Estado
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in_progress', 'completed')),
  priority INTEGER DEFAULT 3, -- 1=alta, 2=media, 3=baja

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_si_plan_items_plan_id ON si_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_si_plan_items_company_id ON si_plan_items(company_id);
CREATE INDEX IF NOT EXISTS idx_si_plan_items_category ON si_plan_items(category);
CREATE INDEX IF NOT EXISTS idx_si_plan_items_kraljic ON si_plan_items(kraljic_quadrant);

COMMENT ON TABLE si_plan_items IS 'Líneas individuales del plan de compras con estrategias sugeridas';
COMMENT ON COLUMN si_plan_items.strategy IS 'Estrategia de sourcing recomendada por IA';
COMMENT ON COLUMN si_plan_items.supplier_concentration IS 'Porcentaje de gasto del proveedor principal';

-- 7. TRIGGERS
-- ============================================================================

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_si_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_si_uploads_updated_at ON si_uploads;
CREATE TRIGGER trigger_si_uploads_updated_at
  BEFORE UPDATE ON si_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_si_updated_at_column();

DROP TRIGGER IF EXISTS trigger_si_spend_lines_updated_at ON si_spend_lines;
CREATE TRIGGER trigger_si_spend_lines_updated_at
  BEFORE UPDATE ON si_spend_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_si_updated_at_column();

DROP TRIGGER IF EXISTS trigger_si_categories_updated_at ON si_categories;
CREATE TRIGGER trigger_si_categories_updated_at
  BEFORE UPDATE ON si_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_si_updated_at_column();

DROP TRIGGER IF EXISTS trigger_si_learning_rules_updated_at ON si_learning_rules;
CREATE TRIGGER trigger_si_learning_rules_updated_at
  BEFORE UPDATE ON si_learning_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_si_updated_at_column();

DROP TRIGGER IF EXISTS trigger_si_procurement_plans_updated_at ON si_procurement_plans;
CREATE TRIGGER trigger_si_procurement_plans_updated_at
  BEFORE UPDATE ON si_procurement_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_si_updated_at_column();

DROP TRIGGER IF EXISTS trigger_si_plan_items_updated_at ON si_plan_items;
CREATE TRIGGER trigger_si_plan_items_updated_at
  BEFORE UPDATE ON si_plan_items
  FOR EACH ROW
  EXECUTE FUNCTION update_si_updated_at_column();

-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE si_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE si_spend_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE si_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE si_learning_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE si_procurement_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE si_plan_items ENABLE ROW LEVEL SECURITY;

-- Políticas para si_uploads
DROP POLICY IF EXISTS "Users can view uploads from their company" ON si_uploads;
CREATE POLICY "Users can view uploads from their company"
  ON si_uploads FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can create uploads for their company" ON si_uploads;
CREATE POLICY "Users can create uploads for their company"
  ON si_uploads FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update uploads from their company" ON si_uploads;
CREATE POLICY "Users can update uploads from their company"
  ON si_uploads FOR UPDATE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Políticas para si_spend_lines
DROP POLICY IF EXISTS "Users can view spend lines from their company" ON si_spend_lines;
CREATE POLICY "Users can view spend lines from their company"
  ON si_spend_lines FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can create spend lines for their company" ON si_spend_lines;
CREATE POLICY "Users can create spend lines for their company"
  ON si_spend_lines FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update spend lines from their company" ON si_spend_lines;
CREATE POLICY "Users can update spend lines from their company"
  ON si_spend_lines FOR UPDATE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Políticas para si_categories
DROP POLICY IF EXISTS "Users can view categories from their company" ON si_categories;
CREATE POLICY "Users can view categories from their company"
  ON si_categories FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can create categories for their company" ON si_categories;
CREATE POLICY "Users can create categories for their company"
  ON si_categories FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update categories from their company" ON si_categories;
CREATE POLICY "Users can update categories from their company"
  ON si_categories FOR UPDATE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Políticas para si_learning_rules
DROP POLICY IF EXISTS "Users can view learning rules from their company" ON si_learning_rules;
CREATE POLICY "Users can view learning rules from their company"
  ON si_learning_rules FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can create learning rules for their company" ON si_learning_rules;
CREATE POLICY "Users can create learning rules for their company"
  ON si_learning_rules FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update learning rules from their company" ON si_learning_rules;
CREATE POLICY "Users can update learning rules from their company"
  ON si_learning_rules FOR UPDATE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete learning rules from their company" ON si_learning_rules;
CREATE POLICY "Users can delete learning rules from their company"
  ON si_learning_rules FOR DELETE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Políticas para si_procurement_plans
DROP POLICY IF EXISTS "Users can view procurement plans from their company" ON si_procurement_plans;
CREATE POLICY "Users can view procurement plans from their company"
  ON si_procurement_plans FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can create procurement plans for their company" ON si_procurement_plans;
CREATE POLICY "Users can create procurement plans for their company"
  ON si_procurement_plans FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update procurement plans from their company" ON si_procurement_plans;
CREATE POLICY "Users can update procurement plans from their company"
  ON si_procurement_plans FOR UPDATE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Políticas para si_plan_items
DROP POLICY IF EXISTS "Users can view plan items from their company" ON si_plan_items;
CREATE POLICY "Users can view plan items from their company"
  ON si_plan_items FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can create plan items for their company" ON si_plan_items;
CREATE POLICY "Users can create plan items for their company"
  ON si_plan_items FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update plan items from their company" ON si_plan_items;
CREATE POLICY "Users can update plan items from their company"
  ON si_plan_items FOR UPDATE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- FINALIZADO - SOURCING INTELLIGENCE DATABASE SCHEMA
-- ============================================================================

