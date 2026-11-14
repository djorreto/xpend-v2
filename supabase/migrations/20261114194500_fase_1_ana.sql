-- Historial de ANA. Este incremento no autoriza llamadas a un modelo.

create table if not exists public.ana_interactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  module text not null,
  record_id text,
  question text not null,
  mode text not null check (mode in ('data', 'document', 'draft', 'refused', 'model_required')),
  answer text not null,
  evidence jsonb not null default '[]'::jsonb,
  proposal jsonb,
  context jsonb not null default '{}'::jsonb,
  model_called boolean not null default false,
  model text,
  tokens integer not null default 0,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ana_interactions_no_model check (model_called = false and tokens = 0 and model is null)
);

create index if not exists ana_interactions_company_created
  on public.ana_interactions (company_id, created_at desc);

alter table public.ana_interactions enable row level security;
revoke all on public.ana_interactions from anon;
grant select, insert, update on public.ana_interactions to authenticated;

drop policy if exists ana_interactions_read on public.ana_interactions;
create policy ana_interactions_read
on public.ana_interactions for select to authenticated
using (
  company_id = private.current_company_id()
  and private.current_supplier_id() is null
);

drop policy if exists ana_interactions_insert on public.ana_interactions;
create policy ana_interactions_insert
on public.ana_interactions for insert to authenticated
with check (
  company_id = private.current_company_id()
  and user_id = auth.uid()
  and private.current_supplier_id() is null
  and model_called = false
  and tokens = 0
  and model is null
);

drop policy if exists ana_interactions_apply on public.ana_interactions;
create policy ana_interactions_apply
on public.ana_interactions for update to authenticated
using (company_id = private.current_company_id() and user_id = auth.uid() and private.current_supplier_id() is null)
with check (company_id = private.current_company_id() and user_id = auth.uid() and model_called = false and tokens = 0);

create or replace function private.guard_ana_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.model_called or new.tokens <> 0 or new.model is not null then
    raise exception 'ANA no registra una llamada a un modelo en este incremento';
  end if;
  if tg_op = 'UPDATE' and (
    new.question is distinct from old.question
    or new.answer is distinct from old.answer
    or new.evidence is distinct from old.evidence
    or new.proposal is distinct from old.proposal
    or new.company_id is distinct from old.company_id
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'El historial de ANA no se reescribe';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_ana_interaction on public.ana_interactions;
create trigger guard_ana_interaction
before insert or update on public.ana_interactions
for each row execute function private.guard_ana_interaction();
