-- Comité, decisión y adjudicación formal. Local de Fase 1. No aplica a producción sin autorización.

create table if not exists public.award_policies (
  company_id uuid primary key references public.companies(id) on delete cascade,
  mode text not null default 'individual' check (mode in ('individual', 'committee')),
  required_approvals integer not null default 1 check (required_approvals >= 1 and required_approvals <= 12),
  allow_self_approval boolean not null default false,
  approver_roles text[] not null default array['admin', 'manager']::text[],
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  check (
    cardinality(approver_roles) > 0
    and approver_roles <@ array['admin', 'manager']::text[]
  )
);

create table if not exists public.decision_packets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  licitacion_id text not null references public.licitaciones(id) on delete cascade,
  event_id uuid not null references public.offer_events(id) on delete cascade,
  evaluation_id uuid not null references public.evaluations(id),
  recommendation_id uuid not null references public.award_recommendations(id),
  version integer not null check (version >= 1),
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'returned', 'superseded')),
  snapshot jsonb not null,
  risks text,
  exceptions text,
  observations text,
  prepared_by uuid not null references public.profiles(id),
  submitted_at timestamptz,
  supersedes_id uuid references public.decision_packets(id),
  created_at timestamptz not null default now(),
  unique (event_id, version)
);

create table if not exists public.award_decisions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  packet_id uuid not null unique references public.decision_packets(id) on delete cascade,
  licitacion_id text not null references public.licitaciones(id) on delete cascade,
  evaluation_id uuid not null references public.evaluations(id),
  recommendation_id uuid not null references public.award_recommendations(id),
  recommended_supplier_id text not null,
  approved_supplier_id text,
  outcome text not null default 'pending' check (outcome in ('pending', 'approved', 'rejected', 'returned')),
  justification text,
  conditions text,
  different_supplier boolean not null default false,
  different_supplier_justification text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create unique index if not exists award_decisions_one_pending
  on public.award_decisions (licitacion_id)
  where outcome = 'pending';

create table if not exists public.award_votes (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.award_decisions(id) on delete cascade,
  voter_id uuid not null references public.profiles(id),
  voter_role text not null,
  vote text not null check (vote in ('approved', 'rejected', 'returned')),
  comment text,
  chosen_supplier_id text,
  self_approval_exception boolean not null default false,
  created_at timestamptz not null default now(),
  unique (decision_id, voter_id)
);

create table if not exists public.process_awards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  licitacion_id text not null unique references public.licitaciones(id) on delete cascade,
  decision_id uuid not null unique references public.award_decisions(id),
  packet_id uuid not null references public.decision_packets(id),
  evaluation_id uuid not null references public.evaluations(id),
  event_id uuid not null references public.offer_events(id),
  bid_id uuid not null references public.offer_bids(id),
  supplier_id text not null references public.suppliers(id),
  amount numeric(15,2) not null check (amount > 0),
  currency text not null,
  scope_summary text,
  conditions text,
  budget_amount numeric(15,2),
  baseline_amount numeric(15,2),
  baseline_currency text,
  baseline_source text,
  target_savings numeric(15,2),
  estimated_savings numeric(15,2),
  estimated_percentage numeric(8,2),
  savings_note text not null,
  realized_savings numeric(15,2),
  lines jsonb not null default '[]'::jsonb,
  awarded_by uuid not null references public.profiles(id),
  awarded_at timestamptz not null default now()
);

create or replace function private.freeze_decision_packet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.award_policies (company_id) values (new.company_id) on conflict do nothing;
    if not exists (
      select 1 from public.evaluations e
      where e.id = new.evaluation_id and e.status = 'closed' and e.event_id = new.event_id
    ) then
      raise exception 'La evaluación tiene que estar cerrada antes de enviarla al comité';
    end if;
    if not exists (
      select 1 from public.offer_events ev
      where ev.id = new.event_id and ev.offers_opened_at is not null
    ) then
      raise exception 'Los sobres tienen que estar abiertos';
    end if;
  end if;
  if tg_op = 'UPDATE' and (
    new.snapshot is distinct from old.snapshot
    or new.evaluation_id is distinct from old.evaluation_id
    or new.recommendation_id is distinct from old.recommendation_id
    or new.licitacion_id is distinct from old.licitacion_id
    or new.event_id is distinct from old.event_id
  ) then
    raise exception 'El expediente enviado no se reescribe. Una corrección crea una versión nueva.';
  end if;
  if tg_op = 'UPDATE'
    and new.status is distinct from old.status
    and coalesce(current_setting('xpend.packet_status', true), '') is distinct from 'allow' then
    raise exception 'El estado del expediente lo cambia la decisión';
  end if;
  if new.status = 'submitted' and new.submitted_at is null then
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists freeze_decision_packet on public.decision_packets;
create trigger freeze_decision_packet
before insert or update on public.decision_packets
for each row execute function private.freeze_decision_packet();

