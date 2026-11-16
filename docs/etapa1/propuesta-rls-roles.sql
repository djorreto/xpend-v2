-- PROPUESTA — NO APLICADA EN CLOUD NI INCLUIDA EN supabase/migrations.
-- Origen: verificación de permisos de Etapa 1 (src/lib/role-permissions.test.ts).
-- Requiere autorización expresa antes de ejecutarse en el proyecto qtncgtqgvilbjhrvzoxe.
--
-- Defectos confirmados en Supabase local (las mismas políticas existen en Cloud, mismas huellas):
--   1. rfx_projects: INSERT y UPDATE solo exigen pertenecer a la empresa. Un perfil de consulta (viewer)
--      puede crear y editar RFx directamente contra la API, aunque la interfaz no se lo ofrezca.
--   2. Tablas de contratos: las políticas FOR ALL limitan el WITH CHECK por rol, pero DELETE usa solo USING
--      (empresa + no proveedor). Un perfil de consulta puede borrar contratos directamente contra la API.
--
-- Corrección mínima: políticas RESTRICTIVE adicionales. No modifica ni elimina ninguna política existente
-- (la corrección de aislamiento de proveedores queda intacta) y es reversible con DROP POLICY.
-- No hay migración de datos. Impacto en producción hoy: ninguno (solo existen perfiles admin/super_admin).

begin;

create policy rfx_projects_write_roles on public.rfx_projects
  as restrictive for insert to authenticated
  with check (private.current_role() in ('super_admin', 'admin', 'manager', 'analyst'));

create policy rfx_projects_update_roles on public.rfx_projects
  as restrictive for update to authenticated
  using (private.current_role() in ('super_admin', 'admin', 'manager', 'analyst'))
  with check (private.current_role() in ('super_admin', 'admin', 'manager', 'analyst'));

create policy contracts_delete_roles on public.contracts
  as restrictive for delete to authenticated
  using (private.current_role() in ('super_admin', 'admin', 'manager', 'analyst'));
create policy contract_versions_delete_roles on public.contract_versions
  as restrictive for delete to authenticated
  using (private.current_role() in ('super_admin', 'admin', 'manager', 'analyst'));
create policy contract_documents_delete_roles on public.contract_documents
  as restrictive for delete to authenticated
  using (private.current_role() in ('super_admin', 'admin', 'manager', 'analyst'));
create policy contract_extractions_delete_roles on public.contract_extractions
  as restrictive for delete to authenticated
  using (private.current_role() in ('super_admin', 'admin', 'manager', 'analyst'));
create policy contract_findings_delete_roles on public.contract_findings
  as restrictive for delete to authenticated
  using (private.current_role() in ('super_admin', 'admin', 'manager', 'analyst'));
create policy contract_clauses_delete_roles on public.contract_clauses
  as restrictive for delete to authenticated
  using (private.current_role() in ('super_admin', 'admin', 'manager', 'analyst'));
create policy contract_templates_delete_roles on public.contract_templates
  as restrictive for delete to authenticated
  using (private.current_role() in ('super_admin', 'admin', 'manager', 'analyst'));
create policy contract_policies_delete_roles on public.contract_policies
  as restrictive for delete to authenticated
  using (private.current_role() in ('super_admin', 'admin'));

commit;

-- Reversión:
--   drop policy rfx_projects_write_roles on public.rfx_projects;
--   drop policy rfx_projects_update_roles on public.rfx_projects;
--   drop policy contracts_delete_roles on public.contracts;            (y las 7 tablas *_delete_roles restantes)
