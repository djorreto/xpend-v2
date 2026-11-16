-- Etapa 3: plan anual (borrador / comprometido), metas por categoría, año y moneda, y los siete hitos S2C de cada iniciativa.
--
-- Aditiva: solo tablas nuevas. Reutiliza sourcing_plans (iniciativas), procurement_categories (Etapa 2) y las fechas que ya
-- existen en licitaciones. Las fechas reales de los procesos NO se copian: se derivan al leer, para no duplicar registros.
--
-- Reglas que aplica la base de datos (no solo la pantalla):
--   * Un plan comprometido conserva una foto del original (annual_plan_snapshots, solo agregar).
--   * Después de comprometer, cada cambio de una línea exige motivo y queda en annual_plan_changes.
--   * La fecha original de un hito no se cambia. Reprogramar la comprometida exige causa y motivo, y queda en el historial.
--   * Los historiales no se editan ni se borran.
--
-- Rollback: drop function public.commit_annual_plan, public.upsert_annual_line, public.ensure_milestones,
--           public.reschedule_milestones, public.record_milestone_actual, public.set_milestone_block;
--           drop table initiative_milestone_changes, initiative_milestones, annual_plan_changes, annual_plan_snapshots,
--                      annual_plan_lines, annual_plans;

create table if not exists public.annual_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  plan_year integer not null check (plan_year between 2000 and 2100),
  name text,
  status text not null default 'draft' check (status in ('draft', 'committed')),
  committed_at timestamptz,
  committed_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (company_id, plan_year),
  check ((status = 'committed') = (committed_at is not null))
);