create or replace function private.open_award_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'submitted' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'submitted' then
    return new;
  end if;
  insert into public.award_decisions (
    company_id, packet_id, licitacion_id, evaluation_id, recommendation_id,
    recommended_supplier_id, created_by
  )
  select
    new.company_id,
    new.id,
    new.licitacion_id,
    new.evaluation_id,
    new.recommendation_id,
    r.supplier_id,
    new.prepared_by
  from public.award_recommendations r
  where r.id = new.recommendation_id;
  return new;
end;
$$;

drop trigger if exists open_award_decision on public.decision_packets;
create trigger open_award_decision
after insert or update of status on public.decision_packets
for each row execute function private.open_award_decision();

create or replace function private.guard_award_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  decision public.award_decisions;
  packet public.decision_packets;
  policy public.award_policies;
  voter_role text;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Los votos no se editan ni se borran';
  end if;
  select * into decision from public.award_decisions where id = new.decision_id;
  if decision.id is null or decision.outcome <> 'pending' then
    raise exception 'Esta decisión ya no recibe votos';
  end if;
  select * into packet from public.decision_packets where id = decision.packet_id;
  if packet.status <> 'submitted' then
    raise exception 'El expediente no está en revisión';
  end if;
  if decision.company_id is distinct from private.current_company_id() then
    raise exception 'La decisión es de otra empresa';
  end if;
  if private.current_supplier_id() is not null then
    raise exception 'Un proveedor no participa en la decisión interna';
  end if;
  voter_role := private.current_role();
  select * into policy from public.award_policies where company_id = decision.company_id;
  if policy.company_id is null then
    raise exception 'La empresa no tiene una política de aprobación';
  end if;
  if voter_role is null or not (voter_role = any (policy.approver_roles)) then
    raise exception 'Tu rol no está habilitado para aprobar esta empresa';
  end if;
  if new.voter_id is distinct from auth.uid() then
    raise exception 'El voto tiene que ser del usuario autenticado';
  end if;
  new.voter_role := voter_role;
  new.self_approval_exception := false;
  if new.voter_id = packet.prepared_by then
    if not policy.allow_self_approval then
      raise exception 'Quien recomienda no puede aprobar su propia solicitud';
    end if;
    new.self_approval_exception := true;
  end if;
  if new.vote = 'approved' and new.chosen_supplier_id is null then
    new.chosen_supplier_id := decision.recommended_supplier_id;
  end if;
  if new.vote = 'approved'
    and new.chosen_supplier_id is distinct from decision.recommended_supplier_id
    and coalesce(btrim(new.comment), '') = '' then
    raise exception 'Elegir un proveedor distinto al recomendado exige una justificación';
  end if;
  if new.vote in ('rejected', 'returned') and coalesce(btrim(new.comment), '') = '' then
    raise exception 'El rechazo o la devolución necesitan una observación';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_award_vote on public.award_votes;
create trigger guard_award_vote
before insert or update or delete on public.award_votes
for each row execute function private.guard_award_vote();

create or replace function private.apply_award_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  decision public.award_decisions;
  policy public.award_policies;
  approvals integer;
  supplier_id text;
begin
  select * into decision from public.award_decisions where id = new.decision_id;
  select * into policy from public.award_policies where company_id = decision.company_id;
  perform set_config('xpend.packet_status', 'allow', true);
  if new.vote = 'rejected' then
    update public.award_decisions
    set outcome = 'rejected', justification = new.comment, closed_at = now()
    where id = decision.id;
  elsif new.vote = 'returned' then
    update public.award_decisions
    set outcome = 'returned', justification = new.comment, closed_at = now()
    where id = decision.id;
    update public.decision_packets set status = 'returned' where id = decision.packet_id;
  else
    supplier_id := coalesce(decision.approved_supplier_id, new.chosen_supplier_id);
    if decision.approved_supplier_id is not null
      and decision.approved_supplier_id is distinct from new.chosen_supplier_id then
      raise exception 'Los aprobadores tienen que coincidir en el proveedor';
    end if;
    update public.award_decisions
    set
      approved_supplier_id = supplier_id,
      different_supplier = supplier_id is distinct from recommended_supplier_id,
      different_supplier_justification = case
        when supplier_id is distinct from recommended_supplier_id then coalesce(different_supplier_justification, new.comment)
        else different_supplier_justification
      end
    where id = decision.id;
    select count(*) into approvals
    from public.award_votes
    where decision_id = decision.id and vote = 'approved';
    if approvals >= policy.required_approvals then
      update public.award_decisions
      set outcome = 'approved', closed_at = now()
      where id = decision.id and outcome = 'pending';
    end if;
  end if;
  insert into public.offer_audit (company_id, event_id, supplier_id, actor_id, action, detail)
  select p.company_id, p.event_id, new.chosen_supplier_id, new.voter_id,
    'award_vote_' || new.vote,
    left(coalesce(new.comment, new.vote), 240)
  from public.decision_packets p
  where p.id = decision.packet_id;
  return new;
end;
$$;

drop trigger if exists apply_award_vote on public.award_votes;
create trigger apply_award_vote
after insert on public.award_votes
for each row execute function private.apply_award_vote();

create or replace function private.guard_offer_award()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'awarded' and old.status is distinct from 'awarded' then
    if not exists (
      select 1 from public.process_awards a
      where a.event_id = new.id
        and a.supplier_id = new.winning_supplier_id
        and a.amount = new.winning_amount
    ) then
      raise exception 'La sala se adjudica desde una decisión aprobada';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_offer_award on public.offer_events;
create trigger guard_offer_award
before update of status on public.offer_events
for each row execute function private.guard_offer_award();

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
  approver uuid;
begin
  status_changed := tg_op = 'INSERT'
    or new.status::text is distinct from old.status::text;

  if not status_changed
    or target_status not in ('published', 'evaluation', 'awarded', 'contract_signed')
  then
    return new;
  end if;

  if target_status = 'awarded' then
    if actor_id is null or private.current_company_id() is distinct from new.company_id then
      raise exception using errcode = '42501', message = 'La adjudicación solo la ejecuta alguien de la empresa del proceso.';
    end if;
    if actor_role not in ('admin', 'manager') then
      raise exception using errcode = '42501', message = 'La adjudicación la ejecuta un administrador o gerente de la empresa.';
    end if;
    if not exists (
      select 1
      from public.process_awards a
      join public.award_decisions d on d.id = a.decision_id
      where a.licitacion_id = new.id
        and a.company_id = new.company_id
        and a.amount = new.awarded_amount
        and d.outcome = 'approved'
    ) then
      raise exception using errcode = '23514', message = 'La adjudicación requiere una decisión aprobada y su registro formal.';
    end if;
    select v.voter_id into approver
    from public.process_awards a
    join public.award_votes v on v.decision_id = a.decision_id and v.vote = 'approved'
    where a.licitacion_id = new.id
    order by v.created_at desc
    limit 1;
    if approver is null then
      raise exception using errcode = '23514', message = 'Falta el voto de aprobación.';
    end if;
    new.award_approved_by := approver;
    new.award_approved_at := coalesce(new.award_approved_at, now());
    if new.baseline_amount is null or new.baseline_amount <= 0 then
      raise exception using errcode = '23514', message = 'La adjudicación requiere un presupuesto base mayor que cero.';
    end if;
    if new.awarded_amount is null or new.awarded_amount <= 0 then
      raise exception using errcode = '23514', message = 'La adjudicación requiere un monto adjudicado mayor que cero.';
    end if;
    if coalesce(btrim(new.tender_document_path), '') = '' then
      raise exception using errcode = '23514', message = 'La adjudicación requiere las bases cargadas.';
    end if;
    return new;
  end if;

  if actor_id is null or actor_role not in ('admin', 'manager', 'super_admin') then
    raise exception using errcode = '42501', message = 'La transición requiere una aprobación autenticada.';
  end if;
  if actor_role <> 'super_admin' and new.company_id is distinct from private.current_company_id() then
    raise exception using errcode = '42501', message = 'La aprobación no pertenece a la empresa del usuario.';
  end if;
  if coalesce(btrim(new.tender_document_path), '') = '' then
    raise exception using errcode = '23514', message = 'La publicación o adjudicación requiere las bases cargadas.';
  end if;
  if target_status = 'contract_signed' then
    if new.baseline_amount is null or new.baseline_amount <= 0 then
      raise exception using errcode = '23514', message = 'La adjudicación requiere un presupuesto base mayor que cero.';
    end if;
    if new.awarded_amount is null or new.awarded_amount <= 0 then
      raise exception using errcode = '23514', message = 'La adjudicación requiere un monto adjudicado mayor que cero.';
    end if;
    new.award_approved_at := coalesce(new.award_approved_at, now());
    new.award_approved_by := coalesce(new.award_approved_by, actor_id);
  else
    new.publish_approved_at := now();
    new.publish_approved_by := actor_id;
  end if;
  return new;
end;
$$;

create or replace function public.finalize_award(target_decision uuid, award_conditions text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  decision public.award_decisions;
  packet public.decision_packets;
  bid public.offer_bids;
  lic public.licitaciones;
  result public.evaluation_results;
  plan_id uuid;
  target_savings numeric;
  estimated numeric;
  percentage numeric;
  note text;
  comparable boolean := true;
  award_id uuid;
  scope_text text;
  line_payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'Falta la sesión';
  end if;
  if private.current_supplier_id() is not null then
    raise exception 'Un proveedor no adjudica el proceso';
  end if;
  if private.current_role() not in ('admin', 'manager') then
    raise exception 'La adjudicación la ejecuta un administrador o gerente de la empresa';
  end if;

  select * into decision from public.award_decisions where id = target_decision;
  if decision.id is null then
    raise exception 'No existe la decisión';
  end if;
  if decision.company_id is distinct from private.current_company_id() then
    raise exception 'La decisión es de otra empresa';
  end if;
  if decision.outcome <> 'approved' then
    raise exception 'Solo se adjudica una decisión aprobada';
  end if;
  if decision.approved_supplier_id is null then
    raise exception 'La decisión no tiene proveedor aprobado';
  end if;
  if decision.different_supplier and coalesce(btrim(decision.different_supplier_justification), '') = '' then
    raise exception 'Falta la justificación del proveedor distinto al recomendado';
  end if;
  if exists (select 1 from public.process_awards where licitacion_id = decision.licitacion_id) then
    raise exception 'Esta licitación ya tiene una adjudicación';
  end if;

  select * into packet from public.decision_packets where id = decision.packet_id;
  select * into lic from public.licitaciones where id = decision.licitacion_id;
  select * into bid
  from public.offer_bids
  where event_id = packet.event_id
    and supplier_id = decision.approved_supplier_id
    and status = 'submitted';
  if bid.id is null then
    raise exception 'No está la oferta presentada del proveedor aprobado';
  end if;
  if bid.currency is distinct from lic.baseline_currency then
    comparable := false;
    note := 'La oferta y la línea base están en monedas distintas. No se convierten ni se mezclan.';
  elsif lic.baseline_amount is null or lic.baseline_amount <= 0 then
    comparable := false;
    note := 'No hay una línea base documentada. El ahorro estimado no se calcula.';
  else
    select * into result
    from public.evaluation_results
    where evaluation_id = decision.evaluation_id
      and supplier_id = decision.approved_supplier_id;
    if result.scope_alert then
      comparable := false;
      note := 'El alcance de la oferta no es comparable con la línea base. El ahorro estimado no se calcula.';
    end if;
  end if;
  if comparable then
    estimated := round(lic.baseline_amount - bid.amount, 2);
    percentage := round(estimated / lic.baseline_amount * 100, 2);
    note := 'Ahorro estimado: línea base menos monto adjudicado, misma moneda y alcance completo. El objetivo de la iniciativa no es el resultado. El ahorro realizado queda vacío hasta que exista evidencia posterior.';
    if lic.baseline_source::text = 'budget' then
      note := 'La línea base documentada es el presupuesto del proceso. ' || note;
    end if;
  end if;

  select sp.id, sp.projected_savings_amount
    into plan_id, target_savings
  from public.sourcing_plan_licitaciones link
  join public.sourcing_plans sp on sp.id = link.plan_id
  where link.licitacion_id = lic.id
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'description', l.description,
    'quantity', l.quantity,
    'unit', l.unit,
    'unit_price', l.unit_price,
    'currency', l.currency
  ) order by l.position), '[]'::jsonb)
  into line_payload
  from public.offer_bid_lines l
  where l.bid_id = bid.id;

  scope_text := coalesce(nullif(btrim(lic.description), ''), lic.name);
  insert into public.process_awards (
    company_id, licitacion_id, decision_id, packet_id, evaluation_id, event_id, bid_id,
    supplier_id, amount, currency, scope_summary, conditions, budget_amount, baseline_amount,
    baseline_currency, baseline_source, target_savings, estimated_savings, estimated_percentage,
    savings_note, realized_savings, lines, awarded_by
  )
  values (
    decision.company_id, lic.id, decision.id, packet.id, decision.evaluation_id, packet.event_id, bid.id,
    bid.supplier_id, bid.amount, bid.currency, scope_text, nullif(btrim(award_conditions), ''),
    lic.baseline_amount, lic.baseline_amount, lic.baseline_currency, lic.baseline_source::text,
    target_savings, estimated, percentage, note, null, line_payload, auth.uid()
  )
  returning id into award_id;

  update public.offer_events
  set status = 'awarded',
      winning_supplier_id = bid.supplier_id,
      winning_amount = bid.amount,
      updated_at = now()
  where id = packet.event_id;

  update public.licitaciones
  set status = 'awarded',
      awarded_amount = bid.amount,
      award_date = current_date,
      committee_date = current_date,
      savings_amount = estimated,
      savings_percentage = percentage,
      award_approved_by = (
        select v.voter_id from public.award_votes v
        where v.decision_id = decision.id and v.vote = 'approved'
        order by v.created_at desc limit 1
      ),
      updated_at = now()
  where id = lic.id;

  update public.sourcing_plans
  set status = 'completed',
      actual_completion_date = current_date
  where id = plan_id
    and status <> 'cancelled';

  update public.procurement_dossiers
  set stage = 'adjudicada',
      award = jsonb_build_object(
        'supplier_id', bid.supplier_id,
        'amount', bid.amount,
        'currency', bid.currency,
        'budget', lic.baseline_amount,
        'baseline', lic.baseline_amount,
        'target_savings', target_savings,
        'estimated_savings', estimated,
        'realized_savings', null,
        'savings_note', note,
        'award_id', award_id
      ),
      updated_at = now()
  where licitacion_id = lic.id
     or offer_event_id = packet.event_id;

  insert into public.offer_audit (company_id, event_id, supplier_id, actor_id, action, detail)
  values (
    decision.company_id, packet.event_id, bid.supplier_id, auth.uid(), 'award_formal',
    'Adjudicación formal por ' || bid.amount::text || ' ' || bid.currency || '. ' || note
  );
  return award_id;
