-- Etapa 4: control de ahorros. Separa cinco conceptos: línea base documentada, objetivo, negociado, validado y realizado.
--
--   * El negociado sale de la adjudicación (process_awards) y NUNCA se convierte solo en validado ni en realizado.
--   * Validar es un acto posterior, de un gerente o administrador distinto de quien declaró (lo exige la base de datos).
--   * El realizado son reconocimientos mensuales inmutables con evidencia en el bucket privado. Se corrigen con una reversa.
--   * Una sola declaración activa por adjudicación; una sola reconocida abierta por validación y mes.
--   * Cada cifra queda en su moneda: no hay conversión implícita.
--
-- Todas las escrituras pasan por funciones con verificación de rol, empresa y reglas; no hay políticas de escritura directas.
-- Aditiva: no modifica process_awards, licitaciones ni sourcing_plans.
--
-- Rollback: drop function public.declare_savings, public.validate_savings, public.return_savings, public.withdraw_savings,
--           public.add_savings_evidence, public.recognize_savings, public.reverse_recognition;
--           drop table savings_events, savings_recognitions, savings_evidence, savings_validations;
--           drop policy storage_objects_viewer_no_savings on storage.objects;

create table if not exists public.savings_validations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  award_id uuid references public.process_awards(id) on delete restrict,
  licitacion_id text,
  sourcing_plan_id uuid references public.sourcing_plans(id) on delete restrict,
  category_id uuid references public.procurement_categories(id) on delete restrict,
  owner_user_id uuid references public.profiles(id) on delete set null,
  team_id uuid references public.procurement_teams(id) on delete set null,
  source_kind text not null check (source_kind in ('comite', 'manual')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  baseline_amount numeric not null check (baseline_amount >= 0),
  awarded_amount numeric not null check (awarded_amount >= 0),
  declared_amount numeric not null check (declared_amount > 0),
  nature text not null check (nature in ('reduccion_precio', 'evitacion_costo')),
  recurrence text not null check (recurrence in ('unico', 'recurrente')),
  start_date date not null,
  end_date date,
  validated_amount numeric check (validated_amount is null or validated_amount >= 0),
  method text,
  status text not null default 'declared' check (status in ('declared', 'validated', 'returned', 'withdrawn')),
  declared_by uuid not null references public.profiles(id) on delete restrict,
  declared_at timestamptz not null default now(),
  declare_note text,
  validated_by uuid references public.profiles(id) on delete restrict,
  validated_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (award_id is not null or licitacion_id is not null),
  check (recurrence = 'unico' or end_date is not null),
  check (end_date is null or end_date >= start_date),
  check (validated_by is null or validated_by is distinct from declared_by),
  check ((status <> 'validated') or (validated_by is not null and validated_amount is not null and validated_at is not null and length(trim(coalesce(method, ''))) >= 5))
);
create unique index if not exists savings_validations_one_active_per_award on public.savings_validations (award_id) where award_id is not null and status in ('declared', 'validated');
create unique index if not exists savings_validations_one_active_manual on public.savings_validations (licitacion_id) where award_id is null and status in ('declared', 'validated');
create index if not exists savings_validations_company_idx on public.savings_validations (company_id, status);
create index if not exists savings_validations_plan_idx on public.savings_validations (sourcing_plan_id);

create table if not exists public.savings_evidence (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  validation_id uuid not null references public.savings_validations(id) on delete restrict,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  description text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  unique (storage_path)
);
create index if not exists savings_evidence_validation_idx on public.savings_evidence (validation_id);

create table if not exists public.savings_recognitions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  validation_id uuid not null references public.savings_validations(id) on delete restrict,
  kind text not null check (kind in ('recognition', 'reversal')),
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount numeric not null check (amount > 0),
  evidence_id uuid references public.savings_evidence(id) on delete restrict,
  reverses_id uuid references public.savings_recognitions(id) on delete restrict,
  note text,
  recognized_by uuid references public.profiles(id) on delete set null,
  recognized_at timestamptz not null default now(),
  check ((kind = 'recognition' and evidence_id is not null and reverses_id is null) or (kind = 'reversal' and reverses_id is not null and length(trim(coalesce(note, ''))) >= 3))
);
create unique index if not exists savings_recognitions_one_reversal on public.savings_recognitions (reverses_id) where reverses_id is not null;
create index if not exists savings_recognitions_validation_idx on public.savings_recognitions (validation_id, period);

