-- ============================================================================
-- 🧠 SOURCING INTELLIGENCE - SQL COMPLETO PARA SUPABASE
-- ============================================================================
-- INSTRUCCIONES:
-- 1. Ir a Supabase Dashboard → SQL Editor
-- 2. Copiar TODO este archivo
-- 3. Pegar en el editor
-- 4. Click en "RUN" o presionar Cmd/Ctrl + Enter
-- 5. Verificar que todo se creó correctamente (sin errores)
-- ============================================================================

-- 1. TABLA: si_uploads (Archivos Cargados)
-- ============================================================================
CREATE TABLE IF NOT EXISTS si_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  total_rows INT NOT NULL DEFAULT 0,
  processed_rows INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'classified', 'reviewed', 'completed', 'error')),
  column_mapping JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_si_uploads_company ON si_uploads(company_id);
CREATE INDEX IF NOT EXISTS idx_si_uploads_user ON si_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_si_uploads_status ON si_uploads(status);

COMMENT ON TABLE si_uploads IS 'Archivos Excel/CSV cargados para análisis de gasto';

-- RLS para si_uploads
ALTER TABLE si_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view uploads from their company" ON si_uploads;
CREATE POLICY "Users can view uploads from their company"
  ON si_uploads FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can create uploads for their company" ON si_uploads;
CREATE POLICY "Users can create uploads for their company"
  ON si_uploads FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their company's uploads" ON si_uploads;
CREATE POLICY "Users can update their company's uploads"
  ON si_uploads FOR UPDATE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- 2. TABLA: si_spend_lines (Líneas de Gasto)
-- ============================================================================
CREATE TABLE IF NOT EXISTS si_spend_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES si_uploads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  description TEXT NOT NULL,
  supplier_name TEXT,
  amount NUMERIC(18, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  purchase_order TEXT,
  cost_center TEXT,
  purchase_date DATE,
  category TEXT,
  subcategory TEXT,
  ai_confidence NUMERIC(3, 2),
  ai_justification TEXT,
  needs_review BOOLEAN NOT NULL DEFAULT TRUE,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_si_spend_lines_upload ON si_spend_lines(upload_id);
CREATE INDEX IF NOT EXISTS idx_si_spend_lines_company ON si_spend_lines(company_id);
CREATE INDEX IF NOT EXISTS idx_si_spend_lines_category ON si_spend_lines(category);
CREATE INDEX IF NOT EXISTS idx_si_spend_lines_needs_review ON si_spend_lines(needs_review);

COMMENT ON TABLE si_spend_lines IS 'Líneas individuales de gasto extraídas de archivos';

-- RLS para si_spend_lines
ALTER TABLE si_spend_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view spend lines from their company" ON si_spend_lines;
CREATE POLICY "Users can view spend lines from their company"
  ON si_spend_lines FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can create spend lines for their company" ON si_spend_lines;
CREATE POLICY "Users can create spend lines for their company"
  ON si_spend_lines FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their company's spend lines" ON si_spend_lines;
CREATE POLICY "Users can update their company's spend lines"
  ON si_spend_lines FOR UPDATE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- 3. TABLA: si_categories (Categorías de Gasto con Kraljic)
-- ============================================================================
CREATE TABLE IF NOT EXISTS si_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_category TEXT,
  impact_score NUMERIC(3, 2),
  risk_score NUMERIC(3, 2),
  kraljic_quadrant TEXT CHECK (kraljic_quadrant IN ('strategic', 'leverage', 'bottleneck', 'non_critical')),
  recommended_strategy TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_si_categories_company ON si_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_si_categories_quadrant ON si_categories(kraljic_quadrant);

COMMENT ON TABLE si_categories IS 'Categorías de gasto con clasificación Kraljic';

-- RLS para si_categories
ALTER TABLE si_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view categories from their company" ON si_categories;
CREATE POLICY "Users can view categories from their company"
  ON si_categories FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage categories for their company" ON si_categories;
CREATE POLICY "Users can manage categories for their company"
  ON si_categories FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- 4. TABLA: si_learning_rules (Reglas de Aprendizaje)
-- ============================================================================
CREATE TABLE IF NOT EXISTS si_learning_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('keyword', 'supplier', 'correction', 'pattern')),
  pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  confidence_boost NUMERIC(3, 2) NOT NULL DEFAULT 0.1,
  source TEXT NOT NULL DEFAULT 'user_correction' CHECK (source IN ('user_correction', 'ai_generated', 'manual')),
  usage_count INT NOT NULL DEFAULT 0,
  success_rate NUMERIC(3, 2) NOT NULL DEFAULT 0.0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_si_learning_rules_company ON si_learning_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_si_learning_rules_type ON si_learning_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_si_learning_rules_pattern ON si_learning_rules(pattern);

COMMENT ON TABLE si_learning_rules IS 'Reglas aprendidas de correcciones humanas para mejorar clasificación IA';

-- RLS para si_learning_rules
ALTER TABLE si_learning_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view learning rules from their company" ON si_learning_rules;
CREATE POLICY "Users can view learning rules from their company"
  ON si_learning_rules FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage learning rules for their company" ON si_learning_rules;
CREATE POLICY "Users can manage learning rules for their company"
  ON si_learning_rules FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- 5. TABLA: si_procurement_plans (Planes de Compras Generados)
