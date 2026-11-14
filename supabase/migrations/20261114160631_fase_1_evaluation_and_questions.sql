-- Consultas del proceso y evaluación persistida.
-- Recomendar no cambia el estado de adjudicación.

create table if not exists public.process_questions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  event_id uuid not null references public.offer_events(id) on delete cascade,
  supplier_id text not null references public.suppliers(id) on delete cascade,
  question text not null,
  answer text,
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  asked_by uuid not null references public.profiles(id),
  answered_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  event_id uuid not null unique references public.offer_events(id) on delete cascade,
  licitacion_id text references public.licitaciones(id) on delete set null,
  technical_weight numeric(5,2) not null check (technical_weight >= 0 and technical_weight <= 100),
  economic_weight numeric(5,2) not null check (economic_weight >= 0 and economic_weight <= 100),
  economic_formula text not null default 'lowest_qualified_price' check (economic_formula = 'lowest_qualified_price'),
  price_basis text not null default 'as_bid' check (price_basis = 'as_bid'),
  technical_threshold numeric(5,2),
  scale_max numeric(6,2) not null default 100,
  status text not null default 'draft' check (status in ('draft', 'closed')),
  created_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  created_at timestamptz not null default now(),
  check (technical_weight + economic_weight = 100)
);

create table if not exists public.evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  parent_id uuid references public.evaluation_criteria(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('technical', 'mandatory')),
  weight numeric(5,2) not null default 0 check (weight >= 0),
  threshold numeric(5,2),
  sort_order integer not null default 1
);

create table if not exists public.evaluation_scores (
  id uuid primary key default gen_random_uuid(),
  criterion_id uuid not null references public.evaluation_criteria(id) on delete cascade,
  supplier_id text not null references public.suppliers(id) on delete cascade,
  evaluator_id uuid not null references public.profiles(id),
  score numeric(6,2),
  failed_mandatory boolean not null default false,
  comment text,
  updated_at timestamptz not null default now(),
  unique (criterion_id, supplier_id, evaluator_id)
);

create table if not exists public.evaluation_results (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  supplier_id text not null references public.suppliers(id) on delete cascade,
  technical_score numeric(8,2),
  economic_score numeric(8,2),
  final_score numeric(8,2),
  qualified boolean not null,
  exclusion_reason text,
  total_amount numeric(15,2),
  currency text,
  low_bid_alert boolean not null default false,
  scope_alert boolean not null default false,
  rank integer,
  parameters jsonb not null,
  calculated_at timestamptz not null default now(),
  unique (evaluation_id, supplier_id)
);

create table if not exists public.award_recommendations (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  event_id uuid not null references public.offer_events(id) on delete cascade,
  licitacion_id text,
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id text not null references public.suppliers(id),
  technical_note text not null,
  economic_note text not null,
  not_lowest_price boolean not null default false,
  report_text text not null,
  prepared_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace function private.audit_question()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.offer_audit (company_id, event_id, supplier_id, actor_id, action, detail)
  values (
    new.company_id,
    new.event_id,
    case when new.visibility = 'shared' then null else new.supplier_id end,
    coalesce(new.answered_by, new.asked_by),
    case
      when tg_op = 'INSERT' then 'question_asked'
      when new.visibility = 'shared' then 'clarification_published'
      else 'question_answered'
    end,
    left(coalesce(new.answer, new.question), 240)
  );
  return new;
end;
$$;

drop trigger if exists audit_question on public.process_questions;
create trigger audit_question
after insert or update of answer, visibility on public.process_questions
for each row execute function private.audit_question();

create or replace function private.guard_evaluation_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  scored boolean;
begin
  select status into current_status from public.evaluations where id = coalesce(new.evaluation_id, old.evaluation_id);
  if current_status = 'closed' then
    raise exception 'La evaluación está cerrada';
  end if;
  select exists (
    select 1
    from public.evaluation_scores s
    join public.evaluation_criteria c on c.id = s.criterion_id
    where c.evaluation_id = coalesce(new.evaluation_id, old.evaluation_id)
  ) into scored;
  if scored and tg_table_name = 'evaluation_criteria' then
    raise exception 'No se pueden cambiar los criterios después de puntuar';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists guard_evaluation_criteria on public.evaluation_criteria;
create trigger guard_evaluation_criteria
before insert or update or delete on public.evaluation_criteria
for each row execute function private.guard_evaluation_edit();

create or replace function private.guard_evaluation_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  select e.status into current_status
  from public.evaluation_criteria c
  join public.evaluations e on e.id = c.evaluation_id
  where c.id = new.criterion_id;
  if current_status = 'closed' then
    raise exception 'La evaluación está cerrada';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_evaluation_score on public.evaluation_scores;
create trigger guard_evaluation_score
before insert or update on public.evaluation_scores
for each row execute function private.guard_evaluation_score();

alter table public.process_questions enable row level security;
alter table public.evaluations enable row level security;
alter table public.evaluation_criteria enable row level security;
alter table public.evaluation_scores enable row level security;
alter table public.evaluation_results enable row level security;
alter table public.award_recommendations enable row level security;

create policy process_questions_select
on public.process_questions for select to authenticated
using (
  private.current_user_manages_offer_event(event_id)
  or (
    supplier_id = private.current_supplier_id()
    and visibility = 'private'
  )
  or (
    visibility = 'shared'
    and exists (
      select 1 from public.offer_invitations i
      where i.event_id = process_questions.event_id
        and i.supplier_id = private.current_supplier_id()
    )
  )
);

create policy process_questions_insert
on public.process_questions for insert to authenticated
with check (
  supplier_id = private.current_supplier_id()
  and asked_by = auth.uid()
  and visibility = 'private'
  and answer is null
  and private.reception_is_open(event_id)
  and exists (
    select 1 from public.offer_invitations i
    where i.event_id = process_questions.event_id
      and i.supplier_id = process_questions.supplier_id
  )
);

create policy process_questions_update
on public.process_questions for update to authenticated
using (private.current_user_manages_offer_event(event_id))
with check (private.current_user_manages_offer_event(event_id));

create policy evaluations_buyer
on public.evaluations for all to authenticated
using (private.current_user_manages_offer_event(event_id))
with check (private.current_user_manages_offer_event(event_id));

create policy evaluation_criteria_buyer
on public.evaluation_criteria for all to authenticated
using (
  exists (
    select 1 from public.evaluations e
    where e.id = evaluation_criteria.evaluation_id
      and private.current_user_manages_offer_event(e.event_id)
  )
)
with check (
  exists (
    select 1 from public.evaluations e
    where e.id = evaluation_criteria.evaluation_id
      and private.current_user_manages_offer_event(e.event_id)
  )
);

create policy evaluation_scores_buyer
on public.evaluation_scores for all to authenticated
using (
  exists (
    select 1
    from public.evaluation_criteria c
    join public.evaluations e on e.id = c.evaluation_id
    where c.id = evaluation_scores.criterion_id
      and private.current_user_manages_offer_event(e.event_id)
  )
)
with check (
  exists (
    select 1
    from public.evaluation_criteria c
    join public.evaluations e on e.id = c.evaluation_id
    where c.id = evaluation_scores.criterion_id
      and private.current_user_manages_offer_event(e.event_id)
  )
);

create policy evaluation_results_buyer
on public.evaluation_results for all to authenticated
using (
  exists (
    select 1 from public.evaluations e
    where e.id = evaluation_results.evaluation_id
      and private.current_user_manages_offer_event(e.event_id)
  )
)
with check (
  exists (
    select 1 from public.evaluations e
    where e.id = evaluation_results.evaluation_id
      and private.current_user_manages_offer_event(e.event_id)
  )
);

create policy award_recommendations_buyer
on public.award_recommendations for all to authenticated
using (private.current_user_manages_offer_event(event_id))
with check (private.current_user_manages_offer_event(event_id));

grant select, insert, update on public.process_questions to authenticated;
grant select, insert, update, delete on public.evaluations to authenticated;
grant select, insert, update, delete on public.evaluation_criteria to authenticated;
grant select, insert, update, delete on public.evaluation_scores to authenticated;
grant select, insert, update, delete on public.evaluation_results to authenticated;
grant select, insert on public.award_recommendations to authenticated;
revoke all on public.process_questions, public.evaluations, public.evaluation_criteria, public.evaluation_scores, public.evaluation_results, public.award_recommendations from anon;

drop policy if exists offer_audit_insert on public.offer_audit;
create policy offer_audit_insert
on public.offer_audit for insert to authenticated
with check (private.current_user_manages_offer_event(event_id));

grant insert on public.offer_audit to authenticated;