-- Meta de ahorro por categoría, año y moneda. La meta de una persona o un equipo se obtiene sumando las categorías que lleva:
-- así una meta nunca se asigna dos veces.
create table if not exists public.annual_plan_lines (
  id uuid primary key default gen_random_uuid(),
  annual_plan_id uuid not null references public.annual_plans(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  category_id uuid not null references public.procurement_categories(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  historical_spend numeric check (historical_spend is null or historical_spend >= 0),
  target_amount numeric check (target_amount is null or target_amount >= 0),
  owner_user_id uuid references public.profiles(id) on delete set null,
  priority smallint not null default 2 check (priority between 1 and 3),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (annual_plan_id, category_id, currency)
);
create index if not exists annual_plan_lines_company_idx on public.annual_plan_lines (company_id, annual_plan_id);

create table if not exists public.annual_plan_snapshots (
  id uuid primary key default gen_random_uuid(),
  annual_plan_id uuid not null unique references public.annual_plans(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  taken_by uuid references public.profiles(id) on delete set null,
  taken_at timestamptz not null default now(),
  lines jsonb not null,
  initiatives jsonb not null,
  milestones jsonb not null
);

create table if not exists public.annual_plan_changes (
  id uuid primary key default gen_random_uuid(),
  annual_plan_id uuid not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  line_id uuid,
  change_kind text not null check (change_kind in ('line_added', 'line_revised')),
  old_values jsonb,
  new_values jsonb not null,
  reason text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists annual_plan_changes_plan_idx on public.annual_plan_changes (annual_plan_id, changed_at desc);

create table if not exists public.initiative_milestones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sourcing_plan_id uuid not null references public.sourcing_plans(id) on delete cascade,
  kind text not null check (kind in ('inicio', 'preparacion_rfx', 'invitacion', 'recepcion', 'evaluacion', 'comite_adjudicacion', 'formalizacion')),
  seq smallint not null check (seq between 1 and 7),
  original_date date,
  committed_date date,
  actual_date date,
  actual_source text check (actual_source in ('manual')),
  actual_note text,
  blocked boolean not null default false,
  block_cause text check (block_cause in ('comprador', 'aprobador', 'proveedor', 'area_solicitante', 'externo')),
  block_note text,
  blocked_at timestamptz,
  blocked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sourcing_plan_id, kind),
  check (not blocked or (block_cause is not null and length(trim(coalesce(block_note, ''))) >= 3))
);
create index if not exists initiative_milestones_company_idx on public.initiative_milestones (company_id, committed_date);

create table if not exists public.initiative_milestone_changes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  milestone_id uuid not null references public.initiative_milestones(id) on delete cascade,
  field text not null check (field in ('committed_date', 'actual_date', 'blocked')),
  old_value text,
  new_value text,
  cause text check (cause in ('comprador', 'aprobador', 'proveedor', 'area_solicitante', 'externo', 'arrastre')),
  reason text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists initiative_milestone_changes_idx on public.initiative_milestone_changes (milestone_id, changed_at desc);

select private.secure_company_table('annual_plans');
select private.secure_company_table('annual_plan_lines');
select private.secure_company_table('annual_plan_snapshots', '{}'::text[], null, true);
select private.secure_company_table('annual_plan_changes', '{}'::text[], null, true);
select private.secure_company_table('initiative_milestones');
select private.secure_company_table('initiative_milestone_changes', '{}'::text[], null, true);

-- Responsable o suplente de una iniciativa escriben sus hitos, además de gerentes y administradores. El viewer nunca.
create or replace function private.can_write_milestones(p_plan uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sourcing_plans p
    where p.id = p_plan
      and p.company_id = private.current_company_id()
      and (select private.is_internal_profile())
      and (
        private."current_role"() in ('super_admin', 'admin', 'manager')
        or (private."current_role"() = 'analyst' and (select auth.uid()) in (p.responsible_user_id, p.backup_user_id))
      )
  )
$$;
revoke all on function private.can_write_milestones(uuid) from public, anon;
grant execute on function private.can_write_milestones(uuid) to authenticated;

drop policy if exists initiative_milestones_insert_roles on public.initiative_milestones;
drop policy if exists initiative_milestones_update_roles on public.initiative_milestones;
create policy initiative_milestones_insert_roles on public.initiative_milestones for insert to authenticated
  with check (company_id = private.current_company_id() and private.can_write_milestones(sourcing_plan_id));
create policy initiative_milestones_update_roles on public.initiative_milestones for update to authenticated
  using (company_id = private.current_company_id() and private.can_write_milestones(sourcing_plan_id))
  with check (company_id = private.current_company_id() and private.can_write_milestones(sourcing_plan_id));

-- Líneas del plan anual: coherencia de empresa y revisión con motivo cuando el plan ya está comprometido.
create or replace function private.guard_annual_line()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  st text;
  plan_company uuid;
  reason text := nullif(trim(coalesce(current_setting('xpend.plan_revision_reason', true), '')), '');
begin
  select status, company_id into st, plan_company from public.annual_plans where id = coalesce(new.annual_plan_id, old.annual_plan_id);
  if tg_op = 'DELETE' then
    if st = 'committed' then raise exception 'Un plan comprometido no permite borrar líneas. Revisa la meta con un motivo.'; end if;
    return old;
  end if;
  if plan_company is distinct from new.company_id then raise exception 'La línea debe pertenecer a la empresa del plan'; end if;
  if not exists (select 1 from public.procurement_categories c where c.id = new.category_id and c.company_id = new.company_id) then
    raise exception 'La categoría no pertenece a la empresa del plan';
  end if;
  if not private.is_assignable(new.owner_user_id, new.company_id) then
    raise exception 'Solo se puede asignar a perfiles internos de compras de la empresa';
  end if;
  if st = 'committed' then
    if reason is null or length(reason) < 3 then raise exception 'Un plan comprometido solo se revisa con un motivo'; end if;
    if tg_op = 'UPDATE' then
      if (new.category_id, new.currency, new.annual_plan_id) is distinct from (old.category_id, old.currency, old.annual_plan_id) then
        raise exception 'La categoría y la moneda de una línea comprometida no se cambian';
      end if;
      insert into public.annual_plan_changes (annual_plan_id, company_id, line_id, change_kind, old_values, new_values, reason, changed_by)
      values (new.annual_plan_id, new.company_id, new.id, 'line_revised',
              jsonb_build_object('historical_spend', old.historical_spend, 'target_amount', old.target_amount, 'owner_user_id', old.owner_user_id, 'priority', old.priority),
              jsonb_build_object('historical_spend', new.historical_spend, 'target_amount', new.target_amount, 'owner_user_id', new.owner_user_id, 'priority', new.priority),
              reason, (select auth.uid()));
    else
      insert into public.annual_plan_changes (annual_plan_id, company_id, line_id, change_kind, old_values, new_values, reason, changed_by)
      values (new.annual_plan_id, new.company_id, new.id, 'line_added', null,
              jsonb_build_object('category_id', new.category_id, 'currency', new.currency, 'historical_spend', new.historical_spend, 'target_amount', new.target_amount, 'owner_user_id', new.owner_user_id, 'priority', new.priority),
              reason, (select auth.uid()));
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists guard_annual_line on public.annual_plan_lines;
create trigger guard_annual_line before insert or update or delete on public.annual_plan_lines
  for each row execute function private.guard_annual_line();

create or replace function private.guard_annual_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'committed' then raise exception 'Un plan comprometido no se elimina'; end if;
    return old;
  end if;
  if old.status = 'committed' and (new.status <> 'committed' or new.plan_year <> old.plan_year or new.company_id <> old.company_id
      or new.committed_at is distinct from old.committed_at or new.committed_by is distinct from old.committed_by) then
    raise exception 'Un plan comprometido no vuelve a borrador ni cambia de año';
  end if;
  if old.status = 'draft' and new.status = 'committed' and coalesce(current_setting('xpend.committing', true), '') <> 'on' then
    raise exception 'Un plan se compromete con la función commit_annual_plan';
  end if;
  return new;
end $$;

drop trigger if exists guard_annual_plan on public.annual_plans;
create trigger guard_annual_plan before update or delete on public.annual_plans
  for each row execute function private.guard_annual_plan();

-- Hitos: la fecha original es inmutable; reprogramar exige causa y motivo; todo cambio queda en el historial.
create or replace function private.guard_milestone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_company uuid;
  reason text := nullif(trim(coalesce(current_setting('xpend.milestone_reason', true), '')), '');
  cause text := nullif(trim(coalesce(current_setting('xpend.milestone_cause', true), '')), '');
  v_year integer;
begin
  select company_id, sourcing_plans.plan_year into plan_company, v_year from public.sourcing_plans where id = new.sourcing_plan_id;
  if plan_company is distinct from new.company_id then raise exception 'El hito debe pertenecer a la empresa de la iniciativa'; end if;
  if tg_op = 'UPDATE' then
    if old.original_date is not null and new.original_date is distinct from old.original_date then
      raise exception 'La fecha original de un hito no se cambia';
    end if;
    if new.sourcing_plan_id <> old.sourcing_plan_id or new.kind <> old.kind then
      raise exception 'Un hito no cambia de iniciativa ni de tipo';
    end if;
    if old.committed_date is not null and new.committed_date is distinct from old.committed_date then
      if reason is null or length(reason) < 3 then raise exception 'Reprogramar un hito exige un motivo'; end if;
      if cause is null or cause not in ('comprador', 'aprobador', 'proveedor', 'area_solicitante', 'externo', 'arrastre') then
        raise exception 'Reprogramar un hito exige indicar la causa';
      end if;
    end if;
  end if;
  if new.committed_date is not null and new.original_date is null
     and not exists (select 1 from public.annual_plans ap where ap.company_id = new.company_id and ap.plan_year = v_year and ap.status = 'draft') then
    new.original_date := new.committed_date;
  end if;
  if new.actual_date is not null then
    if new.actual_date > current_date then raise exception 'La fecha real no puede estar en el futuro'; end if;
    new.actual_source := coalesce(new.actual_source, 'manual');
  else
    new.actual_source := null;
  end if;
  if new.blocked and (tg_op = 'INSERT' or not old.blocked) then
    new.blocked_at := now();
    new.blocked_by := (select auth.uid());
  elsif not new.blocked then
    new.blocked_at := null;
    new.blocked_by := null;
    new.block_cause := null;
    new.block_note := null;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists guard_milestone on public.initiative_milestones;
create trigger guard_milestone before insert or update on public.initiative_milestones
  for each row execute function private.guard_milestone();

create or replace function private.log_milestone_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reason text := nullif(trim(coalesce(current_setting('xpend.milestone_reason', true), '')), '');
  cause text := nullif(trim(coalesce(current_setting('xpend.milestone_cause', true), '')), '');
begin
  if new.committed_date is distinct from (case when tg_op = 'UPDATE' then old.committed_date end) then
    insert into public.initiative_milestone_changes (company_id, milestone_id, field, old_value, new_value, cause, reason, changed_by)
    values (new.company_id, new.id, 'committed_date', case when tg_op = 'UPDATE' then old.committed_date::text end, new.committed_date::text,
            case when tg_op = 'UPDATE' and old.committed_date is not null then cause end, reason, (select auth.uid()));
  end if;
  if new.actual_date is distinct from (case when tg_op = 'UPDATE' then old.actual_date end) then
    insert into public.initiative_milestone_changes (company_id, milestone_id, field, old_value, new_value, reason, changed_by)
    values (new.company_id, new.id, 'actual_date', case when tg_op = 'UPDATE' then old.actual_date::text end, new.actual_date::text,
            coalesce(reason, new.actual_note), (select auth.uid()));
  end if;
  if new.blocked is distinct from (case when tg_op = 'UPDATE' then old.blocked else false end) then
    insert into public.initiative_milestone_changes (company_id, milestone_id, field, old_value, new_value, cause, reason, changed_by)
    values (new.company_id, new.id, 'blocked', case when tg_op = 'UPDATE' then old.blocked::text else 'false' end, new.blocked::text,
            case when new.blocked then new.block_cause end, new.block_note, (select auth.uid()));
  end if;
  return new;
end $$;

drop trigger if exists log_milestone_change on public.initiative_milestones;
create trigger log_milestone_change after insert or update on public.initiative_milestones
  for each row execute function private.log_milestone_change();

-- Funciones de negocio ---------------------------------------------------------------------------------------------

create or replace function public.upsert_annual_line(
  p_plan uuid, p_category uuid, p_currency text, p_spend numeric, p_target numeric, p_owner uuid, p_priority smallint, p_reason text default null
) returns uuid
language plpgsql
set search_path = ''
as $$
declare pl public.annual_plans%rowtype; line_id uuid; touched integer;
begin
  select * into pl from public.annual_plans where id = p_plan;
  if not found then raise exception 'Plan anual no encontrado'; end if;
  perform set_config('xpend.plan_revision_reason', coalesce(trim(p_reason), ''), true);
  select id into line_id from public.annual_plan_lines where annual_plan_id = p_plan and category_id = p_category and currency = upper(p_currency);
  if line_id is null then
    insert into public.annual_plan_lines (annual_plan_id, company_id, category_id, currency, historical_spend, target_amount, owner_user_id, priority)
    values (p_plan, pl.company_id, p_category, upper(p_currency), p_spend, p_target, p_owner, coalesce(p_priority, 2))
    returning id into line_id;
  else
    update public.annual_plan_lines
       set historical_spend = p_spend, target_amount = p_target, owner_user_id = p_owner, priority = coalesce(p_priority, 2)
     where id = line_id;
    get diagnostics touched = row_count;
    if touched = 0 then raise exception 'No tienes permiso para editar este plan'; end if;
  end if;
  return line_id;
end $$;

create or replace function public.commit_annual_plan(p_plan uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare pl public.annual_plans%rowtype;
begin
  select * into pl from public.annual_plans where id = p_plan;
  if not found or pl.company_id is distinct from private.current_company_id() then raise exception 'Plan anual no encontrado'; end if;
  if private."current_role"() not in ('super_admin', 'admin', 'manager') or not (select private.is_internal_profile()) then
    raise exception 'Solo un gerente o administrador compromete el plan';
  end if;
  if pl.status <> 'draft' then raise exception 'El plan ya está comprometido'; end if;
  if not exists (select 1 from public.annual_plan_lines where annual_plan_id = p_plan) then
    raise exception 'El plan no tiene líneas: define al menos una categoría con su meta';
  end if;
  perform set_config('xpend.committing', 'on', true);
  insert into public.annual_plan_snapshots (annual_plan_id, company_id, taken_by, lines, initiatives, milestones)
  select p_plan, pl.company_id, (select auth.uid()),
    (select coalesce(jsonb_agg(jsonb_build_object('line_id', l.id, 'category_id', l.category_id, 'category', c.name, 'currency', l.currency,
        'historical_spend', l.historical_spend, 'target_amount', l.target_amount, 'owner_user_id', l.owner_user_id, 'priority', l.priority)), '[]'::jsonb)
       from public.annual_plan_lines l join public.procurement_categories c on c.id = l.category_id where l.annual_plan_id = p_plan),
    (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'category_id', p.category_id, 'currency', p.currency,
        'estimated_spend', p.estimated_spend, 'projected_savings_amount', p.projected_savings_amount, 'responsible_user_id', p.responsible_user_id, 'quarter', p.quarter)), '[]'::jsonb)
       from public.sourcing_plans p where p.company_id = pl.company_id and p.plan_year = pl.plan_year and p.status <> 'cancelled'),
    (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'sourcing_plan_id', m.sourcing_plan_id, 'kind', m.kind, 'committed_date', m.committed_date)), '[]'::jsonb)
       from public.initiative_milestones m join public.sourcing_plans p on p.id = m.sourcing_plan_id
      where p.company_id = pl.company_id and p.plan_year = pl.plan_year and p.status <> 'cancelled');
  update public.initiative_milestones m set original_date = m.committed_date
    from public.sourcing_plans p
   where p.id = m.sourcing_plan_id and p.company_id = pl.company_id and p.plan_year = pl.plan_year
     and m.original_date is null and m.committed_date is not null;
  update public.annual_plans set status = 'committed', committed_at = now(), committed_by = (select auth.uid()) where id = p_plan;
end $$;

-- Crea los siete hitos de una iniciativa y siembra las fechas comprometidas desde lo que ya existe. No inventa fechas.
create or replace function public.ensure_milestones(p_plan uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare pl public.sourcing_plans%rowtype; lic public.licitaciones%rowtype;
begin
  select * into pl from public.sourcing_plans where id = p_plan;
  if not found then raise exception 'Iniciativa no encontrada'; end if;
  select l.* into lic from public.sourcing_plan_licitaciones spl join public.licitaciones l on l.id = spl.licitacion_id
   where spl.plan_id = p_plan order by l.created_at limit 1;
  insert into public.initiative_milestones (company_id, sourcing_plan_id, kind, seq, committed_date)
  select pl.company_id, p_plan, k.kind, k.seq,
    case k.kind
      when 'inicio' then pl.planned_start_date
      when 'invitacion' then lic.publication_date
      when 'recepcion' then lic.proposal_closing_date
      when 'evaluacion' then lic.committee_date
      when 'comite_adjudicacion' then lic.award_date
      when 'formalizacion' then coalesce(lic.contract_signature_date, pl.planned_end_date)
    end
  from (values ('inicio', 1), ('preparacion_rfx', 2), ('invitacion', 3), ('recepcion', 4), ('evaluacion', 5), ('comite_adjudicacion', 6), ('formalizacion', 7)) as k(kind, seq)
  on conflict (sourcing_plan_id, kind) do nothing;
end $$;

-- Reprograma una o varias fechas comprometidas de forma atómica. p_changes: [{"id": uuid, "date": "AAAA-MM-DD"}].
create or replace function public.reschedule_milestones(p_changes jsonb, p_cause text, p_reason text)
returns void
language plpgsql
set search_path = ''
as $$
declare item jsonb; n integer := 0; touched integer;
begin
  perform set_config('xpend.milestone_reason', coalesce(trim(p_reason), ''), true);
  perform set_config('xpend.milestone_cause', coalesce(trim(p_cause), ''), true);
  for item in select * from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb)) loop
    update public.initiative_milestones set committed_date = (item->>'date')::date where id = (item->>'id')::uuid;
    get diagnostics touched = row_count;
    if touched = 0 then raise exception 'No tienes permiso para reprogramar este hito'; end if;
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'No hay fechas que reprogramar'; end if;
end $$;

