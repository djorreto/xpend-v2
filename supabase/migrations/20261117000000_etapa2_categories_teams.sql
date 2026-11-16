-- Etapa 2: categorías de abastecimiento, responsables (Category Manager y suplente) y equipos de Procurement.
--
-- Reutiliza sourcing_plans (iniciativas), si_plan_items (oportunidades) y departments (gerencias solicitantes,
-- que NO son equipos de Procurement). Solo agrega tablas nuevas y columnas nulas: no modifica ni elimina datos.
-- Nada se reasigna automáticamente: las iniciativas históricas quedan sin categoría hasta que una persona la vincule.
--
-- Rollback: drop function public.assign_initiative, public.assign_category;
--           drop table assignment_history, category_assignments, procurement_team_members, procurement_teams, procurement_categories;
--           alter table sourcing_plans drop column category_id, backup_user_id, team_id, si_plan_item_id;
--           alter table si_plan_items drop column category_id;

-- Utilidad compartida por las etapas 2 a 4: crea las políticas estándar de una tabla con company_id.
--   lectura: perfiles internos de la empresa (opcionalmente solo ciertos roles);
--   escritura: solo los roles indicados (el viewer nunca está incluido);
--   append_only: sin UPDATE ni DELETE (bitácoras e historiales);
--   restrictiva: un proveedor no accede nunca.
create or replace function private.secure_company_table(
  p_table text,
  p_write_roles text[] default array['super_admin', 'admin', 'manager'],
  p_select_roles text[] default null,
  p_append_only boolean default false
) returns void
language plpgsql
set search_path = ''
as $$
declare
  select_check text := 'company_id = private.current_company_id() and (select private.is_internal_profile())';
  write_check text := format('company_id = private.current_company_id() and (select private.is_internal_profile()) and private."current_role"() = any (%L::text[])', p_write_roles);
begin
  if p_select_roles is not null then
    select_check := select_check || format(' and private."current_role"() = any (%L::text[])', p_select_roles);
  end if;
  execute format('alter table public.%I enable row level security', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_select_internal', p_table);
  execute format('create policy %I on public.%I for select to authenticated using (%s)', p_table || '_select_internal', p_table, select_check);
  execute format('drop policy if exists %I on public.%I', p_table || '_insert_roles', p_table);
  execute format('create policy %I on public.%I for insert to authenticated with check (%s)', p_table || '_insert_roles', p_table, write_check);
  execute format('drop policy if exists %I on public.%I', p_table || '_update_roles', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_delete_roles', p_table);
  if p_append_only then
    execute format('revoke update, delete, truncate on public.%I from authenticated, anon', p_table);
  else
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', p_table || '_update_roles', p_table, write_check, write_check);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', p_table || '_delete_roles', p_table, write_check);
  end if;
  execute format('drop policy if exists %I on public.%I', p_table || '_no_supplier', p_table);
  execute format('create policy %I on public.%I as restrictive for all to authenticated using ((select private.is_internal_profile())) with check ((select private.is_internal_profile()))', p_table || '_no_supplier', p_table);
  execute format('revoke all on public.%I from anon', p_table);
end $$;

revoke all on function private.secure_company_table(text, text[], text[], boolean) from public, anon, authenticated;

-- Pertenencia: una persona asignable es un perfil interno de la empresa con rol de compras o gestión.
create or replace function private.is_assignable(p_user uuid, p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is null or exists (
    select 1 from public.profiles p
    where p.id = p_user and p.company_id = p_company and p.supplier_id is null
      and p.role::text in ('super_admin', 'admin', 'manager', 'analyst')
  )
$$;
revoke all on function private.is_assignable(uuid, uuid) from public, anon;
grant execute on function private.is_assignable(uuid, uuid) to authenticated;

create table if not exists public.procurement_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  normalized_name text generated always as (lower(regexp_replace(trim(name), '\s+', ' ', 'g'))) stored,
  parent_id uuid references public.procurement_categories(id) on delete restrict,
  source text not null default 'manual' check (source in ('taxonomia_spend', 'plan', 'manual')),
  taxonomy_ref text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, normalized_name)
);
create index if not exists procurement_categories_company_idx on public.procurement_categories (company_id);