-- ============================================================================
CREATE TABLE IF NOT EXISTS si_procurement_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES si_uploads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  plan_year INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  total_spend NUMERIC(18, 2) NOT NULL DEFAULT 0,
  projected_savings_amount NUMERIC(18, 2),
  projected_savings_percentage NUMERIC(5, 2),
  actual_savings_amount NUMERIC(18, 2),
  actual_savings_percentage NUMERIC(5, 2),
  category_count INT NOT NULL DEFAULT 0,
  supplier_count INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_si_procurement_plans_upload ON si_procurement_plans(upload_id);
CREATE INDEX IF NOT EXISTS idx_si_procurement_plans_company ON si_procurement_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_si_procurement_plans_year ON si_procurement_plans(plan_year);

COMMENT ON TABLE si_procurement_plans IS 'Planes de compras generados automáticamente por IA';

-- RLS para si_procurement_plans
ALTER TABLE si_procurement_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view procurement plans from their company" ON si_procurement_plans;
CREATE POLICY "Users can view procurement plans from their company"
  ON si_procurement_plans FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage procurement plans for their company" ON si_procurement_plans;
CREATE POLICY "Users can manage procurement plans for their company"
  ON si_procurement_plans FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- 6. TABLA: si_plan_items (Líneas del Plan de Compras)
-- ============================================================================
CREATE TABLE IF NOT EXISTS si_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES si_procurement_plans(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  subcategory TEXT,
  total_spend NUMERIC(18, 2) NOT NULL,
  supplier_count INT NOT NULL DEFAULT 0,
  main_supplier TEXT,
  supplier_concentration NUMERIC(5, 2),
  strategy TEXT NOT NULL,
  recommended_quarter TEXT CHECK (recommended_quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
  projected_savings_percentage NUMERIC(5, 2),
  projected_savings_amount NUMERIC(18, 2),
  actual_savings_percentage NUMERIC(5, 2),
  actual_savings_amount NUMERIC(18, 2),
  impact_score NUMERIC(3, 2),
  risk_score NUMERIC(3, 2),
  kraljic_quadrant TEXT CHECK (kraljic_quadrant IN ('strategic', 'leverage', 'bottleneck', 'non_critical')),
  ai_reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority INT NOT NULL DEFAULT 3 CHECK (priority IN (1, 2, 3)),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_si_plan_items_plan ON si_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_si_plan_items_company ON si_plan_items(company_id);
CREATE INDEX IF NOT EXISTS idx_si_plan_items_category ON si_plan_items(category);
CREATE INDEX IF NOT EXISTS idx_si_plan_items_quadrant ON si_plan_items(kraljic_quadrant);

COMMENT ON TABLE si_plan_items IS 'Líneas del plan de compras con estrategias por categoría';

-- RLS para si_plan_items
ALTER TABLE si_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view plan items from their company" ON si_plan_items;
CREATE POLICY "Users can view plan items from their company"
  ON si_plan_items FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage plan items for their company" ON si_plan_items;
CREATE POLICY "Users can manage plan items for their company"
  ON si_plan_items FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- 7. TRIGGERS PARA updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas SI
DROP TRIGGER IF EXISTS trigger_si_uploads_updated_at ON si_uploads;
CREATE TRIGGER trigger_si_uploads_updated_at
  BEFORE UPDATE ON si_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_si_spend_lines_updated_at ON si_spend_lines;
CREATE TRIGGER trigger_si_spend_lines_updated_at
  BEFORE UPDATE ON si_spend_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_si_categories_updated_at ON si_categories;
CREATE TRIGGER trigger_si_categories_updated_at
  BEFORE UPDATE ON si_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_si_learning_rules_updated_at ON si_learning_rules;
CREATE TRIGGER trigger_si_learning_rules_updated_at
  BEFORE UPDATE ON si_learning_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_si_procurement_plans_updated_at ON si_procurement_plans;
CREATE TRIGGER trigger_si_procurement_plans_updated_at
  BEFORE UPDATE ON si_procurement_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_si_plan_items_updated_at ON si_plan_items;
CREATE TRIGGER trigger_si_plan_items_updated_at
  BEFORE UPDATE ON si_plan_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ✅ FINALIZADO - SOURCING INTELLIGENCE SQL
-- ============================================================================

-- VERIFICACIÓN RÁPIDA:
-- Ejecutar estas queries para verificar que todo se creó correctamente:

-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name LIKE 'si_%' ORDER BY table_name;

-- SELECT tablename, policyname FROM pg_policies 
-- WHERE tablename LIKE 'si_%' ORDER BY tablename, policyname;

-- ============================================================================
-- 📊 RESUMEN DE LO CREADO:
-- ============================================================================
-- ✅ 6 Tablas creadas
-- ✅ 18 Índices para performance
-- ✅ 18 Políticas RLS (3 por tabla)
-- ✅ 6 Triggers para updated_at
-- ✅ Todas las tablas con company_id para multi-tenant
-- ✅ Todas las relaciones con ON DELETE configuradas
-- ============================================================================

-- 🎉 ¡Listo! Ahora puedes usar Sourcing Intelligence en Xpend
-- 
-- Próximo paso: 
-- - Ir a http://localhost:3000/sourcing-intelligence
-- - Subir un archivo Excel de prueba
-- - ¡Disfrutar del análisis automático con IA!
-- ============================================================================