create table if not exists public.savings_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  validation_id uuid not null,
  event text not null check (event in ('declared', 'validated', 'returned', 'withdrawn', 'evidence_added', 'recognized', 'reversed')),
  actor_id uuid references public.profiles(id) on delete set null,
  note text,
  data jsonb,
  at timestamptz not null default now()
);
create index if not exists savings_events_validation_idx on public.savings_events (validation_id, at);

-- Nadie escribe directo: lo hacen las funciones. Lectura: los internos; evidencia y auditoría, sin viewer.
select private.secure_company_table('savings_validations', '{}'::text[]);
select private.secure_company_table('savings_recognitions', '{}'::text[], null, true);
select private.secure_company_table('savings_evidence', '{}'::text[], array['super_admin', 'admin', 'manager', 'analyst'], true);
select private.secure_company_table('savings_events', '{}'::text[], array['super_admin', 'admin', 'manager', 'analyst'], true);

-- La evidencia de ahorros es privada: el viewer tampoco la descarga del bucket.
drop policy if exists storage_objects_viewer_no_savings on storage.objects;
create policy storage_objects_viewer_no_savings on storage.objects as restrictive for select to authenticated
  using (not (bucket_id = 'documents' and split_part(name, '/', 2) = 'ahorros' and (select private.is_read_only_profile())));

-- Reglas de integridad (también valen para service role) ------------------------------------------------------------------

create or replace function private.forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Este registro no se edita ni se borra. Una corrección se hace con una reversa.';
end $$;

drop trigger if exists forbid_mutation on public.savings_recognitions;
create trigger forbid_mutation before update or delete on public.savings_recognitions for each row execute function private.forbid_mutation();
drop trigger if exists forbid_mutation on public.savings_evidence;
create trigger forbid_mutation before update or delete on public.savings_evidence for each row execute function private.forbid_mutation();
drop trigger if exists forbid_mutation on public.savings_events;
create trigger forbid_mutation before update or delete on public.savings_events for each row execute function private.forbid_mutation();

create or replace function private.guard_savings_validation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare net numeric;
begin
  if tg_op = 'DELETE' then raise exception 'Las declaraciones de ahorro no se borran: se retiran'; end if;
  if (new.company_id, new.award_id, new.licitacion_id, new.currency, new.baseline_amount, new.awarded_amount, new.declared_amount, new.declared_by, new.source_kind)
     is distinct from (old.company_id, old.award_id, old.licitacion_id, old.currency, old.baseline_amount, old.awarded_amount, old.declared_amount, old.declared_by, old.source_kind) then
    raise exception 'Los datos declarados no se modifican; se devuelve o se retira la declaración';
  end if;
  if old.status in ('returned', 'withdrawn') and new.status is distinct from old.status then
    raise exception 'Una declaración devuelta o retirada no cambia de estado; se declara de nuevo';
  end if;
  if old.status = 'validated' then
    if new.status not in ('validated', 'withdrawn') then raise exception 'Una validación solo puede mantenerse o retirarse'; end if;
    if (new.validated_amount, new.validated_by, new.validated_at, new.method, new.nature, new.recurrence, new.start_date, new.end_date, new.sourcing_plan_id)
       is distinct from (old.validated_amount, old.validated_by, old.validated_at, old.method, old.nature, old.recurrence, old.start_date, old.end_date, old.sourcing_plan_id) then
      raise exception 'Una validación no se edita. Se retira (sin reconocimientos) o se corrige con reversas.';
    end if;
    if new.status = 'withdrawn' then
      select coalesce(sum(case when kind = 'recognition' then amount else -amount end), 0) into net from public.savings_recognitions where validation_id = old.id;
      if net <> 0 then raise exception 'No se puede retirar una validación con reconocimientos vigentes: primero se reversan'; end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists guard_savings_validation on public.savings_validations;
