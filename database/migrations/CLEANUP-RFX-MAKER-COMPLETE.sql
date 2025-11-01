-- =====================================================
-- LIMPIEZA ULTRA-COMPLETA: Eliminar TODO de RFx Maker
-- (Incluye índices, triggers, funciones, tablas)
-- =====================================================

-- 1. Eliminar triggers PRIMERO
DROP TRIGGER IF EXISTS trg_update_rfx_templates_updated_at ON rfx_templates CASCADE;
DROP TRIGGER IF EXISTS trg_update_rfx_company_policies_updated_at ON rfx_company_policies CASCADE;
DROP TRIGGER IF EXISTS trg_update_rfx_projects_updated_at ON rfx_projects CASCADE;
DROP TRIGGER IF EXISTS trg_invalidate_technical_base ON rfx_projects CASCADE;
DROP TRIGGER IF EXISTS trg_update_rfx_project_versions_updated_at ON rfx_project_versions CASCADE;
DROP TRIGGER IF EXISTS trg_update_rfx_project_downloads_updated_at ON rfx_project_downloads CASCADE;
DROP TRIGGER IF EXISTS trg_update_rfx_project_comments_updated_at ON rfx_project_comments CASCADE;

-- 2. Eliminar funciones
DROP FUNCTION IF EXISTS update_rfx_updated_at() CASCADE;
DROP FUNCTION IF EXISTS invalidate_technical_base_on_params_change() CASCADE;

-- 3. Eliminar TODOS los índices (esto es clave)
DROP INDEX IF EXISTS idx_rfx_templates_company CASCADE;
DROP INDEX IF EXISTS idx_rfx_templates_status CASCADE;
DROP INDEX IF EXISTS idx_rfx_templates_unique_active_per_company CASCADE;
DROP INDEX IF EXISTS idx_rfx_company_policies_company CASCADE;
DROP INDEX IF EXISTS idx_rfx_company_policies_unique_active CASCADE;
DROP INDEX IF EXISTS idx_rfx_company_policies_template CASCADE;
DROP INDEX IF EXISTS idx_rfx_projects_company CASCADE;
DROP INDEX IF EXISTS idx_rfx_projects_status CASCADE;
DROP INDEX IF EXISTS idx_rfx_projects_template CASCADE;
DROP INDEX IF EXISTS idx_rfx_projects_responsible CASCADE;
DROP INDEX IF EXISTS idx_rfx_projects_code CASCADE;
DROP INDEX IF EXISTS idx_rfx_project_versions_project CASCADE;
DROP INDEX IF EXISTS idx_rfx_project_downloads_project CASCADE;
DROP INDEX IF EXISTS idx_rfx_project_comments_project CASCADE;
DROP INDEX IF EXISTS idx_rfx_audit_log_project CASCADE;
DROP INDEX IF EXISTS idx_rfx_audit_log_user CASCADE;
DROP INDEX IF EXISTS idx_rfx_audit_log_created CASCADE;

-- 4. Eliminar tablas (en orden inverso de dependencias)
DROP TABLE IF EXISTS rfx_audit_log CASCADE;
DROP TABLE IF EXISTS rfx_project_comments CASCADE;
DROP TABLE IF EXISTS rfx_project_downloads CASCADE;
DROP TABLE IF EXISTS rfx_project_versions CASCADE;
DROP TABLE IF EXISTS rfx_projects CASCADE;
DROP TABLE IF EXISTS rfx_company_policies CASCADE;
DROP TABLE IF EXISTS rfx_template_variables CASCADE;
DROP TABLE IF EXISTS rfx_templates CASCADE;

-- 5. Eliminar tipos/enums (si existen)
DROP TYPE IF EXISTS template_status CASCADE;
DROP TYPE IF EXISTS rfx_project_status CASCADE;
DROP TYPE IF EXISTS rfx_type CASCADE;

-- Mensaje de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅✅✅ LIMPIEZA ULTRA-COMPLETA EXITOSA ✅✅✅';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✓ Triggers eliminados';
  RAISE NOTICE '✓ Funciones eliminadas';
  RAISE NOTICE '✓ Índices eliminados (18 índices)';
  RAISE NOTICE '✓ Tablas eliminadas (8 tablas)';
  RAISE NOTICE '✓ Tipos/Enums eliminados';
  RAISE NOTICE '';
  RAISE NOTICE '👉 AHORA SÍ: Ejecuta el schema completo (pestaña "RFx Maker Schema")';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

