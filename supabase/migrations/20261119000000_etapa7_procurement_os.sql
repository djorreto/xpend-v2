-- Etapa 7: Procurement Management OS — metodologías configurables, proyectos de sourcing, tareas y Gantt,
-- entregables versionados con aprobación, colaboración, relaciones contractuales, línea base económica y recorridos demo.
--
-- Aditiva: tablas nuevas y columnas nulas. No reescribe datos existentes ni políticas previas.
-- Reutiliza: sourcing_plans (iniciativa), procurement_categories (categoría y subcategoría por parent_id),
--   licitaciones (RFx: RFI/RFQ/RFP), offer_events/offer_rounds (salas y rondas), evaluations, award_decisions,
--   contracts/contract_versions, savings_validations, approval_events (auditoría) y notifications.
-- La tabla heredada public.projects (vacía, sin vínculo con iniciativas) no se usa: el proyecto de sourcing es otra entidad.
--
-- Reglas en la base de datos:
--   * Los hitos automáticos (event_key) no se marcan a mano: se cumplen cuando existe el registro real (project_facts).
--   * La fecha original no cambia; reprogramar la comprometida exige causa y motivo y queda en project_task_changes.
--   * Un entregable solo se aprueba por decide_approval, con una persona distinta de quien lo pidió y de quien lo subió.
--   * Un ahorro con línea base exige la línea base aprobada; si la metodología del proyecto la exige, no se valida sin ella.
--   * Una plantilla publicada no se edita: se crea una versión nueva. Un proyecto conserva la foto de su metodología.
--   * Los recorridos guiados solo existen en empresas marcadas como demo.
--
-- Rollback: drop de las funciones public.create_sourcing_project, reschedule_task, set_task_not_applicable, add_project_task,
--   link_rfx_to_project, link_project_contract, relate_contracts, add_deliverable_version, request_approval, decide_approval,
--   create_baseline, create_custom_methodology, save_methodology_draft, publish_methodology, new_methodology_version,
--   set_methodology, project_facts; drop table demo_tours, baseline_lines, economic_baselines, contract_relations,
--   project_contracts, project_activity, work_comments, approval_requests, deliverable_versions, project_deliverables,
--   project_task_changes, project_tasks, sourcing_projects, methodology_assignments, methodology_templates;
--   alter table licitaciones drop column sourcing_project_id; alter table savings_validations drop column baseline_id;
--   alter table contracts drop column category_id, signed_on, terminated_on, end_reason.

-- ---------------------------------------------------------------- metodologías
create table if not exists public.methodology_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  template_key text not null check (template_key ~ '^[a-z0-9_-]{2,60}$'),
  kind text not null check (kind in ('light', 'complete', 'custom')),
  name text not null check (length(trim(name)) > 0),
  description text,
  version integer not null default 1 check (version >= 1),
  based_on_id uuid references public.methodology_templates(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  definition jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  published_by uuid references public.profiles(id) on delete set null
);
create unique index if not exists methodology_templates_version_idx
  on public.methodology_templates (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), template_key, version);

alter table public.methodology_templates enable row level security;
drop policy if exists methodology_templates_select on public.methodology_templates;
create policy methodology_templates_select on public.methodology_templates for select to authenticated
  using ((company_id is null or company_id = private.current_company_id()) and (select private.is_internal_profile()));
revoke insert, update, delete, truncate on public.methodology_templates from authenticated, anon;

create table if not exists public.methodology_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category_id uuid references public.procurement_categories(id) on delete cascade,
  template_key text not null,
  template_company_id uuid references public.companies(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now()
);
create unique index if not exists methodology_assignments_scope_idx
  on public.methodology_assignments (company_id, coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid));
select private.secure_company_table('methodology_assignments', '{}'::text[]);

-- ---------------------------------------------------------------- proyectos de sourcing
create table if not exists public.sourcing_projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sourcing_plan_id uuid not null references public.sourcing_plans(id) on delete restrict,
  category_id uuid references public.procurement_categories(id) on delete set null,
  code text,
  title text not null check (length(trim(title)) > 0),
  description text,
  owner_id uuid references public.profiles(id) on delete set null,
  backup_id uuid references public.profiles(id) on delete set null,
  priority smallint not null default 2 check (priority between 1 and 3),
  status text not null default 'active' check (status in ('planned', 'active', 'on_hold', 'completed', 'cancelled')),
  template_id uuid references public.methodology_templates(id) on delete restrict,
  template_key text,
  template_version integer,
  methodology_kind text check (methodology_kind in ('light', 'complete', 'custom')),
  methodology_snapshot jsonb not null,
  start_date date,
  target_end_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sourcing_projects_company_idx on public.sourcing_projects (company_id, sourcing_plan_id);

create or replace function private.can_manage_project(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sourcing_projects p
    where p.id = p_project and p.company_id = private.current_company_id()
      and (select private.is_internal_profile())
      and (private."current_role"() in ('super_admin', 'admin', 'manager')
           or (private."current_role"() = 'analyst' and (select auth.uid()) in (p.owner_id, p.backup_id)))
  )
$$;
revoke all on function private.can_manage_project(uuid) from public, anon;
grant execute on function private.can_manage_project(uuid) to authenticated;

alter table public.sourcing_projects enable row level security;
select private.secure_company_table('sourcing_projects', '{}'::text[]);
drop policy if exists sourcing_projects_update_managers on public.sourcing_projects;
create policy sourcing_projects_update_managers on public.sourcing_projects for update to authenticated
  using (company_id = private.current_company_id() and private.can_manage_project(id))
  with check (company_id = private.current_company_id() and private.can_manage_project(id));

create or replace function private.guard_sourcing_project()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.company_id is distinct from old.company_id or new.sourcing_plan_id is distinct from old.sourcing_plan_id
     or new.methodology_snapshot is distinct from old.methodology_snapshot or new.template_id is distinct from old.template_id
     or new.template_version is distinct from old.template_version then
    raise exception 'La metodología y la iniciativa de un proyecto no se cambian: el proyecto conserva su versión inicial.';
  end if;
  if (select auth.uid()) is not null and (new.owner_id is distinct from old.owner_id or new.backup_id is distinct from old.backup_id)
     and private."current_role"() not in ('super_admin', 'admin', 'manager') then
    raise exception 'Solo la gerencia reasigna el responsable de un proyecto.';
  end if;
  if not private.is_assignable(new.owner_id, new.company_id) or not private.is_assignable(new.backup_id, new.company_id) then
    raise exception 'El responsable debe ser una persona interna de compras de la empresa.';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists guard_sourcing_project on public.sourcing_projects;
create trigger guard_sourcing_project before update on public.sourcing_projects for each row execute function private.guard_sourcing_project();

alter table public.licitaciones add column if not exists sourcing_project_id uuid references public.sourcing_projects(id) on delete set null;
create index if not exists licitaciones_project_idx on public.licitaciones (sourcing_project_id);

-- ---------------------------------------------------------------- tareas, hitos y fechas
create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.sourcing_projects(id) on delete cascade,
  parent_id uuid references public.project_tasks(id) on delete cascade,
  template_task_key text,
  stage_key text not null,
  seq integer not null,
  code text,
  title text not null check (length(trim(title)) > 0),
  description text,
  kind text not null default 'task' check (kind in ('task', 'milestone', 'approval')),
  event_key text check (event_key in ('baseline_approved', 'bases_approved', 'rfx_published', 'offers_opened', 'evaluation_closed',
                                      'final_round_opened', 'award_decided', 'contract_approved', 'savings_validated')),
  deliverable_key text,
  role text,
  optional boolean not null default false,
  is_custom boolean not null default false,
  not_applicable boolean not null default false,
  na_reason text,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done', 'blocked')),
  assignee_id uuid references public.profiles(id) on delete set null,
  collaborator_ids uuid[] not null default '{}',
  priority smallint not null default 2 check (priority between 1 and 3),
  depends_on uuid[] not null default '{}',
  original_start date,
  original_end date,
  committed_start date,
  committed_end date,
  actual_start date,
  actual_end date,
  block_cause text check (block_cause in ('comprador', 'aprobador', 'proveedor', 'area_solicitante', 'externo')),
  block_note text,
  change_cause text,
  change_reason text,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (committed_end is null or committed_start is null or committed_end >= committed_start),
  check (not not_applicable or length(trim(coalesce(na_reason, ''))) >= 5),
  check (status <> 'blocked' or (block_cause is not null and length(trim(coalesce(block_note, ''))) >= 3))
);
create index if not exists project_tasks_project_idx on public.project_tasks (project_id, seq);
create index if not exists project_tasks_assignee_idx on public.project_tasks (company_id, assignee_id);

create table if not exists public.project_task_changes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.sourcing_projects(id) on delete cascade,
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  cause text,
  reason text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists project_task_changes_idx on public.project_task_changes (project_id, changed_at desc);

alter table public.project_tasks enable row level security;
select private.secure_company_table('project_tasks', '{}'::text[]);
drop policy if exists project_tasks_update_workers on public.project_tasks;
create policy project_tasks_update_workers on public.project_tasks for update to authenticated
  using (company_id = private.current_company_id() and not (select private.is_read_only_profile())
         and (private.can_manage_project(project_id) or (select auth.uid()) = assignee_id or (select auth.uid()) = any (collaborator_ids)))
  with check (company_id = private.current_company_id());
select private.secure_company_table('project_task_changes', '{}'::text[], null, true);

