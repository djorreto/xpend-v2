-- Revisión de la versión contractual y documentos finales. No abre otro circuito de aprobación.

alter table public.contract_versions drop constraint if exists contract_versions_status_check;
alter table public.contract_versions
  add constraint contract_versions_status_check
  check (status in ('draft', 'in_review', 'returned', 'approved'));

alter table public.contract_versions
  add column if not exists return_note text;

create table if not exists public.contract_reviews (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.contract_versions(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  author_id uuid references public.profiles(id),
  action text not null check (action in ('submitted', 'returned', 'approved')),
  note text,
  created_at timestamptz not null default now()
);

alter table public.contract_reviews enable row level security;
revoke all on public.contract_reviews from anon;
grant select on public.contract_reviews to authenticated;

drop policy if exists contract_reviews_company on public.contract_reviews;
create policy contract_reviews_company
on public.contract_reviews for select to authenticated
using (
  company_id = private.current_company_id()
  and private.current_supplier_id() is null
);

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
  if tg_op = 'UPDATE' and new.body is distinct from old.body and old.status <> 'draft' then
    raise exception 'Esta versión ya no se edita. Guarda una versión nueva.';
  end if;
  if tg_op = 'UPDATE' and old.status = 'approved' then
    raise exception 'La versión aprobada no se reescribe. Una edición crea la versión siguiente.';
  end if;
  if tg_op = 'UPDATE' and new.status = 'in_review' and old.status is distinct from 'draft' then
    raise exception 'Solo un borrador se envía a revisión';
  end if;
  if tg_op = 'UPDATE' and new.status = 'returned' and old.status is distinct from 'in_review' then
    raise exception 'Solo se devuelve una versión que está en revisión';
  end if;
  if new.status = 'returned' and coalesce(btrim(new.return_note), '') = '' then
    raise exception 'La devolución necesita una observación';
  end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'in_review') then
    raise exception 'Solo se aprueba la versión que está en revisión';
  end if;

  if new.status = 'returned' and (tg_op = 'INSERT' or old.status is distinct from 'returned') then
    select * into policy from public.contract_policies where company_id = new.company_id;
    if private.current_role() is null or not (private.current_role() = any (policy.approver_roles)) then
      raise exception 'Tu rol no está habilitado para devolver el contrato';
    end if;
    if new.created_by = auth.uid() then
      raise exception 'Quien redacta no devuelve su propia versión';
    end if;
    insert into public.contract_reviews (version_id, company_id, author_id, action, note)
    values (new.id, new.company_id, auth.uid(), 'returned', new.return_note);
  end if;

  if tg_op = 'UPDATE' and new.status = 'in_review' and old.status = 'draft' then
    insert into public.contract_reviews (version_id, company_id, author_id, action, note)
    values (new.id, new.company_id, auth.uid(), 'submitted', 'Enviada a revisión');
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
    insert into public.contract_reviews (version_id, company_id, author_id, action, note)
    values (new.id, new.company_id, auth.uid(), 'approved', coalesce(new.variance_justification, new.legal_note, 'Aprobada'));
    update public.contracts
    set status = 'active', updated_at = now()
    where id = new.contract_id and status in ('draft', 'in_review');
  end if;
  return new;
end;
$$;