create or replace function public.record_milestone_actual(p_milestone uuid, p_actual date, p_note text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare touched integer;
begin
  perform set_config('xpend.milestone_reason', coalesce(trim(p_note), ''), true);
  update public.initiative_milestones set actual_date = p_actual, actual_note = nullif(trim(coalesce(p_note, '')), '') where id = p_milestone;
  get diagnostics touched = row_count;
  if touched = 0 then raise exception 'No tienes permiso para registrar este hito'; end if;
end $$;

create or replace function public.set_milestone_block(p_milestone uuid, p_blocked boolean, p_cause text default null, p_note text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare touched integer;
begin
  if p_blocked and (p_cause is null or length(trim(coalesce(p_note, ''))) < 3) then
    raise exception 'Un bloqueo exige causa y una nota';
  end if;
  update public.initiative_milestones
     set blocked = p_blocked, block_cause = case when p_blocked then p_cause end, block_note = case when p_blocked then trim(p_note) end
   where id = p_milestone;
  get diagnostics touched = row_count;
  if touched = 0 then raise exception 'No tienes permiso para marcar este hito'; end if;
end $$;

revoke all on function public.upsert_annual_line(uuid, uuid, text, numeric, numeric, uuid, smallint, text),
  public.commit_annual_plan(uuid), public.ensure_milestones(uuid), public.reschedule_milestones(jsonb, text, text),
  public.record_milestone_actual(uuid, date, text), public.set_milestone_block(uuid, boolean, text, text) from public, anon;
grant execute on function public.upsert_annual_line(uuid, uuid, text, numeric, numeric, uuid, smallint, text),
  public.commit_annual_plan(uuid), public.ensure_milestones(uuid), public.reschedule_milestones(jsonb, text, text),
  public.record_milestone_actual(uuid, date, text), public.set_milestone_block(uuid, boolean, text, text) to authenticated;
