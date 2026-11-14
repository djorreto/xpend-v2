-- XPEND Fase 0: documentos privados, aislamiento, aprobaciones y notificaciones.
-- Preparada para staging. No aplicar en producción sin backup, pruebas E2E y aprobación.

begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.company_id
  from public.profiles p
  where p.id = (select auth.uid())
$$;

create or replace function private.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role::text
  from public.profiles p
  where p.id = (select auth.uid())
$$;

create or replace function private.current_supplier_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.supplier_id
  from public.profiles p
  where p.id = (select auth.uid())
$$;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_role() = 'super_admin', false)
$$;

create or replace function private.is_current_supplier_invited(
  target_company uuid,
  target_licitacion text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.offer_events e
    join public.offer_invitations i on i.event_id = e.id
    where e.company_id = target_company
      and e.licitacion_id = target_licitacion
      and i.supplier_id = private.current_supplier_id()
      and private.current_supplier_id() is not null
  )
$$;

create or replace function private.current_user_manages_offer_event(target_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.offer_events e
    where e.id = target_event
      and (
        private.is_platform_admin()
        or (
          e.company_id = private.current_company_id()
          and private.current_supplier_id() is null
          and private.current_role() in ('admin', 'manager')
        )
      )
  )
$$;

create or replace function private.storage_company_id(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(object_name, '/', 1) ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then split_part(object_name, '/', 1)::uuid
    else null
  end
$$;

revoke all on all functions in schema private from public;
grant execute on function private.current_company_id() to authenticated;
grant execute on function private.current_role() to authenticated;
grant execute on function private.current_supplier_id() to authenticated;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.is_current_supplier_invited(uuid, text) to authenticated;
grant execute on function private.current_user_manages_offer_event(uuid) to authenticated;
grant execute on function private.storage_company_id(text) to authenticated;

-- Buckets privados. La ruta canónica comienza con company_id.
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('documents', 'documents', false, 104857600),
  ('supplier-documents', 'supplier-documents', false, 104857600)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "Users can upload documents" on storage.objects;
drop policy if exists "Users can view documents" on storage.objects;
drop policy if exists "Users can update documents" on storage.objects;
drop policy if exists "Users can delete documents" on storage.objects;
drop policy if exists documents_select_tenant on storage.objects;
drop policy if exists documents_insert_tenant on storage.objects;
drop policy if exists documents_update_tenant on storage.objects;
drop policy if exists documents_delete_tenant on storage.objects;
drop policy if exists supplier_documents_select_tenant on storage.objects;
drop policy if exists supplier_documents_insert_tenant on storage.objects;
drop policy if exists supplier_documents_update_tenant on storage.objects;
drop policy if exists supplier_documents_delete_tenant on storage.objects;

create policy documents_select_tenant
on storage.objects for select to authenticated
using (
  bucket_id = 'documents'
  and private.storage_company_id(name) = private.current_company_id()
  and (
    private.current_supplier_id() is null
    or (
      split_part(name, '/', 2) = 'licitaciones'
      and private.is_current_supplier_invited(
        private.current_company_id(),
        split_part(name, '/', 3)
      )
    )
  )
);

create policy documents_insert_tenant
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documents'
  and private.storage_company_id(name) = private.current_company_id()
  and private.current_supplier_id() is null
  and private.current_role() in ('admin', 'manager', 'super_admin')
);

create policy documents_update_tenant
on storage.objects for update to authenticated
using (
  bucket_id = 'documents'
  and private.storage_company_id(name) = private.current_company_id()
  and private.current_supplier_id() is null
  and private.current_role() in ('admin', 'manager', 'super_admin')
)
with check (
  bucket_id = 'documents'
  and private.storage_company_id(name) = private.current_company_id()
  and private.current_supplier_id() is null
  and private.current_role() in ('admin', 'manager', 'super_admin')
);

create policy documents_delete_tenant
on storage.objects for delete to authenticated
using (
  bucket_id = 'documents'
  and private.storage_company_id(name) = private.current_company_id()
  and private.current_supplier_id() is null
  and private.current_role() in ('admin', 'manager', 'super_admin')
);

create policy supplier_documents_select_tenant
on storage.objects for select to authenticated
using (
  bucket_id = 'supplier-documents'
  and private.storage_company_id(name) = private.current_company_id()
  and (
    private.current_supplier_id() is null
    or split_part(name, '/', 2) = private.current_supplier_id()
  )
);

create policy supplier_documents_insert_tenant
on storage.objects for insert to authenticated
with check (
  bucket_id = 'supplier-documents'
  and private.storage_company_id(name) = private.current_company_id()
  and private.current_supplier_id() is null
  and private.current_role() in ('admin', 'manager', 'super_admin')
);

create policy supplier_documents_update_tenant
on storage.objects for update to authenticated
using (
  bucket_id = 'supplier-documents'
  and private.storage_company_id(name) = private.current_company_id()
  and private.current_supplier_id() is null
  and private.current_role() in ('admin', 'manager', 'super_admin')
)
with check (
  bucket_id = 'supplier-documents'
  and private.storage_company_id(name) = private.current_company_id()
  and private.current_supplier_id() is null
  and private.current_role() in ('admin', 'manager', 'super_admin')
);

create policy supplier_documents_delete_tenant
on storage.objects for delete to authenticated
using (
  bucket_id = 'supplier-documents'
  and private.storage_company_id(name) = private.current_company_id()
  and private.current_supplier_id() is null
  and private.current_role() in ('admin', 'manager', 'super_admin')
);

-- Sustituye políticas históricas contradictorias de las tablas objetivo.
do $$
declare
  target_table text;
  existing_policy record;
begin
  foreach target_table in array array[
    'companies',
    'profiles',
    'departments',
    'sourcing_plan_licitaciones',
    'spend_categories',
    'notifications',
    'licitaciones',
    'suppliers',
    'sourcing_plans',
    'administrative_evaluations',
    'technical_evaluations',
    'licitacion_suppliers'
  ]
  loop
    for existing_policy in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = target_table
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        existing_policy.policyname,
        target_table
      );
    end loop;
  end loop;
end
$$;

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.sourcing_plan_licitaciones enable row level security;
alter table public.spend_categories enable row level security;
alter table public.notifications enable row level security;
alter table public.licitaciones enable row level security;
alter table public.suppliers enable row level security;
alter table public.sourcing_plans enable row level security;
alter table public.administrative_evaluations enable row level security;
alter table public.technical_evaluations enable row level security;
alter table public.licitacion_suppliers enable row level security;

revoke all on public.companies from anon;
revoke all on public.profiles from anon;
revoke all on public.departments from anon;
revoke all on public.sourcing_plan_licitaciones from anon;
revoke all on public.spend_categories from anon;
revoke all on public.notifications from anon;
revoke all on public.licitaciones from anon;
revoke all on public.suppliers from anon;
revoke all on public.sourcing_plans from anon;
revoke all on public.administrative_evaluations from anon;
revoke all on public.technical_evaluations from anon;
revoke all on public.licitacion_suppliers from anon;

grant select, update on public.companies to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.departments to authenticated;
grant select, insert, delete on public.sourcing_plan_licitaciones to authenticated;
grant select, insert, update, delete on public.spend_categories to authenticated;
grant select, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.licitaciones to authenticated;
grant select, insert, update, delete on public.suppliers to authenticated;
grant select, insert, update, delete on public.sourcing_plans to authenticated;
grant select, insert, update, delete on public.administrative_evaluations to authenticated;
grant select, insert, update, delete on public.technical_evaluations to authenticated;
grant select, insert, update, delete on public.licitacion_suppliers to authenticated;

create policy companies_select_tenant
on public.companies for select to authenticated
using (
  id = private.current_company_id()
  or private.is_platform_admin()
);

create policy companies_update_tenant_admin
on public.companies for update to authenticated
using (
  (id = private.current_company_id() and private.current_role() in ('admin', 'manager'))
  or private.is_platform_admin()
)
with check (
  (id = private.current_company_id() and private.current_role() in ('admin', 'manager'))
  or private.is_platform_admin()
);

create policy profiles_select_tenant
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or private.is_platform_admin()
  or (
    private.current_supplier_id() is null
    and company_id = private.current_company_id()
  )
);

create policy profiles_update_tenant
on public.profiles for update to authenticated
using (
  id = (select auth.uid())
  or private.is_platform_admin()
  or (
    private.current_supplier_id() is null
    and private.current_role() = 'admin'
    and company_id = private.current_company_id()
    and role::text <> 'super_admin'
  )
)
with check (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and (
      (
        id = (select auth.uid())
        and role::text = private.current_role()
        and supplier_id is not distinct from private.current_supplier_id()
      )
      or (
        private.current_supplier_id() is null
        and private.current_role() = 'admin'
        and role::text <> 'super_admin'
      )
    )
  )
);

create policy licitaciones_select_tenant
on public.licitaciones for select to authenticated
using (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and private.current_supplier_id() is null
  )
  or private.is_current_supplier_invited(licitaciones.company_id, licitaciones.id)
);

create policy licitaciones_write_tenant
on public.licitaciones for all to authenticated
using (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and private.current_supplier_id() is null
    and private.current_role() in ('admin', 'manager')
  )
)
with check (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and private.current_supplier_id() is null
    and private.current_role() in ('admin', 'manager')
  )
);

create policy suppliers_select_tenant
on public.suppliers for select to authenticated
using (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and (
      private.current_supplier_id() is null
      or id = private.current_supplier_id()
    )
  )
);

create policy suppliers_write_tenant
on public.suppliers for all to authenticated
using (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and private.current_supplier_id() is null
    and private.current_role() in ('admin', 'manager')
  )
)
with check (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and private.current_supplier_id() is null
    and private.current_role() in ('admin', 'manager')
  )
);

create policy sourcing_plans_select_tenant
on public.sourcing_plans for select to authenticated
using (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and private.current_supplier_id() is null
  )
);

create policy sourcing_plans_write_tenant
on public.sourcing_plans for all to authenticated
using (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and private.current_supplier_id() is null
    and private.current_role() in ('admin', 'manager')
  )
)
with check (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and private.current_supplier_id() is null
    and private.current_role() in ('admin', 'manager')
  )
);

create policy administrative_evaluations_select_tenant
on public.administrative_evaluations for select to authenticated
using (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and (
      private.current_supplier_id() is null
      or supplier_id = private.current_supplier_id()
    )
  )
);

create policy administrative_evaluations_write_tenant
on public.administrative_evaluations for all to authenticated
using (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and private.current_supplier_id() is null
  )
)
with check (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and private.current_supplier_id() is null
  )
);

create policy technical_evaluations_select_tenant
on public.technical_evaluations for select to authenticated
using (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and (
      private.current_supplier_id() is null
      or supplier_id = private.current_supplier_id()
    )
  )
);

create policy technical_evaluations_write_tenant
on public.technical_evaluations for all to authenticated
using (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and private.current_supplier_id() is null
  )
)
with check (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and private.current_supplier_id() is null
  )
);

create policy licitacion_suppliers_select_tenant
on public.licitacion_suppliers for select to authenticated
using (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and (
      private.current_supplier_id() is null
      or supplier_id = private.current_supplier_id()
    )
  )
);

create policy licitacion_suppliers_write_tenant
on public.licitacion_suppliers for all to authenticated
using (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and private.current_supplier_id() is null
  )
)
with check (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and private.current_supplier_id() is null
  )
);

-- Evita recursión entre las políticas de eventos e invitaciones y mantiene
-- al proveedor limitado a los eventos donde su supplier_id fue invitado.
drop policy if exists offer_events_select on public.offer_events;
create policy offer_events_select
on public.offer_events for select to authenticated
using (
  public.is_buyer_of(company_id)
  or private.is_current_supplier_invited(company_id, licitacion_id)
);

drop policy if exists offer_events_write on public.offer_events;
create policy offer_events_write
on public.offer_events for all to authenticated
using (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and private.current_supplier_id() is null
    and private.current_role() in ('admin', 'manager')
  )
)
with check (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and private.current_supplier_id() is null
    and private.current_role() in ('admin', 'manager')
  )
);

drop policy if exists offer_invitations_select on public.offer_invitations;
create policy offer_invitations_select
on public.offer_invitations for select to authenticated
using (
  supplier_id = private.current_supplier_id()
  or private.current_user_manages_offer_event(event_id)
);

drop policy if exists offer_invitations_write on public.offer_invitations;
create policy offer_invitations_write
on public.offer_invitations for all to authenticated
using (private.current_user_manages_offer_event(event_id))
with check (private.current_user_manages_offer_event(event_id));

create policy departments_select_tenant
on public.departments for select to authenticated
using (
  (
    company_id = private.current_company_id()
    and private.current_supplier_id() is null
  )
  or private.is_platform_admin()
);

create policy departments_write_tenant
on public.departments for all to authenticated
using (
  (company_id = private.current_company_id() and private.current_role() in ('admin', 'manager'))
  or private.is_platform_admin()
)
with check (
  (company_id = private.current_company_id() and private.current_role() in ('admin', 'manager'))
  or private.is_platform_admin()
);

create policy spend_categories_select_tenant
on public.spend_categories for select to authenticated
using (
  (
    company_id = private.current_company_id()
    and private.current_supplier_id() is null
  )
  or private.is_platform_admin()
);

create policy spend_categories_write_tenant
on public.spend_categories for all to authenticated
using (
  (company_id = private.current_company_id() and private.current_role() in ('admin', 'manager'))
  or private.is_platform_admin()
)
with check (
  (company_id = private.current_company_id() and private.current_role() in ('admin', 'manager'))
  or private.is_platform_admin()
);

create policy sourcing_plan_licitaciones_select_tenant
on public.sourcing_plan_licitaciones for select to authenticated
using (
  private.is_platform_admin()
  or (
    private.current_supplier_id() is null
    and exists (
    select 1
    from public.sourcing_plans sp
    join public.licitaciones l on l.id = sourcing_plan_licitaciones.licitacion_id
    where sp.id = sourcing_plan_licitaciones.plan_id
      and sp.company_id = private.current_company_id()
      and l.company_id = sp.company_id
    )
  )
);

create policy sourcing_plan_licitaciones_insert_tenant
on public.sourcing_plan_licitaciones for insert to authenticated
with check (
  private.is_platform_admin()
  or (
    private.current_supplier_id() is null
    and
    private.current_role() in ('admin', 'manager')
    and exists (
      select 1
      from public.sourcing_plans sp
      join public.licitaciones l on l.id = sourcing_plan_licitaciones.licitacion_id
      where sp.id = sourcing_plan_licitaciones.plan_id
        and sp.company_id = private.current_company_id()
        and l.company_id = sp.company_id
    )
  )
);

create policy sourcing_plan_licitaciones_delete_tenant
on public.sourcing_plan_licitaciones for delete to authenticated
using (
  private.is_platform_admin()
  or (
    private.current_supplier_id() is null
    and
    private.current_role() in ('admin', 'manager')
    and exists (
      select 1
      from public.sourcing_plans sp
      join public.licitaciones l on l.id = sourcing_plan_licitaciones.licitacion_id
      where sp.id = sourcing_plan_licitaciones.plan_id
        and sp.company_id = private.current_company_id()
        and l.company_id = sp.company_id
    )
  )
);

-- Evidencia de aprobación: el trigger y la transición ocurren en una transacción.
alter table public.licitaciones
  add column if not exists publish_approved_at timestamptz,
  add column if not exists publish_approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists award_approved_at timestamptz,
  add column if not exists award_approved_by uuid references public.profiles(id) on delete set null;

create table if not exists public.approval_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_type text not null check (entity_type in ('licitacion')),
  entity_id text not null,
  operation text not null check (operation in ('publish', 'award')),
  decision text not null default 'approved' check (decision in ('approved', 'rejected')),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  actor_role text not null,
  from_status text,
  to_status text not null,
  metadata jsonb not null default '{}'::jsonb,
  decided_at timestamptz not null default now()
);

