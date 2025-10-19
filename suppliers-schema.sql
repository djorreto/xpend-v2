-- Esquema de base de datos para Gestión de Proveedores
-- Conectado al módulo de Licitaciones

-- Tabla de proveedores
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Datos básicos
    fantasy_name TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    rut TEXT NOT NULL,
    service_type TEXT NOT NULL,
    
    -- Contacto
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    website TEXT,
    
    -- Documentos
    nda_file_path TEXT,
    nda_file_name TEXT,
    nda_file_size INTEGER,
    nda_signed BOOLEAN DEFAULT FALSE,
    nda_signed_date DATE,
    
    -- Metadatos
    comments TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    -- Constraints
    UNIQUE(company_id, rut)
);

-- Tabla de evaluaciones administrativas (válidas por 1 año)
CREATE TABLE IF NOT EXISTS administrative_evaluations (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Evaluación de documentación base (0-100)
    documentation_score INTEGER CHECK (documentation_score >= 0 AND documentation_score <= 100),
    documentation_notes TEXT,
    
    -- Evaluación financiera (0-100)
    financial_score INTEGER CHECK (financial_score >= 0 AND financial_score <= 100),
    financial_notes TEXT,
    
    -- Evaluación de experiencia (0-100)
    experience_score INTEGER CHECK (experience_score >= 0 AND experience_score <= 100),
    experience_notes TEXT,
    
    -- Nota final administrativa (promedio ponderado)
    final_score DECIMAL(5,2) CHECK (final_score >= 0 AND final_score <= 100),
    
    -- Vigencia
    evaluation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE NOT NULL,
    
    -- Metadatos
    evaluator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CHECK (valid_until = evaluation_date + INTERVAL '1 year')
);

-- Tabla de evaluaciones técnicas (por licitación + proveedor)
CREATE TABLE IF NOT EXISTS technical_evaluations (
    id TEXT PRIMARY KEY,
    licitacion_id TEXT NOT NULL REFERENCES licitaciones(id) ON DELETE CASCADE,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Evaluación de prevención de riesgos (0-100)
    risk_prevention_score INTEGER CHECK (risk_prevention_score >= 0 AND risk_prevention_score <= 100),
    risk_prevention_notes TEXT,
    
    -- Evaluación de propuesta técnica (0-100)
    technical_proposal_score INTEGER CHECK (technical_proposal_score >= 0 AND technical_proposal_score <= 100),
    technical_proposal_notes TEXT,
    
    -- Nota final técnica
    final_score DECIMAL(5,2) CHECK (final_score >= 0 AND final_score <= 100),
    
    -- Metadatos
    evaluator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(licitacion_id, supplier_id)
);

-- Tabla de ponderaciones por licitación
CREATE TABLE IF NOT EXISTS licitacion_weightings (
    id TEXT PRIMARY KEY,
    licitacion_id TEXT NOT NULL REFERENCES licitaciones(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Ponderaciones (deben sumar 1.0)
    administrative_weight DECIMAL(3,2) NOT NULL DEFAULT 0.4 CHECK (administrative_weight >= 0 AND administrative_weight <= 1),
    technical_weight DECIMAL(3,2) NOT NULL DEFAULT 0.6 CHECK (technical_weight >= 0 AND technical_weight <= 1),
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(licitacion_id),
    CHECK (administrative_weight + technical_weight = 1.0)
);

-- Tabla de participación de proveedores en licitaciones
CREATE TABLE IF NOT EXISTS licitacion_suppliers (
    id TEXT PRIMARY KEY,
    licitacion_id TEXT NOT NULL REFERENCES licitaciones(id) ON DELETE CASCADE,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Estado de participación
    status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'evaluated', 'awarded', 'rejected')),
    
    -- Notas finales calculadas
    administrative_score DECIMAL(5,2),
    technical_score DECIMAL(5,2),
    final_weighted_score DECIMAL(5,2),
    
    -- Metadatos
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(licitacion_id, supplier_id)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_rut ON suppliers(rut);
CREATE INDEX IF NOT EXISTS idx_suppliers_service_type ON suppliers(service_type);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);

CREATE INDEX IF NOT EXISTS idx_admin_eval_supplier_id ON administrative_evaluations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_admin_eval_company_id ON administrative_evaluations(company_id);
CREATE INDEX IF NOT EXISTS idx_admin_eval_valid_until ON administrative_evaluations(valid_until);

