-- Hotfix de seguridad: los perfiles de proveedor no acceden a datos internos del comprador.
--
-- Problema: las políticas "<tabla>_select_company" (y sus pares de insert/update) comparan solo
-- company_id con el de quien consulta. Un perfil de proveedor tiene el company_id de la empresa
-- compradora que lo invitó, así que podía leer (y escribir) RFx internos, planes de gasto y
-- oportunidades de ahorro.
--
-- Solución: una política RESTRICTIVE por tabla. Las políticas restrictivas se combinan con AND
-- sobre las permisivas existentes, de modo que:
--   * no se amplía ningún privilegio (solo se quita acceso a proveedores);
--   * no se modifica ni se elimina ninguna política existente;
--   * los perfiles internos siguen exactamente como estaban.
-- No toca datos ni esquema de tablas. Es idempotente.
--
-- licitacion_documents: sus políticas leen por empresa (cualquier perfil con el company_id de la
-- licitación). El código no la usa para proveedores; los documentos de bases que ven los proveedores
-- salen del bucket `documents` con private.supplier_may_read_tender (por invitación), no de esta tabla.
--
-- Rollback (solo si fuera necesario):
--   drop policy if exists <tabla>_no_supplier on public.<tabla>;   -- para cada tabla de la lista

create or replace function private.is_internal_profile()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.supplier_id is null
      and p.role::text <> 'supplier'
  )
$$;

revoke all on function private.is_internal_profile() from public, anon;
grant execute on function private.is_internal_profile() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'rfx_projects', 'rfx_project_comments', 'rfx_project_downloads', 'rfx_project_versions',
    'rfx_audit_log', 'rfx_templates', 'rfx_template_variables', 'rfx_company_policies',
    'si_plan_items', 'si_procurement_plans', 'si_uploads', 'si_spend_lines', 'si_spend_groups',
    'si_spend_decisions', 'si_categories', 'si_learning_rules',
    'spend_data', 'spend_closures', 'reports', 'report_templates', 'service_invoices',
    'licitacion_documents'
  ]
  loop
    -- Si una tabla no existe en este entorno, se omite en lugar de abortar la migración.
    if to_regclass(format('public.%I', t)) is null then
      raise notice 'tabla % no existe; se omite', t;
      continue;
    end if;
    execute format('drop policy if exists %I on public.%I', t || '_no_supplier', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using ((select private.is_internal_profile())) with check ((select private.is_internal_profile()))',
      t || '_no_supplier', t
    );
  end loop;
end
$$;