create trigger guard_savings_validation before update or delete on public.savings_validations for each row execute function private.guard_savings_validation();

create or replace function private.guard_recognition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.savings_validations%rowtype;
  orig public.savings_recognitions%rowtype;
  net_total numeric;
  open_count integer;
  start_period text;
  end_period text;
begin
  select * into v from public.savings_validations where id = new.validation_id;
  if not found or v.company_id <> new.company_id then raise exception 'La validación no pertenece a la empresa'; end if;
  if v.status <> 'validated' then raise exception 'Solo se reconoce ahorro sobre una validación vigente'; end if;
  if new.currency <> v.currency then raise exception 'La moneda del reconocimiento debe ser la de la validación (% )', v.currency; end if;
  if new.kind = 'reversal' then
    select * into orig from public.savings_recognitions where id = new.reverses_id;
    if not found or orig.kind <> 'recognition' or orig.validation_id <> new.validation_id then raise exception 'La reversa debe corresponder a un reconocimiento de la misma validación'; end if;
    if new.period <> orig.period or new.amount <> orig.amount then raise exception 'La reversa anula el reconocimiento completo: mismo período y monto'; end if;
    return new;
  end if;
  if new.period > to_char(current_date, 'YYYY-MM') then raise exception 'No se reconoce ahorro de un período futuro'; end if;
  start_period := to_char(v.start_date, 'YYYY-MM');
  if new.period < start_period then raise exception 'El período es anterior al inicio del beneficio (%)', start_period; end if;
  if not exists (select 1 from public.savings_evidence e where e.id = new.evidence_id and e.validation_id = new.validation_id and e.company_id = new.company_id) then
    raise exception 'Sin evidencia de esta validación no hay reconocimiento';
  end if;
  select count(*) filter (where kind = 'recognition') - count(*) filter (where kind = 'reversal') into open_count
    from public.savings_recognitions where validation_id = new.validation_id and period = new.period;
  if open_count > 0 then raise exception 'Ya hay un reconocimiento para este período. Para corregirlo, primero se reversa'; end if;
  select coalesce(sum(case when kind = 'recognition' then amount else -amount end), 0) into net_total from public.savings_recognitions where validation_id = new.validation_id;
  if v.recurrence = 'unico' then
    if net_total + new.amount > v.validated_amount then raise exception 'El reconocimiento supera el ahorro único validado'; end if;
  else
    end_period := to_char(v.end_date, 'YYYY-MM');
    if new.period > end_period then raise exception 'El período es posterior al término del beneficio (%)', end_period; end if;
    if new.amount > round(v.validated_amount / 12, 2) + 0.01 then raise exception 'El reconocimiento mensual supera un doceavo del ahorro anualizado validado'; end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_recognition on public.savings_recognitions;
create trigger guard_recognition before insert on public.savings_recognitions for each row execute function private.guard_recognition();

-- Funciones de negocio ------------------------------------------------------------------------------------------------------

create or replace function private.savings_actor_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role::text from public.profiles p where p.id = (select auth.uid()) and p.supplier_id is null
$$;
revoke all on function private.savings_actor_role() from public, anon;
grant execute on function private.savings_actor_role() to authenticated;

