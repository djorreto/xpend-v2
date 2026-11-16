-- Etapa 1: el perfil de consulta (viewer) es estrictamente de solo lectura.
--
-- Problema confirmado con consultas directas a PostgREST: un viewer podía crear y editar RFx, escribir
-- en tablas de gasto/informes/rfx_templates/rfx_company_policies y borrar contratos, porque varias políticas
-- permisivas solo comparan la empresa. Además podía leer contratos y sus documentos aunque la interfaz no se
-- los ofrece.
--
-- Solución (aditiva, sin tocar ninguna política existente ni datos): políticas RESTRICTIVE que se combinan
-- con AND sobre las permisivas.
--   1. INSERT/UPDATE/DELETE bloqueados para viewer en todas las tablas públicas con RLS, salvo las que un
--      consulta usa legítimamente: notifications (marcar leídas), profiles (sus propios datos, ya acotado por
--      sus políticas), ana_interactions y si_ai_calls (registro de uso de ANA).
--   2. SELECT bloqueado para viewer en las tablas de contratos (el alcance de lectura del viewer excluye contratos).
--   3. storage.objects: viewer no escribe y no lee `<empresa>/contratos/...`.
-- No afecta a admin, manager, analyst ni al aislamiento de proveedores (rol distinto de viewer).
-- Las funciones con service role no pasan por RLS: sus rutas validan el rol en el servidor.
--
-- Rollback: drop policy if exists <tabla>_viewer_no_insert|_viewer_no_update|_viewer_no_delete|_viewer_no_read
-- por cada tabla y las tres políticas storage_objects_viewer_*; drop function private.is_read_only_profile().

create or replace function private.is_read_only_profile()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.role::text = 'viewer' from public.profiles p where p.id = (select auth.uid())), false)
$$;

revoke all on function private.is_read_only_profile() from public, anon;
grant execute on function private.is_read_only_profile() to authenticated;

do $$
declare
  t text;
  writable_by_viewer constant text[] := array['notifications', 'profiles', 'ana_interactions', 'si_ai_calls'];
  contract_tables constant text[] := array[
    'contracts', 'contract_versions', 'contract_documents', 'contract_extractions',
    'contract_findings', 'contract_clauses', 'contract_templates', 'contract_policies', 'contract_reviews'
  ];
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    order by c.relname
  loop
    if t = any (writable_by_viewer) then continue; end if;
    execute format('drop policy if exists %I on public.%I', t || '_viewer_no_insert', t);
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (not (select private.is_read_only_profile()))', t || '_viewer_no_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_viewer_no_update', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (not (select private.is_read_only_profile())) with check (not (select private.is_read_only_profile()))', t || '_viewer_no_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_viewer_no_delete', t);
    execute format('create policy %I on public.%I as restrictive for delete to authenticated using (not (select private.is_read_only_profile()))', t || '_viewer_no_delete', t);
  end loop;

  foreach t in array contract_tables loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists %I on public.%I', t || '_viewer_no_read', t);
    execute format('create policy %I on public.%I as restrictive for select to authenticated using (not (select private.is_read_only_profile()))', t || '_viewer_no_read', t);
  end loop;
end $$;

drop policy if exists storage_objects_viewer_no_insert on storage.objects;
create policy storage_objects_viewer_no_insert on storage.objects as restrictive for insert to authenticated
  with check (not (select private.is_read_only_profile()));
drop policy if exists storage_objects_viewer_no_update on storage.objects;
create policy storage_objects_viewer_no_update on storage.objects as restrictive for update to authenticated
  using (not (select private.is_read_only_profile())) with check (not (select private.is_read_only_profile()));
drop policy if exists storage_objects_viewer_no_delete on storage.objects;
create policy storage_objects_viewer_no_delete on storage.objects as restrictive for delete to authenticated
  using (not (select private.is_read_only_profile()));
drop policy if exists storage_objects_viewer_no_contracts on storage.objects;
create policy storage_objects_viewer_no_contracts on storage.objects as restrictive for select to authenticated
  using (not (bucket_id = 'documents' and split_part(name, '/', 2) = 'contratos' and (select private.is_read_only_profile())));