create table if not exists public.procurement_teams (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  lead_user_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists procurement_teams_name_idx on public.procurement_teams (company_id, lower(trim(name)));

create table if not exists public.procurement_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.procurement_teams(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('lead', 'member')),
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);
create index if not exists procurement_team_members_user_idx on public.procurement_team_members (user_id);

-- Category Manager y suplente son una asignación, no un rol nuevo.
create table if not exists public.category_assignments (
  category_id uuid primary key references public.procurement_categories(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  manager_user_id uuid references public.profiles(id) on delete set null,
  backup_user_id uuid references public.profiles(id) on delete set null,
  team_id uuid references public.procurement_teams(id) on delete set null,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  check (manager_user_id is null or manager_user_id is distinct from backup_user_id)
);

-- Historial append-only de asignaciones y reasignaciones (sin FK a la entidad para que sobreviva a cualquier cambio).
create table if not exists public.assignment_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_type text not null check (entity_type in ('category', 'initiative')),
  entity_id uuid not null,
  role_kind text not null check (role_kind in ('manager', 'backup', 'responsible', 'team', 'category')),
  from_value uuid,
  to_value uuid,
  reason text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists assignment_history_entity_idx on public.assignment_history (company_id, entity_type, entity_id, changed_at desc);

alter table public.sourcing_plans
  add column if not exists category_id uuid references public.procurement_categories(id) on delete restrict,
  add column if not exists backup_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists team_id uuid references public.procurement_teams(id) on delete restrict,
  add column if not exists si_plan_item_id uuid references public.si_plan_items(id) on delete restrict;
create index if not exists sourcing_plans_item_idx on public.sourcing_plans (si_plan_item_id);
create index if not exists sourcing_plans_category_idx on public.sourcing_plans (category_id);
create index if not exists sourcing_plans_team_idx on public.sourcing_plans (team_id);

alter table public.si_plan_items
  add column if not exists category_id uuid references public.procurement_categories(id) on delete restrict;

select private.secure_company_table('procurement_categories');
select private.secure_company_table('procurement_teams');
select private.secure_company_table('procurement_team_members');
select private.secure_company_table('category_assignments');
select private.secure_company_table('assignment_history', array['super_admin', 'admin', 'manager'], null, true);

-- Integridad multiempresa de las referencias nuevas.
create or replace function private.check_portfolio_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'sourcing_plans' then
    if new.category_id is not null and not exists (select 1 from public.procurement_categories c where c.id = new.category_id and c.company_id = new.company_id) then
      raise exception 'La categoría no pertenece a la empresa de la iniciativa';
    end if;
    if new.team_id is not null and not exists (select 1 from public.procurement_teams t where t.id = new.team_id and t.company_id = new.company_id) then
      raise exception 'El equipo no pertenece a la empresa de la iniciativa';
    end if;
    if not private.is_assignable(new.backup_user_id, new.company_id) or not private.is_assignable(new.responsible_user_id, new.company_id) then
      raise exception 'Solo se puede asignar a perfiles internos de compras de la empresa';
    end if;
    if new.si_plan_item_id is not null and not exists (select 1 from public.si_plan_items i where i.id = new.si_plan_item_id and i.company_id = new.company_id) then
      raise exception 'La oportunidad no pertenece a la empresa de la iniciativa';
    end if;
    if new.responsible_user_id is not null and new.responsible_user_id = new.backup_user_id then
      raise exception 'El suplente debe ser otra persona';
    end if;
  elsif tg_table_name = 'si_plan_items' then
    if new.category_id is not null and not exists (select 1 from public.procurement_categories c where c.id = new.category_id and c.company_id = new.company_id) then
      raise exception 'La categoría no pertenece a la empresa de la oportunidad';
    end if;
  elsif tg_table_name in ('category_assignments', 'procurement_team_members') then
    if tg_table_name = 'category_assignments' then
      if not exists (select 1 from public.procurement_categories c where c.id = new.category_id and c.company_id = new.company_id) then
        raise exception 'La categoría no pertenece a la empresa';
      end if;
      if new.team_id is not null and not exists (select 1 from public.procurement_teams t where t.id = new.team_id and t.company_id = new.company_id) then
        raise exception 'El equipo no pertenece a la empresa';
      end if;
      if not private.is_assignable(new.manager_user_id, new.company_id) or not private.is_assignable(new.backup_user_id, new.company_id) then
        raise exception 'Solo se puede asignar a perfiles internos de compras de la empresa';
      end if;
    else
      if not exists (select 1 from public.procurement_teams t where t.id = new.team_id and t.company_id = new.company_id)
         or not private.is_assignable(new.user_id, new.company_id) then
        raise exception 'El equipo y la persona deben pertenecer a la empresa y ser perfiles de compras';
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists check_portfolio_refs on public.sourcing_plans;
create trigger check_portfolio_refs before insert or update of category_id, team_id, backup_user_id, responsible_user_id, si_plan_item_id on public.sourcing_plans
  for each row execute function private.check_portfolio_refs();
drop trigger if exists check_portfolio_refs on public.si_plan_items;
create trigger check_portfolio_refs before insert or update of category_id on public.si_plan_items
  for each row execute function private.check_portfolio_refs();
drop trigger if exists check_portfolio_refs on public.category_assignments;
create trigger check_portfolio_refs before insert or update on public.category_assignments
  for each row execute function private.check_portfolio_refs();
drop trigger if exists check_portfolio_refs on public.procurement_team_members;
create trigger check_portfolio_refs before insert or update on public.procurement_team_members
  for each row execute function private.check_portfolio_refs();

-- Respaldo: cualquier cambio directo de responsable/suplente/equipo/categoría en una iniciativa queda en el historial
-- aunque no use la función assign_initiative (sin motivo).
create or replace function private.log_initiative_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare reason text := nullif(current_setting('xpend.assignment_reason', true), '');
begin
  if new.responsible_user_id is distinct from old.responsible_user_id then
    insert into public.assignment_history (company_id, entity_type, entity_id, role_kind, from_value, to_value, reason, changed_by)
    values (new.company_id, 'initiative', new.id, 'responsible', old.responsible_user_id, new.responsible_user_id, reason, (select auth.uid()));
  end if;
  if new.backup_user_id is distinct from old.backup_user_id then
    insert into public.assignment_history (company_id, entity_type, entity_id, role_kind, from_value, to_value, reason, changed_by)
    values (new.company_id, 'initiative', new.id, 'backup', old.backup_user_id, new.backup_user_id, reason, (select auth.uid()));
  end if;
  if new.team_id is distinct from old.team_id then
    insert into public.assignment_history (company_id, entity_type, entity_id, role_kind, from_value, to_value, reason, changed_by)
    values (new.company_id, 'initiative', new.id, 'team', old.team_id, new.team_id, reason, (select auth.uid()));
  end if;
  if new.category_id is distinct from old.category_id then
    insert into public.assignment_history (company_id, entity_type, entity_id, role_kind, from_value, to_value, reason, changed_by)
    values (new.company_id, 'initiative', new.id, 'category', old.category_id, new.category_id, reason, (select auth.uid()));
  end if;
  return new;
end $$;

drop trigger if exists log_initiative_assignment on public.sourcing_plans;
create trigger log_initiative_assignment after update of responsible_user_id, backup_user_id, team_id, category_id on public.sourcing_plans
  for each row execute function private.log_initiative_assignment();

create or replace function private.log_category_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare reason text := nullif(current_setting('xpend.assignment_reason', true), '');
begin
  if tg_op = 'INSERT' or new.manager_user_id is distinct from old.manager_user_id then
    insert into public.assignment_history (company_id, entity_type, entity_id, role_kind, from_value, to_value, reason, changed_by)
    values (new.company_id, 'category', new.category_id, 'manager', case when tg_op = 'UPDATE' then old.manager_user_id end, new.manager_user_id, reason, (select auth.uid()));
  end if;
  if tg_op = 'INSERT' or new.backup_user_id is distinct from old.backup_user_id then
    insert into public.assignment_history (company_id, entity_type, entity_id, role_kind, from_value, to_value, reason, changed_by)
    values (new.company_id, 'category', new.category_id, 'backup', case when tg_op = 'UPDATE' then old.backup_user_id end, new.backup_user_id, reason, (select auth.uid()));
  end if;
  if tg_op = 'INSERT' or new.team_id is distinct from old.team_id then
    insert into public.assignment_history (company_id, entity_type, entity_id, role_kind, from_value, to_value, reason, changed_by)
    values (new.company_id, 'category', new.category_id, 'team', case when tg_op = 'UPDATE' then old.team_id end, new.team_id, reason, (select auth.uid()));
  end if;
  return new;
end $$;

drop trigger if exists log_category_assignment on public.category_assignments;
create trigger log_category_assignment after insert or update on public.category_assignments
  for each row execute function private.log_category_assignment();

-- Funciones de negocio (SECURITY INVOKER: RLS decide quién puede escribir). Una reasignación exige motivo.
create or replace function public.assign_category(p_category uuid, p_manager uuid, p_backup uuid, p_team uuid, p_reason text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare cur public.category_assignments%rowtype; cid uuid;
begin
  select company_id into cid from public.procurement_categories where id = p_category;
  if cid is null then raise exception 'Categoría no encontrada'; end if;
  select * into cur from public.category_assignments where category_id = p_category;
  if found and (cur.manager_user_id is distinct from p_manager or cur.backup_user_id is distinct from p_backup or cur.team_id is distinct from p_team)
     and (cur.manager_user_id is not null or cur.backup_user_id is not null or cur.team_id is not null)
     and length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Una reasignación necesita un motivo';
  end if;
  perform set_config('xpend.assignment_reason', coalesce(trim(p_reason), ''), true);
  insert into public.category_assignments (category_id, company_id, manager_user_id, backup_user_id, team_id, assigned_by, assigned_at)
  values (p_category, cid, p_manager, p_backup, p_team, (select auth.uid()), now())
  on conflict (category_id) do update
    set manager_user_id = excluded.manager_user_id, backup_user_id = excluded.backup_user_id, team_id = excluded.team_id,
        assigned_by = excluded.assigned_by, assigned_at = excluded.assigned_at;
end $$;

create or replace function public.assign_initiative(p_plan uuid, p_responsible uuid, p_backup uuid, p_team uuid, p_category uuid, p_reason text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare cur public.sourcing_plans%rowtype;
begin
  select * into cur from public.sourcing_plans where id = p_plan;
  if not found then raise exception 'Iniciativa no encontrada'; end if;
  if (cur.responsible_user_id is distinct from p_responsible or cur.backup_user_id is distinct from p_backup
      or cur.team_id is distinct from p_team or cur.category_id is distinct from p_category)
     and (cur.responsible_user_id is not null or cur.backup_user_id is not null or cur.team_id is not null or cur.category_id is not null)
     and length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Una reasignación necesita un motivo';
  end if;
  perform set_config('xpend.assignment_reason', coalesce(trim(p_reason), ''), true);
  update public.sourcing_plans
     set responsible_user_id = p_responsible, backup_user_id = p_backup, team_id = p_team, category_id = p_category
   where id = p_plan;
  if not found then raise exception 'No tienes permiso para reasignar esta iniciativa'; end if;
end $$;

revoke all on function public.assign_category(uuid, uuid, uuid, uuid, text), public.assign_initiative(uuid, uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.assign_category(uuid, uuid, uuid, uuid, text), public.assign_initiative(uuid, uuid, uuid, uuid, uuid, text) to authenticated;
