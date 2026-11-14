-- Permite registrar una llamada real a Groq, acotada al modelo ya configurado.

alter table public.ana_interactions
  add column if not exists input_tokens integer not null default 0,
  add column if not exists output_tokens integer not null default 0;

alter table public.ana_interactions drop constraint if exists ana_interactions_no_model;
alter table public.ana_interactions drop constraint if exists ana_interactions_tokens_cap;
alter table public.ana_interactions
  add constraint ana_interactions_tokens_cap check (
    tokens >= 0
    and tokens <= 6000
    and input_tokens >= 0
    and output_tokens >= 0
    and tokens = input_tokens + output_tokens
    and (
      (model_called = false and model is null and tokens = 0)
      or (model_called = true and model = 'qwen/qwen3.8-27b')
    )
  );

drop policy if exists ana_interactions_insert on public.ana_interactions;
create policy ana_interactions_insert
on public.ana_interactions for insert to authenticated
with check (
  company_id = private.current_company_id()
  and user_id = auth.uid()
  and private.current_supplier_id() is null
  and tokens = input_tokens + output_tokens
  and tokens <= 6000
  and (
    (model_called = false and model is null and tokens = 0)
    or (model_called = true and model = 'qwen/qwen3.8-27b')
  )
);

create or replace function private.guard_ana_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.model_called and new.model is distinct from 'qwen/qwen3.8-27b' then
    raise exception 'ANA solo registra el modelo Groq ya configurado';
  end if;
  if new.tokens > 6000 or new.tokens <> new.input_tokens + new.output_tokens then
    raise exception 'La llamada de ANA supera el tope de tokens';
  end if;
  if tg_op = 'UPDATE' and (
    new.question is distinct from old.question
    or new.answer is distinct from old.answer
    or new.evidence is distinct from old.evidence
    or new.proposal is distinct from old.proposal
    or new.company_id is distinct from old.company_id
    or new.user_id is distinct from old.user_id
    or new.model_called is distinct from old.model_called
    or new.tokens is distinct from old.tokens
  ) then
    raise exception 'El historial de ANA no se reescribe';
  end if;
  return new;
end;
$$;