CREATE INDEX IF NOT EXISTS idx_tech_eval_licitacion_id ON technical_evaluations(licitacion_id);
CREATE INDEX IF NOT EXISTS idx_tech_eval_supplier_id ON technical_evaluations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_tech_eval_company_id ON technical_evaluations(company_id);

CREATE INDEX IF NOT EXISTS idx_licitacion_suppliers_licitacion_id ON licitacion_suppliers(licitacion_id);
CREATE INDEX IF NOT EXISTS idx_licitacion_suppliers_supplier_id ON licitacion_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_licitacion_suppliers_company_id ON licitacion_suppliers(company_id);

-- Función para calcular nota final administrativa
CREATE OR REPLACE FUNCTION calculate_administrative_final_score()
RETURNS TRIGGER AS $$
BEGIN
    -- Calcular promedio simple de las tres evaluaciones
    NEW.final_score = (
        COALESCE(NEW.documentation_score, 0) + 
        COALESCE(NEW.financial_score, 0) + 
        COALESCE(NEW.experience_score, 0)
    ) / 3.0;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular nota final administrativa
CREATE TRIGGER calculate_administrative_final_score_trigger
    BEFORE INSERT OR UPDATE ON administrative_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION calculate_administrative_final_score();

-- Función para calcular nota final técnica
CREATE OR REPLACE FUNCTION calculate_technical_final_score()
RETURNS TRIGGER AS $$
BEGIN
    -- Calcular promedio simple de las dos evaluaciones
    NEW.final_score = (
        COALESCE(NEW.risk_prevention_score, 0) + 
        COALESCE(NEW.technical_proposal_score, 0)
    ) / 2.0;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular nota final técnica
CREATE TRIGGER calculate_technical_final_score_trigger
    BEFORE INSERT OR UPDATE ON technical_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION calculate_technical_final_score();

-- Función para calcular nota ponderada final
CREATE OR REPLACE FUNCTION calculate_weighted_final_score()
RETURNS TRIGGER AS $$
DECLARE
    admin_weight DECIMAL(3,2);
    tech_weight DECIMAL(3,2);
BEGIN
    -- Obtener ponderaciones de la licitación
    SELECT administrative_weight, technical_weight
    INTO admin_weight, tech_weight
    FROM licitacion_weightings
    WHERE licitacion_id = NEW.licitacion_id;
    
    -- Si no hay ponderaciones definidas, usar valores por defecto
    IF admin_weight IS NULL THEN
        admin_weight := 0.4;
        tech_weight := 0.6;
    END IF;
    
    -- Calcular nota ponderada
    NEW.final_weighted_score = (
        COALESCE(NEW.administrative_score, 0) * admin_weight +
        COALESCE(NEW.technical_score, 0) * tech_weight
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular nota ponderada final
CREATE TRIGGER calculate_weighted_final_score_trigger
    BEFORE INSERT OR UPDATE ON licitacion_suppliers
    FOR EACH ROW
    EXECUTE FUNCTION calculate_weighted_final_score();

-- Políticas RLS para suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view suppliers from their company" ON suppliers
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert suppliers to their company" ON suppliers
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update suppliers from their company" ON suppliers
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete suppliers from their company" ON suppliers
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Políticas RLS para administrative_evaluations
ALTER TABLE administrative_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view admin evaluations from their company" ON administrative_evaluations
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert admin evaluations to their company" ON administrative_evaluations
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update admin evaluations from their company" ON administrative_evaluations
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete admin evaluations from their company" ON administrative_evaluations
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Políticas RLS para technical_evaluations
ALTER TABLE technical_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tech evaluations from their company" ON technical_evaluations
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert tech evaluations to their company" ON technical_evaluations
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update tech evaluations from their company" ON technical_evaluations
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete tech evaluations from their company" ON technical_evaluations
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Políticas RLS para licitacion_weightings
ALTER TABLE licitacion_weightings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view weightings from their company" ON licitacion_weightings
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert weightings to their company" ON licitacion_weightings
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update weightings from their company" ON licitacion_weightings
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete weightings from their company" ON licitacion_weightings
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Políticas RLS para licitacion_suppliers
ALTER TABLE licitacion_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view licitacion suppliers from their company" ON licitacion_suppliers
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert licitacion suppliers to their company" ON licitacion_suppliers
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update licitacion suppliers from their company" ON licitacion_suppliers
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete licitacion suppliers from their company" ON licitacion_suppliers
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );
