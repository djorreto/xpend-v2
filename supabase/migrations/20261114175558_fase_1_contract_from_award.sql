-- El contrato generado queda ligado a la adjudicación. Los hechos adjudicados no se reescriben.

alter table public.contracts
  add column if not exists licitacion_id text references public.licitaciones(id) on delete set null,
  add column if not exists event_id uuid references public.offer_events(id) on delete set null,
  add column if not exists bid_id uuid references public.offer_bids(id) on delete set null,
  add column if not exists dossier_id uuid references public.procurement_dossiers(id) on delete set null,
  add column if not exists source_snapshot jsonb;

alter table public.contract_versions
  add column if not exists variance_justification text;

alter table public.process_awards
  add column if not exists contract_id uuid references public.contracts(id) on delete set null;

create unique index if not exists process_awards_one_contract
  on public.process_awards (contract_id)
  where contract_id is not null;

create unique index if not exists contracts_one_open_per_award
  on public.contracts (award_id)
  where award_id is not null and status <> 'terminated';

create or replace function private.guard_process_award_facts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.amount is distinct from old.amount
    or new.currency is distinct from old.currency
    or new.estimated_savings is distinct from old.estimated_savings
    or new.supplier_id is distinct from old.supplier_id
    or new.bid_id is distinct from old.bid_id
    or new.licitacion_id is distinct from old.licitacion_id
    or new.decision_id is distinct from old.decision_id
  then
    raise exception 'La adjudicación no cambia cuando se edita el contrato';
  end if;
  if old.contract_id is not null and new.contract_id is distinct from old.contract_id then
    raise exception 'La adjudicación ya tiene un contrato';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_process_award_facts on public.process_awards;
create trigger guard_process_award_facts
before update on public.process_awards
for each row execute function private.guard_process_award_facts();

create or replace function private.guard_contract_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  policy public.contract_policies;
  source jsonb;
  awarded_amount numeric;
  awarded_currency text;
  awarded_supplier text;
begin
  insert into public.contract_policies (company_id) values (new.company_id) on conflict do nothing;
  if tg_op = 'UPDATE' and old.status = 'approved' and (
    new.body is distinct from old.body
    or new.version is distinct from old.version
    or new.contract_id is distinct from old.contract_id
  ) then
    raise exception 'La versión aprobada no se reescribe. Una edición crea la versión siguiente.';
  end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    select * into policy from public.contract_policies where company_id = new.company_id;
    if private.current_company_id() is distinct from new.company_id then
      raise exception 'El contrato es de otra empresa';
    end if;
    if private.current_supplier_id() is not null then
      raise exception 'Un proveedor no aprueba contratos internos';
    end if;
    if private.current_role() is null or not (private.current_role() = any (policy.approver_roles)) then
      raise exception 'Tu rol no está habilitado para aprobar contratos';
    end if;
    if new.created_by = auth.uid() and not policy.allow_self_approval then
      raise exception 'Quien redacta no puede aprobar su propia versión';
    end if;
    if policy.legal_review_required and coalesce(btrim(new.legal_note), '') = '' then
      raise exception 'La política exige una nota de revisión legal antes de aprobar';
    end if;
    select c.source_snapshot,
      nullif(c.source_snapshot->>'amount', '')::numeric,
      c.source_snapshot->>'currency',
      c.source_snapshot->>'supplierId'
    into source, awarded_amount, awarded_currency, awarded_supplier
    from public.contracts c
    where c.id = new.contract_id;
    if source is not null and (
      (select c.amount from public.contracts c where c.id = new.contract_id) is distinct from awarded_amount
      or upper(coalesce((select c.currency from public.contracts c where c.id = new.contract_id), '')) is distinct from upper(coalesce(awarded_currency, ''))
      or coalesce((select c.supplier_id from public.contracts c where c.id = new.contract_id), '') is distinct from coalesce(awarded_supplier, '')
    ) and coalesce(btrim(new.variance_justification), '') = '' then
      raise exception 'Las condiciones finales difieren de la adjudicación. Registra la diferencia para autorizar la aprobación.';
    end if;
    new.approved_by := auth.uid();
    new.approved_at := now();
    update public.contracts
    set status = 'active', updated_at = now()
    where id = new.contract_id and status in ('draft', 'in_review');
  end if;
  return new;
end;
$$;

create or replace function public.link_contract_to_award(target_award uuid, target_contract uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_company_id() is null or private.current_supplier_id() is not null then
    raise exception 'Sin permiso para vincular el contrato';
  end if;
  update public.process_awards
  set contract_id = target_contract
  where id = target_award
    and company_id = private.current_company_id()
    and contract_id is null
    and exists (
      select 1 from public.contracts c
      where c.id = target_contract
        and c.award_id = target_award
        and c.company_id = private.current_company_id()
    );
  if not found then
    raise exception 'No se pudo vincular el contrato a la adjudicación';
  end if;
end;
$$;

revoke all on function public.link_contract_to_award(uuid, uuid) from public, anon;
grant execute on function public.link_contract_to_award(uuid, uuid) to authenticated;