create index if not exists approval_events_company_entity_idx
  on public.approval_events (company_id, entity_type, entity_id, decided_at desc);

alter table public.approval_events enable row level security;
revoke all on public.approval_events from anon;
revoke insert, update, delete on public.approval_events from authenticated;
grant select on public.approval_events to authenticated;

drop policy if exists approval_events_select_tenant on public.approval_events;
create policy approval_events_select_tenant
on public.approval_events for select to authenticated
using (
  private.is_platform_admin()
  or (
    company_id = private.current_company_id()
    and (
      private.current_supplier_id() is null
      or private.is_current_supplier_invited(
        approval_events.company_id,
        approval_events.entity_id
      )
    )
  )
);

create or replace function private.enforce_licitacion_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text := private.current_role();
  target_status text := new.status::text;
  status_changed boolean;
begin
  status_changed := tg_op = 'INSERT'
    or new.status::text is distinct from old.status::text;

  if not status_changed
    or target_status not in ('published', 'evaluation', 'awarded', 'contract_signed')
  then
    return new;
  end if;

  if actor_id is null or actor_role not in ('admin', 'manager', 'super_admin') then
    raise exception using
      errcode = '42501',
      message = 'La transición requiere una aprobación autenticada.';
  end if;

  if actor_role <> 'super_admin'
    and new.company_id is distinct from private.current_company_id()
  then
    raise exception using
      errcode = '42501',
      message = 'La aprobación no pertenece a la empresa del usuario.';
  end if;

  if coalesce(btrim(new.tender_document_path), '') = '' then
    raise exception using
      errcode = '23514',
      message = 'La publicación o adjudicación requiere las bases cargadas.';
  end if;

  if target_status in ('awarded', 'contract_signed') then
    if new.baseline_amount is null or new.baseline_amount <= 0 then
      raise exception using
        errcode = '23514',
        message = 'La adjudicación requiere un presupuesto base mayor que cero.';
    end if;

    if new.awarded_amount is null or new.awarded_amount <= 0 then
      raise exception using
        errcode = '23514',
        message = 'La adjudicación requiere un monto adjudicado mayor que cero.';
    end if;

    new.award_approved_at := now();
    new.award_approved_by := actor_id;
  else
    new.publish_approved_at := now();
    new.publish_approved_by := actor_id;
  end if;

  return new;
end
$$;

create or replace function private.record_licitacion_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_status text := case when tg_op = 'INSERT' then null else old.status::text end;
  target_status text := new.status::text;
  operation_name text;
  actor_id uuid;
  actor_role text;
begin
  if target_status not in ('published', 'evaluation', 'awarded', 'contract_signed')
    or (tg_op = 'UPDATE' and target_status is not distinct from previous_status)
  then
    return new;
  end if;

  operation_name := case
    when target_status in ('awarded', 'contract_signed') then 'award'
    else 'publish'
  end;
  actor_id := case when operation_name = 'award' then new.award_approved_by else new.publish_approved_by end;
  actor_role := private.current_role();

  insert into public.approval_events (
    company_id,
    entity_type,
    entity_id,
    operation,
    decision,
    actor_id,
    actor_role,
    from_status,
    to_status,
    metadata
  )
  values (
    new.company_id,
    'licitacion',
    new.id,
    operation_name,
    'approved',
    actor_id,
    actor_role,
    previous_status,
    target_status,
    jsonb_build_object(
      'baseline_currency', new.baseline_currency,
      'awarded_amount', new.awarded_amount
    )
  );

  insert into public.notifications (
    company_id,
    user_id,
    type,
    title,
    message,
    action_url,
    read,
    created_at,
    updated_at
  )
  select
    new.company_id,
    p.id,
    'success',
    case when operation_name = 'award' then 'Licitación adjudicada' else 'Licitación publicada' end,
    case
      when operation_name = 'award'
        then format('La adjudicación de "%s" fue aprobada y registrada.', new.name)
      else format('La publicación de "%s" fue aprobada y registrada.', new.name)
    end,
    '/licitaciones/' || new.id,
    false,
    now(),
    now()
  from public.profiles p
  where p.company_id = new.company_id
    and (
      p.supplier_id is null
      or exists (
        select 1
        from public.offer_events e
        join public.offer_invitations i on i.event_id = e.id
        where e.licitacion_id = new.id
          and e.company_id = new.company_id
          and i.supplier_id = p.supplier_id
      )
    );

  return new;