create or replace function public.declare_savings(
  p_award uuid, p_licitacion text, p_plan uuid, p_declared numeric, p_nature text, p_recurrence text, p_start date, p_end date, p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  role text := private.savings_actor_role();
  cid uuid := private.current_company_id();
  a public.process_awards%rowtype;
  l public.licitaciones%rowtype;
  pl public.sourcing_plans%rowtype;
  v_currency text; v_baseline numeric; v_awarded numeric; v_max numeric; v_lic text; v_source text;
  v_plan uuid := p_plan;
  v_category uuid; v_owner uuid; v_team uuid;
  new_id uuid;
begin
  if role is null or role not in ('super_admin', 'admin', 'manager', 'analyst') then raise exception 'Tu perfil no puede declarar ahorros'; end if;
  if p_nature not in ('reduccion_precio', 'evitacion_costo') then raise exception 'Indica si es reducción de precio o evitación de costo'; end if;
  if p_recurrence not in ('unico', 'recurrente') then raise exception 'Indica si el beneficio es único o recurrente'; end if;
  if p_declared is null or p_declared <= 0 then raise exception 'El ahorro declarado debe ser mayor que cero'; end if;
  if p_start is null then raise exception 'Indica desde cuándo rige el beneficio'; end if;
  if p_recurrence = 'recurrente' and (p_end is null or p_end < p_start) then raise exception 'Un beneficio recurrente necesita fecha de término posterior al inicio'; end if;

  if p_award is not null then
    select * into a from public.process_awards where id = p_award and company_id = cid;
    if not found then raise exception 'Adjudicación no encontrada'; end if;
    v_baseline := a.baseline_amount; v_awarded := a.amount; v_currency := upper(a.currency); v_lic := a.licitacion_id; v_source := 'comite';
    if v_baseline is null or a.baseline_currency is null or upper(a.baseline_currency) <> v_currency or v_awarded is null then
      raise exception 'No comparable. Falta línea base o moneda';
    end if;
  else
    select * into l from public.licitaciones where id = p_licitacion and company_id = cid;
    if not found then raise exception 'Licitación no encontrada'; end if;
    if exists (select 1 from public.process_awards pa where pa.licitacion_id = l.id and pa.company_id = cid) then
      raise exception 'Esta licitación tiene adjudicación de comité: declara el ahorro sobre la adjudicación';
    end if;
    v_baseline := l.baseline_amount; v_awarded := l.awarded_amount; v_currency := upper(l.baseline_currency); v_lic := l.id; v_source := 'manual';
    if v_baseline is null or v_awarded is null or v_currency is null then raise exception 'No comparable. Falta línea base o moneda'; end if;
  end if;
  v_max := greatest(v_baseline - v_awarded, 0);
  if p_declared > v_max then raise exception 'El ahorro declarado no puede superar el negociado comparable (%)', v_max; end if;

  if v_plan is null then
    select spl.plan_id into v_plan from public.sourcing_plan_licitaciones spl where spl.licitacion_id = v_lic order by spl.created_at limit 1;
  end if;
  if v_plan is not null then
    select * into pl from public.sourcing_plans where id = v_plan and company_id = cid;
    if not found then raise exception 'Iniciativa no encontrada'; end if;
    v_category := pl.category_id;
    select coalesce(pl.responsible_user_id, ca.manager_user_id), coalesce(pl.team_id, ca.team_id)
      into v_owner, v_team from (select 1) x left join public.category_assignments ca on ca.category_id = pl.category_id;
  end if;
  if role = 'analyst' and not coalesce(v_plan is not null and (actor = pl.responsible_user_id or actor = pl.backup_user_id), false) then
    raise exception 'Solo el responsable o el suplente de la iniciativa declara su ahorro';
  end if;

  begin
    insert into public.savings_validations (company_id, award_id, licitacion_id, sourcing_plan_id, category_id, owner_user_id, team_id, source_kind, currency,
      baseline_amount, awarded_amount, declared_amount, nature, recurrence, start_date, end_date, declared_by, declare_note)
    values (cid, p_award, v_lic, v_plan, v_category, v_owner, v_team, v_source, v_currency, v_baseline, v_awarded, p_declared, p_nature, p_recurrence, p_start,
      case when p_recurrence = 'recurrente' then p_end end, actor, nullif(trim(coalesce(p_note, '')), ''))
    returning id into new_id;
  exception when unique_violation then
    raise exception 'Ya existe una declaración activa para esta adjudicación: un ahorro no se cuenta dos veces';
  end;
  insert into public.savings_events (company_id, validation_id, event, actor_id, note, data)
  values (cid, new_id, 'declared', actor, p_note, jsonb_build_object('declared_amount', p_declared, 'currency', v_currency, 'source', v_source));
  return new_id;
end $$;

create or replace function public.validate_savings(p_validation uuid, p_validated numeric, p_method text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  role text := private.savings_actor_role();
  v public.savings_validations%rowtype;
begin
  if role is null or role not in ('super_admin', 'admin', 'manager') then raise exception 'Solo un gerente o administrador valida ahorros'; end if;
  select * into v from public.savings_validations where id = p_validation and company_id = private.current_company_id() for update;
  if not found then raise exception 'Declaración no encontrada'; end if;
  if v.status <> 'declared' then raise exception 'Solo se valida una declaración pendiente'; end if;
  if v.declared_by = actor then raise exception 'Quien declara no valida: lo valida otra persona'; end if;
  if p_validated is null or p_validated < 0 or p_validated > v.declared_amount then raise exception 'El monto validado debe estar entre cero y lo declarado (%)', v.declared_amount; end if;
  if length(trim(coalesce(p_method, ''))) < 5 then raise exception 'Describe la metodología de validación'; end if;
  update public.savings_validations
     set status = 'validated', validated_amount = p_validated, method = trim(p_method), validated_by = actor, validated_at = now(), review_note = nullif(trim(coalesce(p_note, '')), '')
   where id = p_validation;
  insert into public.savings_events (company_id, validation_id, event, actor_id, note, data)
  values (v.company_id, p_validation, 'validated', actor, p_note, jsonb_build_object('validated_amount', p_validated, 'method', trim(p_method)));
end $$;

create or replace function public.return_savings(p_validation uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  role text := private.savings_actor_role();
  v public.savings_validations%rowtype;
begin
  if role is null or role not in ('super_admin', 'admin', 'manager') then raise exception 'Solo un gerente o administrador devuelve declaraciones'; end if;
  if length(trim(coalesce(p_note, ''))) < 3 then raise exception 'Al devolver una declaración se explica el motivo'; end if;
  select * into v from public.savings_validations where id = p_validation and company_id = private.current_company_id() for update;
  if not found then raise exception 'Declaración no encontrada'; end if;
  if v.status <> 'declared' then raise exception 'Solo se devuelve una declaración pendiente'; end if;
  update public.savings_validations set status = 'returned', review_note = trim(p_note) where id = p_validation;
  insert into public.savings_events (company_id, validation_id, event, actor_id, note) values (v.company_id, p_validation, 'returned', actor, p_note);
end $$;

create or replace function public.withdraw_savings(p_validation uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  role text := private.savings_actor_role();
  v public.savings_validations%rowtype;
begin
  if role is null or role not in ('super_admin', 'admin', 'manager', 'analyst') then raise exception 'Tu perfil no puede retirar declaraciones'; end if;
  if length(trim(coalesce(p_note, ''))) < 3 then raise exception 'Al retirar una declaración se explica el motivo'; end if;
  select * into v from public.savings_validations where id = p_validation and company_id = private.current_company_id() for update;
  if not found then raise exception 'Declaración no encontrada'; end if;
  if v.status not in ('declared', 'validated') then raise exception 'La declaración ya está cerrada'; end if;
  if v.status = 'validated' and role not in ('super_admin', 'admin', 'manager') then raise exception 'Solo un gerente o administrador retira una validación'; end if;
  if v.status = 'declared' and v.declared_by <> actor and role not in ('super_admin', 'admin', 'manager') then raise exception 'Solo quien declaró (o un gerente) la retira'; end if;
  update public.savings_validations set status = 'withdrawn', review_note = trim(p_note) where id = p_validation;
  insert into public.savings_events (company_id, validation_id, event, actor_id, note) values (v.company_id, p_validation, 'withdrawn', actor, p_note);
end $$;

-- La evidencia debe existir de verdad en el bucket privado y colgar de la ruta de esa validación.
create or replace function public.add_savings_evidence(p_validation uuid, p_path text, p_file_name text, p_mime text, p_size bigint, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  role text := private.savings_actor_role();
  v public.savings_validations%rowtype;
  new_id uuid;
begin
  if role is null or role not in ('super_admin', 'admin', 'manager') then raise exception 'Solo un gerente o administrador adjunta evidencia'; end if;
  select * into v from public.savings_validations where id = p_validation and company_id = private.current_company_id();
  if not found then raise exception 'Declaración no encontrada'; end if;
  if v.status not in ('declared', 'validated') then raise exception 'La declaración está cerrada'; end if;
  if p_path is null or split_part(p_path, '/', 1) <> v.company_id::text or split_part(p_path, '/', 2) <> 'ahorros' or split_part(p_path, '/', 3) <> v.id::text then
    raise exception 'La ruta de la evidencia no corresponde a esta declaración';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'documents' and o.name = p_path) then
    raise exception 'El archivo de evidencia no existe en el almacenamiento privado';
  end if;
  insert into public.savings_evidence (company_id, validation_id, storage_path, file_name, mime_type, size_bytes, description, uploaded_by)
  values (v.company_id, p_validation, p_path, p_file_name, p_mime, p_size, nullif(trim(coalesce(p_description, '')), ''), actor)
  returning id into new_id;
  insert into public.savings_events (company_id, validation_id, event, actor_id, note, data)
  values (v.company_id, p_validation, 'evidence_added', actor, p_description, jsonb_build_object('file_name', p_file_name));
  return new_id;
end $$;

create or replace function public.recognize_savings(p_validation uuid, p_period text, p_amount numeric, p_evidence uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  role text := private.savings_actor_role();
  v public.savings_validations%rowtype;
  new_id uuid;
begin
  if role is null or role not in ('super_admin', 'admin', 'manager') then raise exception 'Solo un gerente o administrador reconoce ahorros'; end if;
  select * into v from public.savings_validations where id = p_validation and company_id = private.current_company_id() for update;
  if not found then raise exception 'Validación no encontrada'; end if;
  insert into public.savings_recognitions (company_id, validation_id, kind, period, currency, amount, evidence_id, note, recognized_by)
  values (v.company_id, p_validation, 'recognition', p_period, v.currency, p_amount, p_evidence, nullif(trim(coalesce(p_note, '')), ''), actor)
  returning id into new_id;
  insert into public.savings_events (company_id, validation_id, event, actor_id, note, data)
  values (v.company_id, p_validation, 'recognized', actor, p_note, jsonb_build_object('period', p_period, 'amount', p_amount, 'currency', v.currency));
  return new_id;
end $$;

create or replace function public.reverse_recognition(p_recognition uuid, p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  role text := private.savings_actor_role();
  r public.savings_recognitions%rowtype;
  v public.savings_validations%rowtype;
  new_id uuid;
begin
  if role is null or role not in ('super_admin', 'admin', 'manager') then raise exception 'Solo un gerente o administrador reversa reconocimientos'; end if;
  select * into r from public.savings_recognitions where id = p_recognition and company_id = private.current_company_id();
  if not found or r.kind <> 'recognition' then raise exception 'Reconocimiento no encontrado'; end if;
  select * into v from public.savings_validations where id = r.validation_id for update;
  if exists (select 1 from public.savings_recognitions x where x.reverses_id = r.id) then raise exception 'Este reconocimiento ya fue reversado'; end if;
  insert into public.savings_recognitions (company_id, validation_id, kind, period, currency, amount, reverses_id, note, recognized_by)
  values (r.company_id, r.validation_id, 'reversal', r.period, r.currency, r.amount, r.id, trim(p_note), actor)
  returning id into new_id;
  insert into public.savings_events (company_id, validation_id, event, actor_id, note, data)
  values (r.company_id, r.validation_id, 'reversed', actor, p_note, jsonb_build_object('period', r.period, 'amount', r.amount, 'currency', r.currency));
  return new_id;
end $$;

revoke all on function public.declare_savings(uuid, text, uuid, numeric, text, text, date, date, text),
  public.validate_savings(uuid, numeric, text, text), public.return_savings(uuid, text), public.withdraw_savings(uuid, text),
  public.add_savings_evidence(uuid, text, text, text, bigint, text), public.recognize_savings(uuid, text, numeric, uuid, text),
  public.reverse_recognition(uuid, text) from public, anon;
grant execute on function public.declare_savings(uuid, text, uuid, numeric, text, text, date, date, text),
  public.validate_savings(uuid, numeric, text, text), public.return_savings(uuid, text), public.withdraw_savings(uuid, text),
  public.add_savings_evidence(uuid, text, text, text, bigint, text), public.recognize_savings(uuid, text, numeric, uuid, text),
  public.reverse_recognition(uuid, text) to authenticated;
