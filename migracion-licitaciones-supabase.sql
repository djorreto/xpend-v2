-- ============================================
-- MIGRACIÓN DE LICITACIONES - EJECUTAR EN SUPABASE SQL EDITOR
-- ============================================
-- Este script actualiza SOLO la estructura de licitaciones
-- NO afecta otras tablas existentes (companies, profiles, projects, etc.)
-- ============================================

-- PASO 1: Crear backup de licitaciones existentes (opcional pero recomendado)
-- Si tienes datos importantes, descomenta esto:
-- CREATE TABLE IF NOT EXISTS licitaciones_backup AS SELECT * FROM public.licitaciones;

-- PASO 2: Eliminar tipos ENUM antiguos y crear nuevos
DROP TYPE IF EXISTS licitacion_status CASCADE;
DROP TYPE IF EXISTS licitacion_type CASCADE;
DROP TYPE IF EXISTS licitacion_category CASCADE;
DROP TYPE IF EXISTS baseline_source CASCADE;

CREATE TYPE licitacion_status AS ENUM ('planned','bases_review','published','evaluation','awarded','contract_signed');
CREATE TYPE licitacion_type AS ENUM ('RFP','RFQ','RFI');
CREATE TYPE licitacion_category AS ENUM ('recurring_service','non_recurring_service','improvement_project','construction_project');
CREATE TYPE baseline_source AS ENUM ('historical','budget','other');

-- PASO 3: Crear tabla de departments (gerencias)
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, name)
);

-- PASO 4: Índice para departments
CREATE INDEX IF NOT EXISTS idx_departments_company_id ON public.departments(company_id);

-- PASO 5: Trigger para updated_at en departments
DROP TRIGGER IF EXISTS trg_departments_touch ON public.departments;
CREATE TRIGGER trg_departments_touch BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- PASO 6: Eliminar y recrear tabla licitaciones
DROP TABLE IF EXISTS public.licitaciones CASCADE;

CREATE TABLE public.licitaciones (
  id text PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status licitacion_status DEFAULT 'planned',
  type licitacion_type,
  category licitacion_category,
  
  -- Baseline y montos
  baseline_currency text DEFAULT 'USD',
  baseline_amount numeric(15,2),
  baseline_source baseline_source,
  awarded_amount numeric(15,2),
  savings_amount numeric(15,2),
  savings_percentage numeric(5,2),
  
  -- Gerencia y responsable
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  responsible_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Fechas del proceso
  request_date date,
  publication_date date,
  questions_date date,
  answers_date date,
  proposal_reception_date date,
  proposal_closing_date date,
  committee_date date,
  award_date date,
  contract_signature_date date,
  
  -- Documentos
  tender_document_path text,
  tender_document_name text,
  tender_document_size bigint,
  tender_link text,
  
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- PASO 7: Función para calcular ahorros automáticamente
CREATE OR REPLACE FUNCTION public.calculate_licitacion_savings()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF new.baseline_amount IS NOT NULL AND new.awarded_amount IS NOT NULL THEN
    new.savings_amount = new.baseline_amount - new.awarded_amount;
    IF new.baseline_amount > 0 THEN
      new.savings_percentage = (new.savings_amount / new.baseline_amount) * 100;
    ELSE
      new.savings_percentage = 0;
    END IF;
  ELSE
    new.savings_amount = NULL;
    new.savings_percentage = NULL;
  END IF;
  RETURN new;
END; $$;

-- PASO 8: Triggers para licitaciones
DROP TRIGGER IF EXISTS trg_licitaciones_calculate_savings ON public.licitaciones;
CREATE TRIGGER trg_licitaciones_calculate_savings 
BEFORE INSERT OR UPDATE ON public.licitaciones
FOR EACH ROW EXECUTE FUNCTION public.calculate_licitacion_savings();

DROP TRIGGER IF EXISTS trg_licitaciones_touch ON public.licitaciones;
CREATE TRIGGER trg_licitaciones_touch BEFORE UPDATE ON public.licitaciones
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- PASO 9: Índices para licitaciones
CREATE INDEX IF NOT EXISTS idx_licitaciones_company_id ON public.licitaciones(company_id);
CREATE INDEX IF NOT EXISTS idx_licitaciones_status ON public.licitaciones(status);
CREATE INDEX IF NOT EXISTS idx_licitaciones_department_id ON public.licitaciones(department_id);
CREATE INDEX IF NOT EXISTS idx_licitaciones_responsible_user_id ON public.licitaciones(responsible_user_id);

-- PASO 10: Actualizar tabla licitacion_documents (cambiar referencia de UUID a TEXT)
DROP TABLE IF EXISTS public.licitacion_documents CASCADE;

CREATE TABLE public.licitacion_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licitacion_id text NOT NULL REFERENCES public.licitaciones(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_current boolean DEFAULT true,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_licitacion_documents_licitacion_id ON public.licitacion_documents(licitacion_id);

-- PASO 11: Row Level Security (RLS) para departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "departments_select_by_company" ON public.departments;
CREATE POLICY "departments_select_by_company"
ON public.departments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = auth.uid() AND p.company_id = departments.company_id
));

