-- Comprobaciones rápidas de salud (XPEND V3)
-- Ejecutar en SQL Editor; no modifica datos.

-- Tablas críticas del front
SELECT 'missing_table' AS check_type, unnest(ARRAY[
  'companies','profiles','si_uploads','si_spend_lines','si_procurement_plans','si_plan_items',
  'si_learning_rules','rfx_projects','rfx_templates','rfx_company_policies','rfx_project_versions',
  'rfx_project_comments','rfx_audit_log','permissions','role_permissions'
]) AS name
EXCEPT
SELECT 'missing_table', tablename FROM pg_tables WHERE schemaname = 'public';

-- RFx: tablas con RLS y sin políticas (bloquean todo)
SELECT c.relname AS rfx_table_blocked
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'rfx%'
  AND c.relrowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname
  );

-- Conteo permisos (esperado: 23 permisos × N empresas en permissions; role_permissions ≈ 92 si 1 empresa)
SELECT
  (SELECT count(*) FROM permissions) AS permissions_rows,
  (SELECT count(*) FROM role_permissions) AS role_permissions_rows;