create or replace function private.guard_project_task()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_manager boolean;
begin
  if tg_op = 'INSERT' then
    if new.company_id is distinct from (select company_id from public.sourcing_projects where id = new.project_id) then
      raise exception 'La tarea debe pertenecer a la empresa del proyecto.';
    end if;
    return new;
  end if;
  if new.project_id is distinct from old.project_id or new.company_id is distinct from old.company_id
     or new.event_key is distinct from old.event_key or new.template_task_key is distinct from old.template_task_key
     or (old.original_start is not null and new.original_start is distinct from old.original_start)
     or (old.original_end is not null and new.original_end is distinct from old.original_end) then
    raise exception 'La fecha original y el evento de un hito no se modifican.';
  end if;
  v_manager := v_uid is null or private.can_manage_project(new.project_id);
  if not v_manager and (new.title is distinct from old.title or new.assignee_id is distinct from old.assignee_id
     or new.committed_start is distinct from old.committed_start or new.committed_end is distinct from old.committed_end
     or new.not_applicable is distinct from old.not_applicable or new.depends_on is distinct from old.depends_on
     or new.stage_key is distinct from old.stage_key) then
    raise exception 'Solo el responsable del proyecto o la gerencia cambian fechas, responsables o el alcance de una tarea.';
  end if;
  if new.assignee_id is distinct from old.assignee_id and not private.is_assignable(new.assignee_id, new.company_id) then
    raise exception 'El responsable debe ser una persona interna de compras de la empresa.';
  end if;
  if new.event_key is not null and new.status = 'done' and old.status <> 'done' then
    raise exception 'Este hito se cumple con el registro real en XPEND (%), no se marca a mano.', new.event_key;
  end if;
  if new.not_applicable and not old.not_applicable and not (old.optional or old.is_custom) then
    raise exception 'Solo una actividad opcional o agregada al proyecto puede marcarse como «No aplica».';
  end if;
  if new.status = 'in_progress' and old.status <> 'in_progress' and new.actual_start is null then new.actual_start := current_date; end if;
  if new.status = 'done' and old.status <> 'done' then
    new.actual_start := coalesce(new.actual_start, current_date);
    new.actual_end := coalesce(new.actual_end, current_date);
    new.completed_by := coalesce(v_uid, new.completed_by);
  end if;
  if new.status <> 'done' and old.status = 'done' then new.actual_end := null; end if;
  if (new.actual_start is distinct from old.actual_start and new.actual_start > current_date)
     or (new.actual_end is distinct from old.actual_end and new.actual_end > current_date)
     or (new.actual_start is not null and new.actual_end is not null and new.actual_end < new.actual_start) then
    raise exception 'Las fechas reales no pueden ser futuras ni terminar antes de comenzar.';
  end if;
  if new.status <> 'blocked' then new.block_cause := null; new.block_note := null; end if;
  if (new.committed_start is distinct from old.committed_start or new.committed_end is distinct from old.committed_end)
     and old.committed_end is not null then
    if new.change_cause is null or length(trim(coalesce(new.change_reason, ''))) < 5 then
      raise exception 'Reprogramar una tarea exige una causa y un motivo de al menos 5 caracteres.';
    end if;
    insert into public.project_task_changes (company_id, project_id, task_id, field, old_value, new_value, cause, reason, changed_by)
    values (new.company_id, new.project_id, new.id, 'committed',
            concat(old.committed_start, ' → ', old.committed_end), concat(new.committed_start, ' → ', new.committed_end),
            new.change_cause, new.change_reason, v_uid);
  end if;
  if new.status is distinct from old.status then
    insert into public.project_task_changes (company_id, project_id, task_id, field, old_value, new_value, cause, reason, changed_by)
    values (new.company_id, new.project_id, new.id, 'status', old.status, new.status, new.block_cause, new.block_note, v_uid);
  end if;
  if new.not_applicable is distinct from old.not_applicable then
    insert into public.project_task_changes (company_id, project_id, task_id, field, old_value, new_value, reason, changed_by)
    values (new.company_id, new.project_id, new.id, 'not_applicable', old.not_applicable::text, new.not_applicable::text, new.na_reason, v_uid);
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    insert into public.project_task_changes (company_id, project_id, task_id, field, old_value, new_value, changed_by)
    values (new.company_id, new.project_id, new.id, 'assignee', old.assignee_id::text, new.assignee_id::text, v_uid);
  end if;
  new.change_cause := null;
  new.change_reason := null;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists guard_project_task on public.project_tasks;
create trigger guard_project_task before insert or update on public.project_tasks for each row execute function private.guard_project_task();
drop trigger if exists forbid_project_task_changes on public.project_task_changes;
create trigger forbid_project_task_changes before update or delete on public.project_task_changes for each row execute function private.forbid_mutation();

-- ---------------------------------------------------------------- entregables, versiones y aprobaciones
create table if not exists public.project_deliverables (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.sourcing_projects(id) on delete cascade,
  deliverable_key text not null,
  title text not null,
  stage_key text not null,
  description text,
  requires_approval boolean not null default false,
  approver_role text,
  document_required boolean not null default true,
  owner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'draft', 'in_review', 'approved', 'rejected', 'not_applicable')),
  due_date date,
  current_version integer not null default 0,
  approved_version integer,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  decision_note text,
  na_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, deliverable_key),
  check (status <> 'approved' or (approved_by is not null and approved_at is not null and (approved_version is not null or not document_required)))
);

create table if not exists public.deliverable_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.sourcing_projects(id) on delete cascade,
  deliverable_id uuid not null references public.project_deliverables(id) on delete cascade,
  version integer not null check (version >= 1),
  storage_path text not null,
  file_name text not null,
  mime text,
  size_bytes bigint,
  note text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  unique (deliverable_id, version)
);

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.sourcing_projects(id) on delete cascade,
  subject_kind text not null check (subject_kind in ('deliverable', 'baseline')),
  subject_id uuid not null,
  subject_version integer,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  approver_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  request_note text,
  decision_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (approver_id <> requested_by),
  check (status = 'pending' or decided_at is not null)
);
create index if not exists approval_requests_approver_idx on public.approval_requests (company_id, approver_id, status);

select private.secure_company_table('project_deliverables', '{}'::text[]);
drop policy if exists project_deliverables_update_managers on public.project_deliverables;
create policy project_deliverables_update_managers on public.project_deliverables for update to authenticated
  using (company_id = private.current_company_id() and private.can_manage_project(project_id))
  with check (company_id = private.current_company_id() and private.can_manage_project(project_id));
select private.secure_company_table('deliverable_versions', '{}'::text[], null, true);
select private.secure_company_table('approval_requests', '{}'::text[]);

-- La solicitud resuelta es la evidencia de la aprobación (quién, cuándo, qué versión y con qué comentario): no se edita ni se borra.
create or replace function private.guard_approval_request()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' or old.status <> 'pending' then
    raise exception 'Una aprobación resuelta es evidencia: no se edita ni se borra.';
  end if;
  if new.subject_id is distinct from old.subject_id or new.subject_version is distinct from old.subject_version
     or new.requested_by is distinct from old.requested_by or new.approver_id is distinct from old.approver_id then
    raise exception 'Una solicitud de aprobación no cambia de objeto ni de personas.';
  end if;
  return new;
end $$;
drop trigger if exists guard_approval_request on public.approval_requests;
create trigger guard_approval_request before update or delete on public.approval_requests for each row execute function private.guard_approval_request();

create or replace function private.guard_deliverable()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.project_id is distinct from old.project_id or new.deliverable_key is distinct from old.deliverable_key
     or new.company_id is distinct from old.company_id then
    raise exception 'Un entregable no cambia de proyecto.';
  end if;
  if coalesce(current_setting('xpend.approval_rpc', true), '') <> 'on' then
    if new.status is distinct from old.status and not (
      (new.status = 'not_applicable' and length(trim(coalesce(new.na_reason, ''))) >= 5 and not old.requires_approval)
      or (old.status = 'not_applicable' and new.status in ('pending', 'draft'))
    ) then
      raise exception 'El estado de un entregable cambia al subir una versión o al resolver su aprobación.';
    end if;
    if new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at
       or new.approved_version is distinct from old.approved_version or new.current_version is distinct from old.current_version then
      raise exception 'La aprobación y la versión de un entregable se registran con sus funciones.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists guard_deliverable on public.project_deliverables;
create trigger guard_deliverable before update on public.project_deliverables for each row execute function private.guard_deliverable();
drop trigger if exists forbid_deliverable_version_change on public.deliverable_versions;
create trigger forbid_deliverable_version_change before update or delete on public.deliverable_versions for each row execute function private.forbid_mutation();

