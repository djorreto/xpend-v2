-- Script para poblar gerencias predeterminadas
-- Este script debe ejecutarse después de crear una empresa

-- Nota: Reemplaza 'YOUR_COMPANY_ID' con el ID real de tu empresa

-- Insertar gerencias predeterminadas
INSERT INTO public.departments (company_id, name, is_active) VALUES
  ('YOUR_COMPANY_ID', 'Finanzas', true),
  ('YOUR_COMPANY_ID', 'Operaciones', true),
  ('YOUR_COMPANY_ID', 'Recursos Humanos', true),
  ('YOUR_COMPANY_ID', 'Comercial', true),
  ('YOUR_COMPANY_ID', 'TI', true),
  ('YOUR_COMPANY_ID', 'Marketing', true),
  ('YOUR_COMPANY_ID', 'Legal', true)
ON CONFLICT (company_id, name) DO NOTHING;

-- Verificar que se insertaron correctamente
SELECT * FROM public.departments WHERE company_id = 'YOUR_COMPANY_ID' ORDER BY name;