DROP POLICY IF EXISTS "departments_write_by_company" ON public.departments;
CREATE POLICY "departments_write_by_company"
ON public.departments FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = auth.uid() AND p.company_id = departments.company_id
));

DROP POLICY IF EXISTS "departments_update_by_company" ON public.departments;
CREATE POLICY "departments_update_by_company"
ON public.departments FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = auth.uid() AND p.company_id = departments.company_id
));

DROP POLICY IF EXISTS "departments_delete_by_company" ON public.departments;
CREATE POLICY "departments_delete_by_company"
ON public.departments FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = auth.uid() AND p.company_id = departments.company_id
));

-- PASO 12: Row Level Security (RLS) para licitaciones
ALTER TABLE public.licitaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "licitaciones_select_by_company" ON public.licitaciones;
CREATE POLICY "licitaciones_select_by_company"
ON public.licitaciones FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = auth.uid() AND p.company_id = licitaciones.company_id
));

DROP POLICY IF EXISTS "licitaciones_write_by_company" ON public.licitaciones;
CREATE POLICY "licitaciones_write_by_company"
ON public.licitaciones FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = auth.uid() AND p.company_id = licitaciones.company_id
));

DROP POLICY IF EXISTS "licitaciones_update_by_company" ON public.licitaciones;
CREATE POLICY "licitaciones_update_by_company"
ON public.licitaciones FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = auth.uid() AND p.company_id = licitaciones.company_id
));

DROP POLICY IF EXISTS "licitaciones_delete_by_company" ON public.licitaciones;
CREATE POLICY "licitaciones_delete_by_company"
ON public.licitaciones FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = auth.uid() AND p.company_id = licitaciones.company_id
));

-- PASO 13: Row Level Security (RLS) para licitacion_documents
ALTER TABLE public.licitacion_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "licitacion_documents_select_by_company" ON public.licitacion_documents;
CREATE POLICY "licitacion_documents_select_by_company"
ON public.licitacion_documents FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM public.licitaciones l
  JOIN public.profiles p ON p.company_id = l.company_id AND p.id = auth.uid()
  WHERE l.id = licitacion_documents.licitacion_id
));

DROP POLICY IF EXISTS "licitacion_documents_write_by_company" ON public.licitacion_documents;
CREATE POLICY "licitacion_documents_write_by_company"
ON public.licitacion_documents FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.licitaciones l
  JOIN public.profiles p ON p.company_id = l.company_id AND p.id = auth.uid()
  WHERE l.id = licitacion_documents.licitacion_id
));

DROP POLICY IF EXISTS "licitacion_documents_delete_by_company" ON public.licitacion_documents;
CREATE POLICY "licitacion_documents_delete_by_company"
ON public.licitacion_documents FOR DELETE
USING (EXISTS (
  SELECT 1
  FROM public.licitaciones l
  JOIN public.profiles p ON p.company_id = l.company_id AND p.id = auth.uid()
  WHERE l.id = licitacion_documents.licitacion_id
));

-- PASO 14: Políticas de Storage para el bucket 'documents'
-- Nota: Asegúrate de crear el bucket 'documents' en Supabase Storage UI primero

DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "Users can view documents" ON storage.objects;
CREATE POLICY "Users can view documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "Users can update documents" ON storage.objects;
CREATE POLICY "Users can update documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "Users can delete documents" ON storage.objects;
CREATE POLICY "Users can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');

-- ============================================
-- VERIFICACIÓN
-- ============================================
-- Ejecuta estas queries para verificar que todo se creó correctamente:

-- Ver estructura de licitaciones
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'licitaciones' 
ORDER BY ordinal_position;

-- Ver departments
SELECT * FROM public.departments;

-- Ver políticas RLS
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('licitaciones', 'departments', 'licitacion_documents')
ORDER BY tablename, policyname;

-- ============================================
-- MIGRACIÓN COMPLETADA
-- ============================================
-- Próximos pasos:
-- 1. Crear bucket 'documents' en Supabase Storage (si no existe)
-- 2. Ir a /settings en tu app y crear las gerencias iniciales
-- 3. Crear una licitación de prueba con ID "LIC-2025-001"
-- ============================================