-- ---------------------------------------------------------------- colaboración y actividad
create table if not exists public.work_comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.sourcing_projects(id) on delete cascade,
  task_id uuid references public.project_tasks(id) on delete cascade,
  deliverable_id uuid references public.project_deliverables(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  mentions uuid[] not null default '{}',
  author_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists work_comments_project_idx on public.work_comments (project_id, created_at desc);
select private.secure_company_table('work_comments', array['super_admin', 'admin', 'manager', 'analyst'], null, true);
drop policy if exists work_comments_insert_roles on public.work_comments;
create policy work_comments_insert_roles on public.work_comments for insert to authenticated
  with check (company_id = private.current_company_id() and (select private.is_internal_profile())
              and private."current_role"() in ('super_admin', 'admin', 'manager', 'analyst') and author_id = (select auth.uid()));

create table if not exists public.project_activity (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.sourcing_projects(id) on delete cascade,
  kind text not null,
  summary text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  ref_kind text,
  ref_id uuid,
  data jsonb,
  at timestamptz not null default now()
);
create index if not exists project_activity_idx on public.project_activity (project_id, at desc);
select private.secure_company_table('project_activity', '{}'::text[], null, true);
drop trigger if exists forbid_project_activity_change on public.project_activity;
create trigger forbid_project_activity_change before update or delete on public.project_activity for each row execute function private.forbid_mutation();

create or replace function private.notify(p_user uuid, p_company uuid, p_type text, p_title text, p_message text, p_url text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (company_id, user_id, type, title, message, action_url, read)
  select p_company, p_user, p_type, p_title, p_message, p_url, false
  where p_user is not null and p_user is distinct from (select auth.uid())
$$;
revoke all on function private.notify(uuid, uuid, text, text, text, text) from public, anon, authenticated;

create or replace function private.on_work_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_project public.sourcing_projects;
  v_mention uuid;
  v_author text;
begin
  select * into v_project from public.sourcing_projects where id = new.project_id;
  if v_project.company_id is distinct from new.company_id then raise exception 'El comentario debe pertenecer a la empresa del proyecto.'; end if;
  if new.task_id is not null and not exists (select 1 from public.project_tasks where id = new.task_id and project_id = new.project_id) then
    raise exception 'La tarea comentada no pertenece al proyecto.';
  end if;
  if new.deliverable_id is not null and not exists (select 1 from public.project_deliverables where id = new.deliverable_id and project_id = new.project_id) then
    raise exception 'El entregable comentado no pertenece al proyecto.';
  end if;
  foreach v_mention in array new.mentions loop
    if not exists (select 1 from public.profiles p where p.id = v_mention and p.company_id = new.company_id and p.supplier_id is null and p.role::text <> 'supplier') then
      raise exception 'Solo se puede mencionar a personas internas de la empresa.';
    end if;
  end loop;
  select coalesce(full_name, email) into v_author from public.profiles where id = new.author_id;
  foreach v_mention in array new.mentions loop
    perform private.notify(v_mention, new.company_id, 'info', concat(v_author, ' te mencionó en ', v_project.title), left(new.body, 240),
                           concat('/proyectos/', new.project_id, '?tab=actividad'));
  end loop;
  insert into public.project_activity (company_id, project_id, kind, summary, actor_id, ref_kind, ref_id)
  values (new.company_id, new.project_id, 'comment', left(new.body, 200), new.author_id,
          case when new.task_id is not null then 'task' when new.deliverable_id is not null then 'deliverable' end,
          coalesce(new.task_id, new.deliverable_id));
  return new;
end $$;
drop trigger if exists on_work_comment on public.work_comments;
create trigger on_work_comment before insert on public.work_comments for each row execute function private.on_work_comment();

create or replace function private.log_task_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_summary text;
begin
  if new.status is distinct from old.status then
    v_summary := concat('«', new.title, '» pasó a ', case new.status when 'done' then 'completada' when 'in_progress' then 'en curso' when 'blocked' then 'bloqueada' else 'pendiente' end);
  elsif new.committed_end is distinct from old.committed_end or new.committed_start is distinct from old.committed_start then
    v_summary := concat('«', new.title, '» se reprogramó al ', to_char(new.committed_end, 'DD-MM-YYYY'));
  elsif new.assignee_id is distinct from old.assignee_id then
    v_summary := concat('«', new.title, '» tiene un nuevo responsable');
  elsif new.not_applicable is distinct from old.not_applicable then
    v_summary := concat('«', new.title, '» ', case when new.not_applicable then 'se marcó «No aplica»' else 'vuelve a aplicar' end);
  else
    return null;
  end if;
  insert into public.project_activity (company_id, project_id, kind, summary, actor_id, ref_kind, ref_id)
  values (new.company_id, new.project_id, 'task', v_summary, (select auth.uid()), 'task', new.id);
  return null;
end $$;
drop trigger if exists log_task_activity on public.project_tasks;
create trigger log_task_activity after update on public.project_tasks for each row execute function private.log_task_activity();

-- ---------------------------------------------------------------- contratos: historia y relaciones
alter table public.contracts add column if not exists category_id uuid references public.procurement_categories(id) on delete set null;
alter table public.contracts add column if not exists signed_on date;
alter table public.contracts add column if not exists terminated_on date;
alter table public.contracts add column if not exists end_reason text;
do $$ begin
  alter table public.contracts add constraint contracts_end_reason_check
    check (end_reason is null or end_reason in ('expired', 'terminated_early', 'replaced', 'partially_replaced', 'no_replacement'));
exception when duplicate_object then null; end $$;

create table if not exists public.project_contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.sourcing_projects(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  role text not null check (role in ('affected', 'successor', 'related')),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, contract_id, role)
);
select private.secure_company_table('project_contracts', '{}'::text[]);

create table if not exists public.contract_relations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  from_contract_id uuid not null references public.contracts(id) on delete cascade,
  to_contract_id uuid not null references public.contracts(id) on delete cascade,
  relation text not null check (relation in ('renewal', 'replacement', 'consolidation', 'split', 'partial_replacement', 'complementary')),
  sourcing_project_id uuid references public.sourcing_projects(id) on delete set null,
  scope_note text,
  share_pct numeric check (share_pct is null or (share_pct > 0 and share_pct <= 100)),
  effective_on date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (from_contract_id, to_contract_id),
  check (from_contract_id <> to_contract_id)
);
select private.secure_company_table('contract_relations', '{}'::text[]);

-- ---------------------------------------------------------------- línea base económica
create table if not exists public.economic_baselines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.sourcing_projects(id) on delete cascade,
  title text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  method text not null default 'price_comparison' check (method in ('price_comparison', 'total_cost', 'cost_avoidance', 'benchmark')),
  period_months integer not null default 12 check (period_months between 1 and 120),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'superseded')),
  version integer not null default 1,
  scope_note text,
  conditions_note text,
  deliverable_id uuid references public.project_deliverables(id) on delete set null,
  prepared_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'approved' or (approved_by is not null and approved_at is not null and approved_by is distinct from prepared_by))
);

create table if not exists public.baseline_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  baseline_id uuid not null references public.economic_baselines(id) on delete cascade,
  seq integer not null default 1,
  item text not null check (length(trim(item)) > 0),
  unit text,
  specification text,
  reference_price numeric not null check (reference_price >= 0),
  adjustment_pct numeric not null default 0 check (adjustment_pct between -100 and 100),
  projected_qty numeric not null check (projected_qty >= 0),
  awarded_price numeric check (awarded_price is null or awarded_price >= 0),
  supplier_name text,
  notes text
);
create index if not exists baseline_lines_idx on public.baseline_lines (baseline_id, seq);

select private.secure_company_table('economic_baselines', '{}'::text[]);
drop policy if exists economic_baselines_update_managers on public.economic_baselines;
create policy economic_baselines_update_managers on public.economic_baselines for update to authenticated
  using (company_id = private.current_company_id() and private.can_manage_project(project_id))
  with check (company_id = private.current_company_id() and private.can_manage_project(project_id));
select private.secure_company_table('baseline_lines', '{}'::text[]);
drop policy if exists baseline_lines_write_managers on public.baseline_lines;
create policy baseline_lines_write_managers on public.baseline_lines for all to authenticated
  using (company_id = private.current_company_id() and exists (select 1 from public.economic_baselines b where b.id = baseline_id and private.can_manage_project(b.project_id)))
  with check (company_id = private.current_company_id() and exists (select 1 from public.economic_baselines b where b.id = baseline_id and private.can_manage_project(b.project_id)));

create or replace function private.guard_baseline()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'baseline_lines' then
    -- Con la línea base enviada o aprobada, la referencia queda fija; solo se registra el resultado adjudicado.
    if exists (select 1 from public.economic_baselines b where b.id = coalesce(new.baseline_id, old.baseline_id) and b.status <> 'draft')
       and not (tg_op = 'UPDATE' and new.baseline_id = old.baseline_id and new.item = old.item and new.unit is not distinct from old.unit
                and new.specification is not distinct from old.specification and new.reference_price = old.reference_price
                and new.adjustment_pct = old.adjustment_pct and new.projected_qty = old.projected_qty and new.seq = old.seq) then
      raise exception 'La referencia de una línea base enviada o aprobada no cambia: para cambiarla se crea una nueva versión.';
    end if;
    if tg_op = 'DELETE' then return old; end if;
    if new.company_id is distinct from (select company_id from public.economic_baselines where id = new.baseline_id) then
      raise exception 'La línea debe pertenecer a la empresa de la línea base.';
    end if;
    return new;
  end if;
  if coalesce(current_setting('xpend.approval_rpc', true), '') <> 'on' then
    if new.status is distinct from old.status or new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at then
      raise exception 'La línea base se envía y aprueba con el circuito de aprobación.';
    end if;
    if old.status <> 'draft' and (new.currency is distinct from old.currency or new.method is distinct from old.method or new.period_months is distinct from old.period_months) then
      raise exception 'Una línea base enviada o aprobada no se modifica.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists guard_baseline on public.economic_baselines;
create trigger guard_baseline before update on public.economic_baselines for each row execute function private.guard_baseline();
drop trigger if exists guard_baseline_lines on public.baseline_lines;
create trigger guard_baseline_lines before insert or update or delete on public.baseline_lines for each row execute function private.guard_baseline();

-- Ahorro anualizado = Σ [(precio de referencia ajustado − precio adjudicado) × cantidad proyectada], solo líneas con precio adjudicado.
create or replace view public.baseline_savings with (security_invoker = true) as
select b.id as baseline_id, b.company_id, b.project_id, b.currency, b.method, b.status,
       sum(l.reference_price * (1 + l.adjustment_pct / 100) * l.projected_qty) as reference_total,
       sum(case when l.awarded_price is not null then l.awarded_price * l.projected_qty end) as awarded_total,
       sum(case when l.awarded_price is not null then (l.reference_price * (1 + l.adjustment_pct / 100) - l.awarded_price) * l.projected_qty end) as annualized_savings,
       count(l.id) as lines, count(l.awarded_price) as priced_lines
from public.economic_baselines b left join public.baseline_lines l on l.baseline_id = b.id
group by b.id;
grant select on public.baseline_savings to authenticated;

alter table public.savings_validations add column if not exists baseline_id uuid references public.economic_baselines(id) on delete restrict;

create or replace function private.guard_savings_baseline()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'validated' and old.status is distinct from 'validated' then
    if new.baseline_id is not null and not exists (select 1 from public.economic_baselines b where b.id = new.baseline_id and b.status = 'approved') then
      raise exception 'Falta aprobar la línea base antes de validar el ahorro.';
    end if;
    if new.baseline_id is null and exists (
      select 1 from public.sourcing_projects p
      where p.sourcing_plan_id = new.sourcing_plan_id and p.status <> 'cancelled'
        and coalesce((p.methodology_snapshot->'rules'->>'baselineRequired')::boolean, false)
    ) then
      raise exception 'La metodología del proyecto exige una línea base aprobada para validar este ahorro.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_savings_baseline on public.savings_validations;
create trigger guard_savings_baseline before update on public.savings_validations for each row execute function private.guard_savings_baseline();

-- ---------------------------------------------------------------- recorridos guiados (solo empresas demo)
create table if not exists public.demo_tours (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tour_key text not null check (tour_key ~ '^[a-z0-9_-]{2,40}$'),
  name text not null,
  description text,
  audience text not null default 'internal' check (audience in ('internal', 'supplier')),
  enabled boolean not null default true,
  steps jsonb not null default '[]'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (company_id, tour_key)
);
alter table public.demo_tours enable row level security;
drop policy if exists demo_tours_select on public.demo_tours;
create policy demo_tours_select on public.demo_tours for select to authenticated
  using (company_id = private.current_company_id()
         and ((select private.is_internal_profile()) or (audience = 'supplier' and private.current_supplier_id() is not null)));
drop policy if exists demo_tours_write on public.demo_tours;
create policy demo_tours_write on public.demo_tours for update to authenticated
  using (company_id = private.current_company_id() and private."current_role"() in ('super_admin', 'admin'))
  with check (company_id = private.current_company_id() and private."current_role"() in ('super_admin', 'admin'));
revoke insert, delete, truncate on public.demo_tours from authenticated, anon;

create or replace function private.guard_demo_tour()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.companies c where c.id = new.company_id and (c.settings->>'demo')::boolean is true) then
    raise exception 'Los recorridos guiados solo existen en empresas de demostración.';
  end if;
  if tg_op = 'UPDATE' and new.company_id is distinct from old.company_id then raise exception 'Un recorrido no cambia de empresa.'; end if;
  new.updated_at := now();
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end $$;
drop trigger if exists guard_demo_tour on public.demo_tours;
create trigger guard_demo_tour before insert or update on public.demo_tours for each row execute function private.guard_demo_tour();

-- ---------------------------------------------------------------- funciones de negocio
create or replace function private.resolve_methodology(p_company uuid, p_category uuid)
returns public.methodology_templates language plpgsql stable security definer set search_path = '' as $$
declare
  v_assignment public.methodology_assignments;
  v_parent uuid;
  v_template public.methodology_templates;
begin
  select parent_id into v_parent from public.procurement_categories where id = p_category;
  select * into v_assignment from public.methodology_assignments a
  where a.company_id = p_company and a.category_id = any (array[p_category, v_parent])
  order by (a.category_id = p_category) desc limit 1;
  if v_assignment.id is null then
    select * into v_assignment from public.methodology_assignments a where a.company_id = p_company and a.category_id is null;
  end if;
  select * into v_template from public.methodology_templates t
  where t.status = 'published'
    and t.template_key = coalesce(v_assignment.template_key, 'light')
    and t.company_id is not distinct from (case when v_assignment.id is null then null else v_assignment.template_company_id end)
  order by t.version desc limit 1;
  return v_template;
end $$;
revoke all on function private.resolve_methodology(uuid, uuid) from public, anon;
grant execute on function private.resolve_methodology(uuid, uuid) to authenticated;

create or replace function public.create_sourcing_project(
  p_initiative uuid, p_title text default null, p_template uuid default null, p_owner uuid default null,
  p_start date default null, p_priority smallint default 2, p_description text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid := private.current_company_id();
  v_role text := private."current_role"();
  v_uid uuid := (select auth.uid());
  v_plan public.sourcing_plans;
  v_tpl public.methodology_templates;
  v_project uuid;
  v_def jsonb;
  v_task jsonb;
  v_deliv jsonb;
  v_ends jsonb := '{}'::jsonb;
  v_ids jsonb := '{}'::jsonb;
  v_start date;
  v_begin date;
  v_end date;
  v_after date;
  v_dep text;
  v_owner uuid;
  v_seq integer := 0;
  v_id uuid;
  v_sub text;
  v_sub_seq integer;
  v_assignee uuid;
begin
  if v_company is null or not private.is_internal_profile() then raise exception 'No hay una empresa activa para tu usuario.'; end if;
  select * into v_plan from public.sourcing_plans where id = p_initiative and company_id = v_company;
  if v_plan.id is null then raise exception 'La iniciativa no existe en tu empresa.'; end if;
  if not (v_role in ('super_admin', 'admin', 'manager') or (v_role = 'analyst' and v_uid in (v_plan.responsible_user_id, v_plan.backup_user_id))) then
    raise exception 'Solo la gerencia o el responsable de la iniciativa crean un proyecto de sourcing.';
  end if;
  if p_template is not null then
    select * into v_tpl from public.methodology_templates where id = p_template and status = 'published' and (company_id is null or company_id = v_company);
  else
    v_tpl := private.resolve_methodology(v_company, v_plan.category_id);
  end if;
  if v_tpl.id is null then raise exception 'No hay una metodología publicada disponible para este proyecto.'; end if;
  v_owner := coalesce(p_owner, v_plan.responsible_user_id,
                      (select a.manager_user_id from public.category_assignments a where a.category_id = v_plan.category_id), v_uid);
  if not private.is_assignable(v_owner, v_company) then raise exception 'El responsable debe ser una persona interna de compras.'; end if;
  v_start := coalesce(p_start, current_date);
  v_def := v_tpl.definition;
  insert into public.sourcing_projects (company_id, sourcing_plan_id, category_id, title, description, owner_id, backup_id, priority, status,
                                        template_id, template_key, template_version, methodology_kind, methodology_snapshot, start_date, created_by)
  values (v_company, v_plan.id, v_plan.category_id, coalesce(nullif(trim(p_title), ''), v_plan.title), p_description, v_owner,
          v_plan.backup_user_id, coalesce(p_priority, 2), 'active', v_tpl.id, v_tpl.template_key, v_tpl.version, v_tpl.kind, v_def, v_start, v_uid)
  returning id into v_project;

  for v_deliv in select value from jsonb_array_elements(coalesce(v_def->'deliverables', '[]'::jsonb)) loop
    insert into public.project_deliverables (company_id, project_id, deliverable_key, title, stage_key, description, requires_approval,
                                             approver_role, document_required, owner_id)
    values (v_company, v_project, v_deliv->>'key', v_deliv->>'title', v_deliv->>'stage', v_deliv->>'description',
            coalesce((v_deliv->>'approval')::boolean, false), v_deliv->>'approverRole',
            coalesce((v_deliv->>'documentRequired')::boolean, true), v_owner);
  end loop;

  for v_task in select value from jsonb_array_elements(coalesce(v_def->'tasks', '[]'::jsonb)) loop
    v_seq := v_seq + 1;
    v_after := null;
    for v_dep in select jsonb_array_elements_text(coalesce(v_task->'depends', '[]'::jsonb)) loop
      if v_ends ? v_dep and (v_after is null or (v_ends->>v_dep)::date > v_after) then v_after := (v_ends->>v_dep)::date; end if;
    end loop;
    v_begin := case when v_after is null then v_start else v_after + 1 end;
    v_end := v_begin + greatest(0, coalesce((v_task->>'duration')::integer, 1) - 1);
    v_ends := v_ends || jsonb_build_object(v_task->>'key', v_end::text);
    v_assignee := case when v_task->>'role' in ('category_manager', 'buyer') then v_owner end;
    insert into public.project_tasks (company_id, project_id, template_task_key, stage_key, seq, code, title, kind, event_key, deliverable_key,
                                      role, optional, assignee_id, depends_on, original_start, original_end, committed_start, committed_end)
    values (v_company, v_project, v_task->>'key', v_task->>'stage', v_seq * 10, v_task->>'code', v_task->>'title',
            coalesce(v_task->>'kind', 'task'), v_task->>'event', v_task->>'deliverable', v_task->>'role',
            coalesce((v_task->>'optional')::boolean, false), v_assignee,
            coalesce((select array_agg((v_ids->>d)::uuid) from jsonb_array_elements_text(coalesce(v_task->'depends', '[]'::jsonb)) d where v_ids ? d), '{}'),
            v_begin, v_end, v_begin, v_end)
    returning id into v_id;
    v_ids := v_ids || jsonb_build_object(v_task->>'key', v_id::text);
    v_sub_seq := 0;
    for v_sub in select jsonb_array_elements_text(coalesce(v_task->'subtasks', '[]'::jsonb)) loop
      v_sub_seq := v_sub_seq + 1;
      insert into public.project_tasks (company_id, project_id, parent_id, stage_key, seq, code, title, kind, role, assignee_id,
                                        original_start, original_end, committed_start, committed_end)
      values (v_company, v_project, v_id, v_task->>'stage', v_seq * 10 + v_sub_seq, concat(v_task->>'code', '.', v_sub_seq), v_sub, 'task',
              v_task->>'role', v_assignee, v_begin, v_end, v_begin, v_end);
    end loop;
  end loop;

  update public.project_deliverables d set due_date = t.committed_end
  from public.project_tasks t where t.project_id = v_project and d.project_id = v_project and t.deliverable_key = d.deliverable_key and t.parent_id is null;
  update public.sourcing_projects set target_end_date = (select max(committed_end) from public.project_tasks where project_id = v_project) where id = v_project;
  insert into public.project_activity (company_id, project_id, kind, summary, actor_id, data)
  values (v_company, v_project, 'project_created', concat('Proyecto creado con la metodología ', v_tpl.name, ' v', v_tpl.version), v_uid,
          jsonb_build_object('template_id', v_tpl.id, 'version', v_tpl.version));
  return v_project;
end $$;

create or replace function public.reschedule_task(
  p_task uuid, p_start date, p_end date, p_cause text, p_reason text, p_shift_dependents boolean default true
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_task public.project_tasks;
  v_changed uuid[] := array[p_task];
  v_count integer := 1;
  v_next record;
  v_pred_end date;
  v_len integer;
begin
  select * into v_task from public.project_tasks where id = p_task and company_id = private.current_company_id();
  if v_task.id is null or not private.can_manage_project(v_task.project_id) then raise exception 'No puedes reprogramar esta tarea.'; end if;
  if p_cause not in ('comprador', 'aprobador', 'proveedor', 'area_solicitante', 'externo') then raise exception 'Indica la causa de la reprogramación.'; end if;
  update public.project_tasks set committed_start = p_start, committed_end = p_end, change_cause = p_cause, change_reason = p_reason where id = p_task;
  if p_shift_dependents then
    loop
      select t.* into v_next from public.project_tasks t
      where t.project_id = v_task.project_id and t.parent_id is null and t.depends_on && v_changed and not (t.id = any (v_changed))
        and t.status <> 'done' and not t.not_applicable
      order by t.seq limit 1;
      exit when v_next.id is null;
      select max(p.committed_end) into v_pred_end from public.project_tasks p where p.id = any (v_next.depends_on) and not p.not_applicable;
      v_changed := v_changed || v_next.id;
      if v_pred_end is not null and v_next.committed_start <= v_pred_end then
        v_len := v_next.committed_end - v_next.committed_start;
        update public.project_tasks set committed_start = v_pred_end + 1, committed_end = v_pred_end + 1 + v_len,
          change_cause = 'arrastre', change_reason = concat('Arrastre por la reprogramación de «', v_task.title, '»')
        where id = v_next.id;
        update public.project_tasks set committed_start = v_pred_end + 1, committed_end = v_pred_end + 1 + v_len,
          change_cause = 'arrastre', change_reason = concat('Arrastre por la reprogramación de «', v_task.title, '»')
        where parent_id = v_next.id;
        v_count := v_count + 1;
      end if;
    end loop;
  end if;
  return v_count;
end $$;

create or replace function public.set_task_not_applicable(p_task uuid, p_value boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_task public.project_tasks;
begin
  select * into v_task from public.project_tasks where id = p_task and company_id = private.current_company_id();
  if v_task.id is null or not private.can_manage_project(v_task.project_id) then raise exception 'No puedes cambiar el alcance de esta tarea.'; end if;
  update public.project_tasks set not_applicable = p_value, na_reason = case when p_value then p_reason else na_reason end where id = p_task;
end $$;

create or replace function public.add_project_task(
  p_project uuid, p_stage_key text, p_title text, p_parent uuid default null, p_start date default null, p_end date default null,
  p_assignee uuid default null, p_kind text default 'task', p_depends uuid[] default '{}'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_project public.sourcing_projects;
  v_seq integer;
  v_id uuid;
  v_start date;
  v_end date;
begin
  select * into v_project from public.sourcing_projects where id = p_project and company_id = private.current_company_id();
  if v_project.id is null or not private.can_manage_project(p_project) then raise exception 'No puedes agregar tareas a este proyecto.'; end if;
  if not exists (select 1 from jsonb_array_elements(v_project.methodology_snapshot->'stages') s where s->>'key' = p_stage_key) then
    raise exception 'La etapa indicada no existe en la metodología del proyecto.';
  end if;
  if p_parent is not null and not exists (select 1 from public.project_tasks where id = p_parent and project_id = p_project) then
    raise exception 'La tarea padre no pertenece al proyecto.';
  end if;
  if p_kind not in ('task', 'milestone', 'approval') then raise exception 'Tipo de tarea no válido.'; end if;
  v_start := coalesce(p_start, current_date);
  v_end := coalesce(p_end, v_start);
  if p_parent is not null then
    select seq * 1 + coalesce((select count(*) from public.project_tasks c where c.parent_id = p_parent), 0)::integer + 1 into v_seq from public.project_tasks where id = p_parent;
  else
    select coalesce(max(seq), 0) + 10 into v_seq from public.project_tasks where project_id = p_project and stage_key = p_stage_key and parent_id is null;
    if exists (select 1 from public.project_tasks where project_id = p_project and seq = v_seq) then
      select coalesce(max(seq), 0) + 10 into v_seq from public.project_tasks where project_id = p_project;
    end if;
  end if;
  insert into public.project_tasks (company_id, project_id, parent_id, stage_key, seq, code, title, kind, is_custom, assignee_id, depends_on,
                                    original_start, original_end, committed_start, committed_end)
  values (v_project.company_id, p_project, p_parent, p_stage_key, v_seq, null, p_title, p_kind, true, p_assignee, coalesce(p_depends, '{}'),
          v_start, v_end, v_start, v_end)
  returning id into v_id;
  insert into public.project_activity (company_id, project_id, kind, summary, actor_id, ref_kind, ref_id)
  values (v_project.company_id, p_project, 'task_added', concat('Se agregó la tarea «', p_title, '» al proyecto'), (select auth.uid()), 'task', v_id);
  return v_id;
end $$;

create or replace function public.link_rfx_to_project(p_project uuid, p_licitacion text, p_link boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare v_title text;
begin
  if not private.can_manage_project(p_project) then raise exception 'No puedes vincular procesos a este proyecto.'; end if;
  update public.licitaciones set sourcing_project_id = case when p_link then p_project end
  where id = p_licitacion and company_id = private.current_company_id()
  returning name into v_title;
  if v_title is null then raise exception 'El proceso no existe en tu empresa.'; end if;
  insert into public.project_activity (company_id, project_id, kind, summary, actor_id, data)
  values (private.current_company_id(), p_project, 'rfx_linked',
          concat(case when p_link then 'Se vinculó el proceso «' else 'Se desvinculó el proceso «' end, v_title, '»'), (select auth.uid()),
          jsonb_build_object('licitacion_id', p_licitacion));
end $$;

create or replace function public.link_project_contract(p_project uuid, p_contract uuid, p_role text, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_name text;
begin
  if not private.can_manage_project(p_project) then raise exception 'No puedes vincular contratos a este proyecto.'; end if;
  select name into v_name from public.contracts where id = p_contract and company_id = private.current_company_id();
  if v_name is null then raise exception 'El contrato no existe en tu empresa.'; end if;
  insert into public.project_contracts (company_id, project_id, contract_id, role, note, created_by)
  values (private.current_company_id(), p_project, p_contract, p_role, p_note, (select auth.uid()))
  on conflict (project_id, contract_id, role) do update set note = excluded.note
  returning id into v_id;
  insert into public.project_activity (company_id, project_id, kind, summary, actor_id, data)
  values (private.current_company_id(), p_project, 'contract_linked',
          concat(case p_role when 'affected' then 'Contrato anterior vinculado: «' when 'successor' then 'Contrato sucesor vinculado: «' else 'Contrato relacionado: «' end, v_name, '»'),
          (select auth.uid()), jsonb_build_object('contract_id', p_contract, 'role', p_role));
  return v_id;
end $$;

create or replace function public.relate_contracts(
  p_from uuid, p_to uuid, p_relation text, p_project uuid default null, p_scope text default null, p_share numeric default null, p_effective date default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_company uuid := private.current_company_id();
begin
  if private."current_role"() not in ('super_admin', 'admin', 'manager') and (p_project is null or not private.can_manage_project(p_project)) then
    raise exception 'Solo la gerencia o el responsable del proyecto registran la transición entre contratos.';
  end if;
  if (select count(*) from public.contracts where id in (p_from, p_to) and company_id = v_company) <> 2 then
    raise exception 'Ambos contratos deben pertenecer a tu empresa.';
  end if;
  insert into public.contract_relations (company_id, from_contract_id, to_contract_id, relation, sourcing_project_id, scope_note, share_pct, effective_on, created_by)
  values (v_company, p_from, p_to, p_relation, p_project, p_scope, p_share, p_effective, (select auth.uid()))
  on conflict (from_contract_id, to_contract_id) do update set relation = excluded.relation, scope_note = excluded.scope_note,
    share_pct = excluded.share_pct, effective_on = excluded.effective_on, sourcing_project_id = excluded.sourcing_project_id
  returning id into v_id;
  if p_project is not null then
    insert into public.project_activity (company_id, project_id, kind, summary, actor_id, data)
    values (v_company, p_project, 'contract_relation', 'Se registró la transición entre contratos', (select auth.uid()),
            jsonb_build_object('from', p_from, 'to', p_to, 'relation', p_relation));
  end if;
  return v_id;
end $$;

create or replace function public.add_deliverable_version(
  p_deliverable uuid, p_path text, p_file_name text, p_mime text default null, p_size bigint default null, p_note text default null
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_deliv public.project_deliverables;
  v_version integer;
  v_uid uuid := (select auth.uid());
begin
  select * into v_deliv from public.project_deliverables where id = p_deliverable and company_id = private.current_company_id();
  if v_deliv.id is null then raise exception 'El entregable no existe en tu empresa.'; end if;
  if not (private.can_manage_project(v_deliv.project_id) or exists (
    select 1 from public.project_tasks t where t.project_id = v_deliv.project_id and t.deliverable_key = v_deliv.deliverable_key
      and v_uid in (t.assignee_id) and not (select private.is_read_only_profile()))) then
    raise exception 'No puedes subir versiones de este entregable.';
  end if;
  if v_deliv.status in ('in_review', 'approved') then raise exception 'El entregable está en revisión o aprobado: no se reemplaza su versión.'; end if;
  if p_path not like concat(v_deliv.company_id, '/proyectos/', v_deliv.project_id, '/%') then raise exception 'La ruta del documento no corresponde al proyecto.'; end if;
  v_version := v_deliv.current_version + 1;
  insert into public.deliverable_versions (company_id, project_id, deliverable_id, version, storage_path, file_name, mime, size_bytes, note, uploaded_by)
  values (v_deliv.company_id, v_deliv.project_id, v_deliv.id, v_version, p_path, p_file_name, p_mime, p_size, p_note, v_uid);
  perform set_config('xpend.approval_rpc', 'on', true);
  update public.project_deliverables set current_version = v_version, status = 'draft' where id = v_deliv.id;
  perform set_config('xpend.approval_rpc', '', true);
  insert into public.project_activity (company_id, project_id, kind, summary, actor_id, ref_kind, ref_id)
  values (v_deliv.company_id, v_deliv.project_id, 'deliverable_version', concat('Nueva versión v', v_version, ' de «', v_deliv.title, '»'), v_uid, 'deliverable', v_deliv.id);
  return v_version;
end $$;

create or replace function public.create_baseline(p_project uuid, p_title text, p_currency text, p_method text default 'price_comparison',
                                                  p_period_months integer default 12, p_scope text default null, p_conditions text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_version integer;
begin
  if not private.can_manage_project(p_project) then raise exception 'No puedes preparar la línea base de este proyecto.'; end if;
  select coalesce(max(version), 0) + 1 into v_version from public.economic_baselines where project_id = p_project and currency = upper(p_currency);
  perform set_config('xpend.approval_rpc', 'on', true);
  update public.economic_baselines set status = 'superseded' where project_id = p_project and currency = upper(p_currency) and status in ('draft', 'in_review');
  perform set_config('xpend.approval_rpc', '', true);
  insert into public.economic_baselines (company_id, project_id, title, currency, method, period_months, version, scope_note, conditions_note, prepared_by,
                                         deliverable_id)
  values (private.current_company_id(), p_project, p_title, upper(p_currency), p_method, p_period_months, v_version, p_scope, p_conditions, (select auth.uid()),
          (select d.id from public.project_deliverables d where d.project_id = p_project and d.deliverable_key in ('pliego', 'referencia') order by d.deliverable_key limit 1))
  returning id into v_id;
  insert into public.project_activity (company_id, project_id, kind, summary, actor_id, ref_kind, ref_id)
  values (private.current_company_id(), p_project, 'baseline', concat('Línea base en preparación: ', p_title, ' (', upper(p_currency), ' v', v_version, ')'),
          (select auth.uid()), 'baseline', v_id);
  return v_id;
end $$;

create or replace function public.request_approval(p_kind text, p_subject uuid, p_approver uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid := private.current_company_id();
  v_uid uuid := (select auth.uid());
  v_project uuid;
  v_title text;
  v_version integer;
  v_id uuid;
begin
  if p_kind = 'deliverable' then
    select d.project_id, d.title, d.current_version into v_project, v_title, v_version from public.project_deliverables d
    where d.id = p_subject and d.company_id = v_company and d.requires_approval and d.status in ('draft', 'rejected', 'pending');
    if v_project is null then raise exception 'El entregable no requiere aprobación o no está listo para enviarse.'; end if;
    if v_version = 0 and exists (select 1 from public.project_deliverables where id = p_subject and document_required) then
      raise exception 'Sube el documento antes de pedir la aprobación.';
    end if;
  elsif p_kind = 'baseline' then
    select b.project_id, b.title, b.version into v_project, v_title, v_version from public.economic_baselines b
    where b.id = p_subject and b.company_id = v_company and b.status = 'draft';
    if v_project is null then raise exception 'La línea base no está en borrador.'; end if;
    if not exists (select 1 from public.baseline_lines where baseline_id = p_subject) then raise exception 'La línea base no tiene líneas.'; end if;
  else
    raise exception 'Tipo de aprobación no válido.';
  end if;
  if not private.can_manage_project(v_project) then raise exception 'Solo el responsable del proyecto o la gerencia piden esta aprobación.'; end if;
  if p_approver = v_uid then raise exception 'La aprobación la resuelve otra persona.'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_approver and p.company_id = v_company and p.supplier_id is null
                 and p.role::text in ('super_admin', 'admin', 'manager')) then
    raise exception 'Quien aprueba debe tener rol de gerencia o administración en la empresa.';
  end if;
  update public.approval_requests set status = 'cancelled', decided_at = now(), decision_note = 'Reemplazada por una nueva solicitud'
  where subject_id = p_subject and status = 'pending';
  insert into public.approval_requests (company_id, project_id, subject_kind, subject_id, subject_version, requested_by, approver_id, request_note)
  values (v_company, v_project, p_kind, p_subject, v_version, v_uid, p_approver, p_note) returning id into v_id;
  perform set_config('xpend.approval_rpc', 'on', true);
  if p_kind = 'deliverable' then update public.project_deliverables set status = 'in_review' where id = p_subject;
  else update public.economic_baselines set status = 'in_review' where id = p_subject; end if;
  perform set_config('xpend.approval_rpc', '', true);
  perform private.notify(p_approver, v_company, 'warning', concat('Aprobación pendiente: ', v_title), coalesce(p_note, 'Revisa y resuelve la aprobación.'),
                         concat('/proyectos/', v_project, '?tab=entregables'));
  insert into public.project_activity (company_id, project_id, kind, summary, actor_id, ref_kind, ref_id)
  values (v_company, v_project, 'approval_requested', concat('Se pidió aprobar «', v_title, '»'), v_uid, p_kind, p_subject);
  return v_id;
end $$;

create or replace function public.decide_approval(p_request uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_req public.approval_requests;
  v_uid uuid := (select auth.uid());
  v_title text;
  v_uploader uuid;
  v_preparer uuid;
begin
  select * into v_req from public.approval_requests where id = p_request and company_id = private.current_company_id() for update;
  if v_req.id is null or v_req.status <> 'pending' then raise exception 'La solicitud no está pendiente.'; end if;
  if v_req.approver_id <> v_uid then raise exception 'Solo la persona designada resuelve esta aprobación.'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'La decisión debe ser aprobar o rechazar.'; end if;
  if p_decision = 'rejected' and length(trim(coalesce(p_note, ''))) < 5 then raise exception 'Un rechazo exige un comentario.'; end if;
  if v_req.subject_kind = 'deliverable' then
    select d.title, v.uploaded_by into v_title, v_uploader from public.project_deliverables d
    left join public.deliverable_versions v on v.deliverable_id = d.id and v.version = v_req.subject_version where d.id = v_req.subject_id;
    if v_uploader = v_uid then raise exception 'Quien preparó el documento no puede aprobarlo.'; end if;
  else
    select b.title, b.prepared_by into v_title, v_preparer from public.economic_baselines b where b.id = v_req.subject_id;
    if v_preparer = v_uid then raise exception 'Quien preparó la línea base no puede aprobarla.'; end if;
  end if;
  update public.approval_requests set status = p_decision, decision_note = p_note, decided_at = now() where id = p_request;
  perform set_config('xpend.approval_rpc', 'on', true);
  if v_req.subject_kind = 'deliverable' then
    update public.project_deliverables set status = p_decision, decision_note = p_note,
      approved_by = case when p_decision = 'approved' then v_uid end, approved_at = case when p_decision = 'approved' then now() end,
      approved_version = case when p_decision = 'approved' then nullif(v_req.subject_version, 0) end
    where id = v_req.subject_id;
  else
    update public.economic_baselines set status = case when p_decision = 'approved' then 'approved' else 'draft' end,
      approved_by = case when p_decision = 'approved' then v_uid end, approved_at = case when p_decision = 'approved' then now() end
    where id = v_req.subject_id;
  end if;
  perform set_config('xpend.approval_rpc', '', true);
  perform private.notify(v_req.requested_by, v_req.company_id, case when p_decision = 'approved' then 'success' else 'warning' end,
                         concat(case when p_decision = 'approved' then 'Aprobado: ' else 'Rechazado: ' end, v_title), coalesce(p_note, ''),
                         concat('/proyectos/', v_req.project_id, '?tab=entregables'));
  insert into public.project_activity (company_id, project_id, kind, summary, actor_id, ref_kind, ref_id)
  values (v_req.company_id, v_req.project_id, 'approval_decided',
          concat(case when p_decision = 'approved' then 'Se aprobó «' else 'Se rechazó «' end, v_title, '»'), v_uid, v_req.subject_kind, v_req.subject_id);
end $$;

-- Hechos del proyecto: la fuente de verdad de los hitos automáticos. Para cada evento devuelve cuántos procesos formales
-- (RFQ/RFP) lo cumplen y cuándo. Una RFI no cuenta como proceso formal de adjudicación.
create or replace function public.project_facts(p_project uuid)
returns table (event_key text, occurred_at timestamptz, done_count integer, total_count integer)
language sql stable security invoker set search_path = '' as $$
  with formal as (
    select l.id, l.status::text as status, coalesce(l.publish_approved_at, l.publication_date::timestamptz) as published_at
    from public.licitaciones l where l.sourcing_project_id = p_project and l.type::text <> 'RFI'
  ),
  per as (
    select f.id,
      case when f.status in ('published', 'evaluation', 'awarded', 'contract_signed') then coalesce(f.published_at, now()) end as rfx_published,
      (select min(e.offers_opened_at) from public.offer_events e where e.licitacion_id = f.id) as offers_opened,
      (select max(v.closed_at) from public.evaluations v where v.licitacion_id = f.id and v.closed_at is not null) as evaluation_closed,
      (select min(r.opens_at) from public.offer_rounds r join public.offer_events e on e.id = r.event_id
        where e.licitacion_id = f.id and r.round_number >= 2 and r.status in ('open', 'closed')) as final_round_opened,
      (select max(a.closed_at) from public.award_decisions a where a.licitacion_id = f.id and a.outcome = 'approved' and a.closed_at is not null) as award_decided,
      (select min(coalesce(cv.approved_at, c.signed_on::timestamptz, c.updated_at)) from public.contracts c
        left join public.contract_versions cv on cv.contract_id = c.id and cv.approved_at is not null
        where c.licitacion_id = f.id and (cv.approved_at is not null or c.status = 'active')) as contract_approved,
      (select min(s.validated_at) from public.savings_validations s where s.licitacion_id = f.id and s.status = 'validated') as savings_validated
    from formal f
  )
  select 'rfx_published', max(rfx_published), count(rfx_published)::integer, count(*)::integer from per
  union all select 'offers_opened', max(offers_opened), count(offers_opened)::integer, count(*)::integer from per
  union all select 'evaluation_closed', max(evaluation_closed), count(evaluation_closed)::integer, count(*)::integer from per
  union all select 'final_round_opened', max(final_round_opened), count(final_round_opened)::integer, count(*)::integer from per
  union all select 'award_decided', max(award_decided), count(award_decided)::integer, count(*)::integer from per
  union all select 'contract_approved', max(contract_approved), count(contract_approved)::integer, count(*)::integer from per
  union all select 'savings_validated', max(savings_validated), count(savings_validated)::integer, count(*)::integer from per
  union all select 'baseline_approved', max(b.approved_at), (count(*) filter (where b.status = 'approved') > 0)::integer, 1
    from public.economic_baselines b where b.project_id = p_project and b.status in ('approved', 'in_review', 'draft')
  union all select 'bases_approved', max(d.approved_at), (count(*) filter (where d.status = 'approved'))::integer, 1
    from public.project_deliverables d where d.project_id = p_project and d.deliverable_key in ('pliego', 'bases')
$$;

-- ---------------------------------------------------------------- administración de metodologías
create or replace function private.validate_methodology(p_definition jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare
  v_task jsonb;
  v_seen text[] := '{}';
  v_events text[] := '{}';
  v_dep text;
  v_stages text[];
  v_required text[] := array['rfx_published', 'offers_opened', 'evaluation_closed', 'award_decided'];
  v_event text;
begin
  select coalesce(array_agg(s->>'key'), '{}') into v_stages from jsonb_array_elements(coalesce(p_definition->'stages', '[]'::jsonb)) s;
  if cardinality(v_stages) = 0 then raise exception 'La metodología necesita al menos una etapa.'; end if;
  for v_task in select value from jsonb_array_elements(coalesce(p_definition->'tasks', '[]'::jsonb)) loop
    if length(trim(coalesce(v_task->>'title', ''))) = 0 then raise exception 'Hay una tarea sin nombre.'; end if;
    if not (v_task->>'stage' = any (v_stages)) then raise exception 'La tarea «%» apunta a una etapa que no existe.', v_task->>'title'; end if;
    if v_task->>'key' = any (v_seen) then raise exception 'La clave % está repetida.', v_task->>'key'; end if;
    for v_dep in select jsonb_array_elements_text(coalesce(v_task->'depends', '[]'::jsonb)) loop
      if not (v_dep = any (v_seen)) then raise exception '«%» depende de una tarea que no está antes en la lista.', v_task->>'title'; end if;
    end loop;
    v_event := v_task->>'event';
    if v_event is not null then
      if v_event = any (v_events) then raise exception 'Un evento estándar está en más de una tarea.'; end if;
      if v_event = any (v_required) and coalesce((v_task->>'optional')::boolean, false) then
        raise exception '«%» representa un evento obligatorio y no puede ser opcional.', v_task->>'title';
      end if;
      v_events := v_events || v_event;
    end if;
    v_seen := v_seen || (v_task->>'key');
  end loop;
  foreach v_event in array v_required loop
    if not (v_event = any (v_events)) then raise exception 'Falta una tarea para el evento estándar %.', v_event; end if;
  end loop;
end $$;

create or replace function public.create_custom_methodology(p_from uuid, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_src public.methodology_templates; v_id uuid; v_key text;
begin
  if private."current_role"() not in ('super_admin', 'admin') then raise exception 'Solo administración configura metodologías.'; end if;
  select * into v_src from public.methodology_templates where id = p_from and (company_id is null or company_id = private.current_company_id());
  if v_src.id is null then raise exception 'La plantilla de origen no existe.'; end if;
  v_key := concat('custom-', substr(md5(random()::text), 1, 8));
  insert into public.methodology_templates (company_id, template_key, kind, name, description, version, based_on_id, status, definition, created_by)
  values (private.current_company_id(), v_key, 'custom', coalesce(nullif(trim(p_name), ''), concat(v_src.name, ' (personalizada)')),
          concat('Basada en ', v_src.name, ' v', v_src.version), 1, v_src.id, 'draft', v_src.definition, (select auth.uid()))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.save_methodology_draft(p_template uuid, p_definition jsonb, p_name text default null, p_description text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if private."current_role"() not in ('super_admin', 'admin') then raise exception 'Solo administración configura metodologías.'; end if;
  perform private.validate_methodology(p_definition);
  update public.methodology_templates set definition = p_definition, name = coalesce(nullif(trim(p_name), ''), name), description = coalesce(p_description, description)
  where id = p_template and company_id = private.current_company_id() and status = 'draft';
  if not found then raise exception 'Solo se edita un borrador de una metodología de tu empresa. Crea una nueva versión.'; end if;
end $$;

create or replace function public.publish_methodology(p_template uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tpl public.methodology_templates;
begin
  if private."current_role"() not in ('super_admin', 'admin') then raise exception 'Solo administración publica metodologías.'; end if;
  select * into v_tpl from public.methodology_templates where id = p_template and company_id = private.current_company_id() and status = 'draft';
  if v_tpl.id is null then raise exception 'La metodología no es un borrador de tu empresa.'; end if;
  perform private.validate_methodology(v_tpl.definition);
  update public.methodology_templates set status = 'archived' where company_id = v_tpl.company_id and template_key = v_tpl.template_key and status = 'published';
  update public.methodology_templates set status = 'published', published_at = now(), published_by = (select auth.uid()) where id = p_template;
end $$;

create or replace function public.new_methodology_version(p_template uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_tpl public.methodology_templates; v_id uuid;
begin
  if private."current_role"() not in ('super_admin', 'admin') then raise exception 'Solo administración configura metodologías.'; end if;
  select * into v_tpl from public.methodology_templates where id = p_template and company_id = private.current_company_id();
  if v_tpl.id is null then raise exception 'La metodología no pertenece a tu empresa.'; end if;
  if exists (select 1 from public.methodology_templates where company_id = v_tpl.company_id and template_key = v_tpl.template_key and status = 'draft') then
    raise exception 'Ya existe un borrador de esta metodología.';
  end if;
  insert into public.methodology_templates (company_id, template_key, kind, name, description, version, based_on_id, status, definition, created_by)
  select v_tpl.company_id, v_tpl.template_key, v_tpl.kind, v_tpl.name, v_tpl.description, max(version) + 1, v_tpl.id, 'draft', v_tpl.definition, (select auth.uid())
  from public.methodology_templates where company_id = v_tpl.company_id and template_key = v_tpl.template_key
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.set_methodology(p_category uuid, p_template_key text, p_template_company uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_company uuid := private.current_company_id();
begin
  if p_category is null and private."current_role"() not in ('super_admin', 'admin') then
    raise exception 'Solo administración define la metodología de la empresa.';
  end if;
  if p_category is not null and private."current_role"() not in ('super_admin', 'admin', 'manager') then
    raise exception 'Solo la gerencia o administración define la metodología de una categoría.';
  end if;
  if p_category is not null and not exists (select 1 from public.procurement_categories where id = p_category and company_id = v_company) then
    raise exception 'La categoría no pertenece a tu empresa.';
  end if;
  if p_template_company is not null and p_template_company <> v_company then raise exception 'La plantilla no pertenece a tu empresa.'; end if;
  if p_template_key is null then
    delete from public.methodology_assignments where company_id = v_company and category_id is not distinct from p_category;
    return;
  end if;
  if not exists (select 1 from public.methodology_templates where template_key = p_template_key and company_id is not distinct from p_template_company and status = 'published') then
    raise exception 'La metodología elegida no tiene una versión publicada.';
  end if;
  delete from public.methodology_assignments where company_id = v_company and category_id is not distinct from p_category;
  insert into public.methodology_assignments (company_id, category_id, template_key, template_company_id, assigned_by)
  values (v_company, p_category, p_template_key, p_template_company, (select auth.uid()));
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.create_sourcing_project(uuid, text, uuid, uuid, date, smallint, text)',
    'public.reschedule_task(uuid, date, date, text, text, boolean)',
    'public.set_task_not_applicable(uuid, boolean, text)',
    'public.add_project_task(uuid, text, text, uuid, date, date, uuid, text, uuid[])',
    'public.link_rfx_to_project(uuid, text, boolean)',
    'public.link_project_contract(uuid, uuid, text, text)',
    'public.relate_contracts(uuid, uuid, text, uuid, text, numeric, date)',
    'public.add_deliverable_version(uuid, text, text, text, bigint, text)',
    'public.create_baseline(uuid, text, text, text, integer, text, text)',
    'public.request_approval(text, uuid, uuid, text)',
    'public.decide_approval(uuid, text, text)',
    'public.project_facts(uuid)',
    'public.create_custom_methodology(uuid, text)',
    'public.save_methodology_draft(uuid, jsonb, text, text)',
    'public.publish_methodology(uuid)',
    'public.new_methodology_version(uuid)',
    'public.set_methodology(uuid, text, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------- almacenamiento: documentos de proyecto
-- Responsables de proyecto (también Category Managers) suben a {empresa}/proyectos/{proyecto}/…; un proveedor nunca los lee.
create or replace function private.storage_project_may_write(object_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_segment text := split_part(object_name, '/', 3); v_project uuid;
begin
  if split_part(object_name, '/', 2) <> 'proyectos' or v_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_project := v_segment::uuid;
  return private.can_manage_project(v_project) or exists (
    select 1 from public.project_tasks t
    where t.project_id = v_project and t.company_id = private.current_company_id()
      and t.assignee_id = (select auth.uid()) and t.deliverable_key is not null);
end $$;
revoke all on function private.storage_project_may_write(text) from public, anon;
grant execute on function private.storage_project_may_write(text) to authenticated;

drop policy if exists documents_insert_project on storage.objects;
create policy documents_insert_project on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and split_part(name, '/', 2) = 'proyectos'
              and private.storage_company_id(name) = private.current_company_id() and private.current_supplier_id() is null
              and private.storage_project_may_write(name));

-- ---------------------------------------------------------------- plantillas del sistema
insert into public.methodology_templates (company_id, template_key, kind, name, description, version, status, definition, published_at)
select null, 'light', 'light', 'Light', 'Cinco etapas y lo esencial para gestionar procesos y ahorros sin burocracia.', 1, 'published', '{"stages":[{"key":"L1","name":"Definición y referencia económica","summary":"Qué se compra y contra qué se medirá el ahorro."},{"key":"L2","name":"Preparación y salida al mercado","summary":"Bases, proveedores y publicación."},{"key":"L3","name":"Evaluación y negociación","summary":"Ofertas, comparación y negociación."},{"key":"L4","name":"Adjudicación y contratación","summary":"Decisión formal y contrato."},{"key":"L5","name":"Seguimiento de resultados","summary":"Ahorro y servicio."}],"tasks":[{"key":"l1","code":"1","stage":"L1","title":"Definir necesidad, alcance y responsables","kind":"task","duration":5,"depends":[],"role":"category_manager"},{"key":"l2","code":"2","stage":"L1","title":"Documentar la referencia económica","kind":"approval","duration":5,"depends":["l1"],"role":"category_manager","event":"baseline_approved","deliverable":"referencia"},{"key":"l3","code":"3","stage":"L2","title":"Preparar bases y lista de proveedores","kind":"task","duration":7,"depends":["l1"],"role":"buyer","deliverable":"bases"},{"key":"l4","code":"4","stage":"L2","title":"Publicar el RFx e invitar proveedores","kind":"milestone","duration":1,"depends":["l3"],"role":"buyer","event":"rfx_published"},{"key":"l5","code":"5","stage":"L3","title":"Recibir y abrir ofertas","kind":"milestone","duration":10,"depends":["l4"],"role":"buyer","event":"offers_opened"},{"key":"l6","code":"6","stage":"L3","title":"Evaluar y negociar","kind":"task","duration":7,"depends":["l5"],"role":"category_manager","event":"evaluation_closed","deliverable":"recomendacion"},{"key":"l7","code":"7","stage":"L4","title":"Adjudicar","kind":"milestone","duration":3,"depends":["l6"],"role":"committee","event":"award_decided"},{"key":"l8","code":"8","stage":"L4","title":"Formalizar el contrato","kind":"milestone","duration":10,"depends":["l7"],"role":"legal","event":"contract_approved"},{"key":"l9","code":"9","stage":"L5","title":"Seguir ahorro y servicio","kind":"task","duration":60,"depends":["l8"],"role":"category_manager","deliverable":"seguimiento"}],"deliverables":[{"key":"referencia","title":"Referencia económica","stage":"L1","description":"Precio, cantidad y condiciones comparables contra las que se mide el ahorro.","approval":true,"approverRole":"manager","documentRequired":false},{"key":"bases","title":"Bases del proceso","stage":"L2","description":"Bases técnicas y económicas publicadas a los proveedores.","approval":false,"documentRequired":true},{"key":"recomendacion","title":"Recomendación de adjudicación","stage":"L3","description":"Resultado de la evaluación y propuesta al comité.","approval":true,"approverRole":"manager","documentRequired":false},{"key":"seguimiento","title":"Seguimiento de resultados","stage":"L5","description":"Ahorro capturado y desempeño del servicio.","approval":false,"documentRequired":false}],"rules":{"baselineRequired":true,"baselineApproval":"simple","technicalBeforeEconomic":false}}'::jsonb, now()
where not exists (select 1 from public.methodology_templates where company_id is null and template_key = 'light' and version = 1);
insert into public.methodology_templates (company_id, template_key, kind, name, description, version, status, definition, published_at)
select null, 'completa', 'complete', 'Completa · Metodología Xinergy', 'Ocho etapas, 29 actividades y once entregables de la metodología de sourcing de Xinergy.', 1, 'published', '{"stages":[{"key":"E1","name":"Gasto de referencia","summary":"Kick-off, levantamiento y análisis de la información."},{"key":"E2","name":"Análisis técnico y de mercado","summary":"Proveedores, mercado y oportunidades."},{"key":"E3","name":"Desarrollar la estrategia","summary":"Lista corta y estrategia de negociación aprobada."},{"key":"E4","name":"Pliegos y salida al mercado","summary":"Línea base, bases, contrato y publicación del RFx."},{"key":"E5","name":"Evaluación de propuestas y cierre técnico","summary":"Evaluación técnica y económica."},{"key":"E6","name":"Negociación final y formalización","summary":"Negociación de cierre, adjudicación y contrato."},{"key":"E7","name":"Implementación del modelo","summary":"Transición y continuidad del servicio."},{"key":"E8","name":"Monitoreo y control","summary":"Ahorros, servicio y acciones correctivas."}],"tasks":[{"key":"a1","code":"1","stage":"E1","title":"Kick-Off","kind":"milestone","duration":2,"depends":[],"role":"category_manager"},{"key":"a2","code":"2","stage":"E1","title":"Levantamiento de información","kind":"task","duration":10,"depends":["a1"],"role":"buyer","subtasks":["Gasto histórico","Contratos vigentes","Precios, cantidades y condiciones"]},{"key":"a3","code":"3","stage":"E1","title":"Análisis de información","kind":"task","duration":10,"depends":["a2"],"role":"category_manager","deliverable":"gasto_referencia"},{"key":"a4","code":"4","stage":"E2","title":"Levantamiento de lista larga de proveedores","kind":"task","duration":7,"depends":["a3"],"role":"buyer","deliverable":"iniciativas_ahorro"},{"key":"a10","code":"10","stage":"E3","title":"Confirmación de lista corta de proveedores","kind":"task","duration":5,"depends":["a4"],"role":"category_manager"},{"key":"a11","code":"11","stage":"E3","title":"Presentación y aprobación de estrategia de negociación","kind":"approval","duration":5,"depends":["a10"],"role":"manager","deliverable":"estrategia_categoria"},{"key":"a5","code":"5","stage":"E4","title":"Construcción de línea base","kind":"task","duration":7,"depends":["a3"],"role":"category_manager"},{"key":"a6","code":"6","stage":"E4","title":"Construcción de bases técnicas","kind":"task","duration":10,"depends":["a4"],"role":"buyer"},{"key":"a7","code":"7","stage":"E4","title":"Construcción de bases administrativas y anexos","kind":"task","duration":7,"depends":["a6"],"role":"buyer"},{"key":"a8","code":"8","stage":"E4","title":"Construcción de contrato de servicios","kind":"task","duration":7,"depends":["a7"],"role":"legal"},{"key":"a9","code":"9","stage":"E4","title":"Firma de línea base y aprobación de bases de licitación","kind":"approval","duration":3,"depends":["a5","a8","a11"],"role":"manager","event":"baseline_approved","deliverable":"pliego"},{"key":"a12","code":"12","stage":"E4","title":"Invitación a proveedores","kind":"task","duration":2,"depends":["a9"],"role":"buyer"},{"key":"a13","code":"13","stage":"E4","title":"Publicación del RFx","kind":"milestone","duration":1,"depends":["a12"],"role":"buyer","event":"rfx_published"},{"key":"a14","code":"14","stage":"E4","title":"Recepción de preguntas","kind":"task","duration":7,"depends":["a13"],"role":"buyer"},{"key":"a15","code":"15","stage":"E4","title":"Envío de respuestas","kind":"task","duration":5,"depends":["a14"],"role":"buyer"},{"key":"a16","code":"16","stage":"E5","title":"Recepción de propuestas","kind":"milestone","duration":10,"depends":["a15"],"role":"buyer","event":"offers_opened"},{"key":"a17","code":"17","stage":"E5","title":"Evaluación técnica","kind":"task","duration":7,"depends":["a16"],"role":"category_manager"},{"key":"a18","code":"18","stage":"E5","title":"Evaluación económica","kind":"task","duration":5,"depends":["a17"],"role":"category_manager","event":"evaluation_closed","deliverable":"matriz_evaluacion"},{"key":"a19","code":"19","stage":"E5","title":"Presentación de resultados y posible adjudicación","kind":"task","duration":2,"depends":["a18"],"role":"category_manager","deliverable":"proveedores_negociacion"},{"key":"a20","code":"20","stage":"E6","title":"Definición de estrategia de negociación de cierre","kind":"approval","duration":3,"depends":["a19"],"role":"category_manager","deliverable":"estrategia_cierre"},{"key":"a21","code":"21","stage":"E6","title":"Publicación de negociación de cierre","kind":"milestone","duration":1,"depends":["a20"],"role":"buyer","optional":true,"event":"final_round_opened"},{"key":"a22","code":"22","stage":"E6","title":"Recepción de propuestas finales","kind":"task","duration":5,"depends":["a21"],"role":"buyer","optional":true},{"key":"a23","code":"23","stage":"E6","title":"Evaluación de propuesta final","kind":"task","duration":3,"depends":["a22"],"role":"category_manager","optional":true},{"key":"a24","code":"24","stage":"E6","title":"Presentación de resultados, recomendación de adjudicación y ahorros","kind":"approval","duration":2,"depends":["a23"],"role":"category_manager","deliverable":"recomendacion_adjudicacion"},{"key":"a25","code":"25","stage":"E6","title":"Adjudicación","kind":"milestone","duration":1,"depends":["a24"],"role":"committee","event":"award_decided"},{"key":"a26","code":"26","stage":"E6","title":"Confirmación formal del proveedor","kind":"task","duration":3,"depends":["a25"],"role":"buyer"},{"key":"a27","code":"27","stage":"E6","title":"Revisión y firma de contrato","kind":"milestone","duration":10,"depends":["a26"],"role":"legal","event":"contract_approved","deliverable":"acta_contratos"},{"key":"a28","code":"28","stage":"E7","title":"Kick-off del servicio","kind":"task","duration":5,"depends":["a27"],"role":"category_manager","deliverable":"plan_implementacion"},{"key":"a29","code":"29","stage":"E8","title":"Seguimiento de ahorros y servicio","kind":"task","duration":90,"depends":["a28"],"role":"category_manager","deliverable":"brechas_acciones"}],"deliverables":[{"key":"gasto_referencia","title":"Gasto de referencia por categoría","stage":"E1","description":"Gasto histórico, precios, cantidades, plazos, condiciones y contratos actuales. Todavía no es la línea base aprobada.","approval":false,"documentRequired":true},{"key":"iniciativas_ahorro","title":"Listado de iniciativas de ahorro","stage":"E2","description":"Oportunidades de precio, demanda, especificación y condiciones, con riesgo e impacto esperado.","approval":false,"documentRequired":true},{"key":"estrategia_categoria","title":"Estrategia de categoría","stage":"E3","description":"Modelo de compra, mercado, proveedores, alcance, lotes, criterios y escenarios de contratación.","approval":true,"approverRole":"manager","documentRequired":true},{"key":"pliego","title":"Pliego de licitación","stage":"E4","description":"Bases técnicas y administrativas, anexos, formularios y contrato tipo, versionados y aprobados.","approval":true,"approverRole":"manager","documentRequired":true},{"key":"matriz_evaluacion","title":"Matriz de evaluación técnica y económica","stage":"E5","description":"Puntajes por criterio y comparación económica de las ofertas.","approval":false,"documentRequired":true},{"key":"proveedores_negociacion","title":"Proveedores aprobados para negociación final","stage":"E5","description":"Resultado de la evaluación y proveedores que pasan a la negociación de cierre.","approval":false,"documentRequired":false},{"key":"estrategia_cierre","title":"Estrategia de negociación final","stage":"E6","description":"Objetivos, concesiones y límites de la negociación de cierre.","approval":true,"approverRole":"manager","documentRequired":true},{"key":"recomendacion_adjudicacion","title":"Resultado y recomendación de adjudicación","stage":"E6","description":"Recomendación al comité con el ahorro negociado frente a la línea base.","approval":true,"approverRole":"manager","documentRequired":true},{"key":"acta_contratos","title":"Acta y contratos formalizados","stage":"E6","description":"Acta de adjudicación y contratos aprobados.","approval":false,"documentRequired":true},{"key":"plan_implementacion","title":"Plan de implementación","stage":"E7","description":"Transición contractual, actividades, responsables, fechas, pendientes y riesgos.","approval":false,"documentRequired":true},{"key":"brechas_acciones","title":"Brechas y acciones correctivas","stage":"E8","description":"Seguimiento de beneficios, cumplimiento contractual y acciones con responsables.","approval":false,"documentRequired":true}],"rules":{"baselineRequired":true,"baselineApproval":"formal","technicalBeforeEconomic":true}}'::jsonb, now()
where not exists (select 1 from public.methodology_templates where company_id is null and template_key = 'completa' and version = 1);