end;
$$;

revoke all on function public.finalize_award(uuid, text) from public, anon;
grant execute on function public.finalize_award(uuid, text) to authenticated;

alter table public.award_policies enable row level security;
alter table public.decision_packets enable row level security;
alter table public.award_decisions enable row level security;
alter table public.award_votes enable row level security;
alter table public.process_awards enable row level security;

revoke all on public.award_policies, public.decision_packets, public.award_decisions, public.award_votes, public.process_awards from anon;
grant select, insert, update on public.award_policies to authenticated;
grant select, insert, update on public.decision_packets to authenticated;
grant select on public.award_decisions to authenticated;
grant select, insert on public.award_votes to authenticated;
grant select on public.process_awards to authenticated;

drop policy if exists award_policies_company on public.award_policies;
create policy award_policies_company
on public.award_policies for all to authenticated
using (
  company_id = private.current_company_id()
  and private.current_supplier_id() is null
)
with check (
  company_id = private.current_company_id()
  and private.current_role() = 'admin'
  and private.current_supplier_id() is null
);

drop policy if exists decision_packets_company on public.decision_packets;
create policy decision_packets_company
on public.decision_packets for select to authenticated
using (
  company_id = private.current_company_id()
  and private.current_supplier_id() is null
);

drop policy if exists decision_packets_insert on public.decision_packets;
create policy decision_packets_insert
on public.decision_packets for insert to authenticated
with check (
  company_id = private.current_company_id()
  and prepared_by = auth.uid()
  and private.current_supplier_id() is null
  and private.current_role() in ('admin', 'manager', 'analyst')
);

drop policy if exists decision_packets_update on public.decision_packets;
create policy decision_packets_update
on public.decision_packets for update to authenticated
using (
  company_id = private.current_company_id()
  and private.current_supplier_id() is null
)
with check (
  company_id = private.current_company_id()
  and private.current_supplier_id() is null
);

drop policy if exists award_decisions_company on public.award_decisions;
create policy award_decisions_company
on public.award_decisions for select to authenticated
using (
  company_id = private.current_company_id()
  and private.current_supplier_id() is null
);

drop policy if exists award_votes_company on public.award_votes;
create policy award_votes_company
on public.award_votes for select to authenticated
using (
  exists (
    select 1 from public.award_decisions d
    where d.id = award_votes.decision_id
      and d.company_id = private.current_company_id()
      and private.current_supplier_id() is null
  )
);

drop policy if exists award_votes_insert on public.award_votes;
create policy award_votes_insert
on public.award_votes for insert to authenticated
with check (
  voter_id = auth.uid()
  and exists (
    select 1 from public.award_decisions d
    where d.id = award_votes.decision_id
      and d.company_id = private.current_company_id()
      and private.current_supplier_id() is null
  )
);

drop policy if exists process_awards_company on public.process_awards;
create policy process_awards_company
on public.process_awards for select to authenticated
using (
  company_id = private.current_company_id()
  and private.current_supplier_id() is null
);