end
$$;

drop trigger if exists enforce_licitacion_approval on public.licitaciones;
create trigger enforce_licitacion_approval
before insert or update of status on public.licitaciones
for each row execute function private.enforce_licitacion_approval();

drop trigger if exists record_licitacion_approval on public.licitaciones;
create trigger record_licitacion_approval
after insert or update of status on public.licitaciones
for each row execute function private.record_licitacion_approval();

-- La adjudicación desde Sala y su evidencia se confirman o revierten juntas.
create or replace function private.sync_offer_award_to_licitacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'awarded'
    and (tg_op = 'INSERT' or old.status is distinct from new.status)
  then
    if new.licitacion_id is null then
      raise exception using
        errcode = '23514',
        message = 'La adjudicación de la sala requiere una licitación vinculada.';
    end if;

    update public.licitaciones
    set status = 'awarded',
        awarded_amount = new.winning_amount,
        award_date = current_date
    where id = new.licitacion_id
      and company_id = new.company_id;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'No se encontró la licitación de la sala en la misma empresa.';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists sync_offer_award_to_licitacion on public.offer_events;
create trigger sync_offer_award_to_licitacion
before insert or update of status on public.offer_events
for each row execute function private.sync_offer_award_to_licitacion();

-- Notificaciones: cada usuario solo ve y altera sus propios registros.
alter table public.notifications
  add column if not exists updated_at timestamptz not null default now();

create policy notifications_select_recipient
on public.notifications for select to authenticated
using (user_id = (select auth.uid()));

create policy notifications_update_recipient
on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and company_id = private.current_company_id()
);

create policy notifications_delete_recipient
on public.notifications for delete to authenticated
using (user_id = (select auth.uid()));

create or replace function public.mark_notification_as_read(p_notification_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.notifications
  set read = true, updated_at = now()
  where id = p_notification_id
    and user_id = auth.uid();
  get diagnostics affected = row_count;
  return affected = 1;
end
$$;

create or replace function public.mark_all_notifications_as_read()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.notifications
  set read = true, updated_at = now()
  where user_id = auth.uid()
    and read = false;
  get diagnostics affected = row_count;
  return affected;
end
$$;

create or replace function public.delete_notification(p_notification_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected integer;
begin
  delete from public.notifications
  where id = p_notification_id
    and user_id = auth.uid();
  get diagnostics affected = row_count;
  return affected = 1;
end
$$;

revoke all on function public.mark_notification_as_read(uuid) from public, anon;
revoke all on function public.mark_all_notifications_as_read() from public, anon;
revoke all on function public.delete_notification(uuid) from public, anon;
grant execute on function public.mark_notification_as_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_as_read() to authenticated;
grant execute on function public.delete_notification(uuid) to authenticated;

-- Helpers existentes del portal: nombres cualificados y solo con sesión.
create or replace function public.is_buyer_of(target_company uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = target_company
      and p.supplier_id is null
  )
$$;

create or replace function public.my_supplier_id()
returns text
language sql
stable
set search_path = ''
as $$
  select p.supplier_id
  from public.profiles p
  where p.id = auth.uid()
$$;

revoke all on function public.is_buyer_of(uuid) from public, anon;
revoke all on function public.my_supplier_id() from public, anon;
grant execute on function public.is_buyer_of(uuid) to authenticated;
grant execute on function public.my_supplier_id() to authenticated;

revoke all on function private.enforce_licitacion_approval() from public, anon, authenticated;
revoke all on function private.record_licitacion_approval() from public, anon, authenticated;
revoke all on function private.sync_offer_award_to_licitacion() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;

commit;
