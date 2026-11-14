-- Ofertas técnicas y económicas, NDA de acceso y sobre cerrado.
-- El comprador ve que hubo una presentación. El contenido se abre solo con apertura autorizada.

alter table public.offer_events
  add column if not exists nda_required boolean not null default false,
  add column if not exists nda_text text,
  add column if not exists nda_version text not null default '1',
  add column if not exists offers_opened_at timestamptz,
  add column if not exists offers_opened_by uuid;

alter table public.offer_bids
  add column if not exists status text,
  add column if not exists version integer not null default 1,
  add column if not exists currency text,
  add column if not exists technical_summary text;

update public.offer_bids
set status = 'submitted'
where status is null;

alter table public.offer_bids
  alter column status set default 'draft',
  alter column status set not null,
  alter column amount drop not null;

alter table public.offer_bids drop constraint if exists offer_bids_amount_check;
alter table public.offer_bids
  add constraint offer_bids_amount_check check (amount is null or amount > 0),
  add constraint offer_bids_status_check check (status in ('draft', 'submitted'));

create table if not exists public.offer_bid_lines (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.offer_bids(id) on delete cascade,
  event_id uuid not null references public.offer_events(id) on delete cascade,
  supplier_id text not null references public.suppliers(id) on delete cascade,
  position integer not null default 1,
  description text not null,
  quantity numeric(15,4) not null check (quantity > 0),
  unit text not null,
  unit_price numeric(15,2) not null check (unit_price >= 0),
  currency text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.offer_bid_answers (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.offer_bids(id) on delete cascade,
  event_id uuid not null references public.offer_events(id) on delete cascade,
  supplier_id text not null references public.suppliers(id) on delete cascade,
  requirement_key text not null,
  response text not null,
  unique (bid_id, requirement_key)
);

create table if not exists public.offer_bid_files (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.offer_bids(id) on delete cascade,
  event_id uuid not null references public.offer_events(id) on delete cascade,
  supplier_id text not null references public.suppliers(id) on delete cascade,
  kind text not null check (kind in ('technical', 'economic')),
  storage_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.nda_acceptances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  event_id uuid not null references public.offer_events(id) on delete cascade,
  supplier_id text not null references public.suppliers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_version text not null,
  method text not null default 'accepted' check (method = 'accepted'),
  accepted_at timestamptz not null default now(),
  unique (event_id, supplier_id, document_version)
);

create table if not exists public.offer_audit (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  event_id uuid not null references public.offer_events(id) on delete cascade,
  supplier_id text,
  actor_id uuid,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create or replace function private.buyer_can_read_offer_content(target_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.offer_events e
    where e.id = target_event
      and private.current_user_manages_offer_event(target_event)
      and (
        (e.modality = 'sealed' and e.offers_opened_at is not null)
        or e.modality in ('reverse_auction', 'adhesion')
        or (e.modality = 'rounds' and e.status in ('closed', 'awarded'))
      )
  )
$$;

create or replace function private.supplier_may_read_tender(target_licitacion text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_current_supplier_invited(private.current_company_id(), target_licitacion)
    and not exists (
      select 1
      from public.offer_events e
      join public.offer_invitations i on i.event_id = e.id
      where e.licitacion_id = target_licitacion
        and i.supplier_id = private.current_supplier_id()
        and e.nda_required
        and not exists (
          select 1
          from public.nda_acceptances a
          where a.event_id = e.id
            and a.supplier_id = i.supplier_id
            and a.document_version = e.nda_version
        )
    )
$$;

create or replace function private.reception_is_open(target_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.offer_events e
    where e.id = target_event
      and e.status = 'open'
      and (e.closes_at is null or e.closes_at > now())
  )
$$;

create or replace function private.guard_offer_bid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  total numeric;
begin
  if not private.reception_is_open(new.event_id) then
    raise exception 'La recepción está cerrada';
  end if;
  if tg_op = 'UPDATE' and old.status = 'submitted' then
    raise exception 'No se puede modificar una oferta ya presentada';
  end if;
  if new.status = 'submitted' then
    if coalesce(length(trim(new.technical_summary)), 0) < 10 then
      raise exception 'La oferta técnica debe describir cómo se ejecutará el servicio';
    end if;
    select coalesce(sum(quantity * unit_price), 0)
      into total
      from public.offer_bid_lines
      where bid_id = new.id;
    if total <= 0 then
      raise exception 'La oferta económica necesita al menos una partida con precio';
    end if;
    new.amount := round(total, 2);
    new.submitted_at := now();
    insert into public.offer_audit (company_id, event_id, supplier_id, actor_id, action, detail)
    select e.company_id, new.event_id, new.supplier_id, auth.uid(), 'bid_submitted',
      'Versión ' || new.version::text || ' por ' || new.amount::text || ' ' || coalesce(new.currency, e.currency)
    from public.offer_events e
    where e.id = new.event_id;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_offer_bid on public.offer_bids;
create trigger guard_offer_bid
before insert or update on public.offer_bids
for each row execute function private.guard_offer_bid();

create or replace function private.guard_offer_bid_line()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent public.offer_bids;
begin
  select * into parent from public.offer_bids where id = new.bid_id;
  if parent.id is null or parent.status <> 'draft' then
    raise exception 'La oferta ya fue presentada';
  end if;
  if not private.reception_is_open(parent.event_id) then
    raise exception 'La recepción está cerrada';
  end if;
  if new.supplier_id <> parent.supplier_id or new.event_id <> parent.event_id then
    raise exception 'La partida no corresponde a la oferta';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_offer_bid_line on public.offer_bid_lines;
create trigger guard_offer_bid_line
before insert or update on public.offer_bid_lines
for each row execute function private.guard_offer_bid_line();

drop trigger if exists guard_offer_bid_answer on public.offer_bid_answers;
create trigger guard_offer_bid_answer
before insert or update on public.offer_bid_answers
for each row execute function private.guard_offer_bid_line();

drop trigger if exists guard_offer_bid_file on public.offer_bid_files;
create trigger guard_offer_bid_file
before insert or update on public.offer_bid_files
for each row execute function private.guard_offer_bid_line();

create or replace function private.guard_offer_opening()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.offers_opened_at is not null and old.offers_opened_at is null then
    if old.status not in ('closed', 'awarded') then
      raise exception 'Cierra la recepción antes de abrir los sobres';
    end if;
    if new.modality = 'sealed' or old.modality = 'sealed' then
      insert into public.offer_audit (company_id, event_id, actor_id, action, detail)
      values (new.company_id, new.id, auth.uid(), 'offers_opened', 'Apertura autorizada de sobres');
    end if;
  end if;
  if new.status = 'closed' and old.status is distinct from 'closed' then
    insert into public.offer_audit (company_id, event_id, actor_id, action, detail)
    values (new.company_id, new.id, auth.uid(), 'reception_closed', 'Recepción cerrada');
  end if;
  return new;
end;
$$;

drop trigger if exists guard_offer_opening on public.offer_events;
create trigger guard_offer_opening
before update on public.offer_events
for each row execute function private.guard_offer_opening();

create or replace function public.list_offer_submissions(target_event uuid)
returns table (
  supplier_id text,
  status text,
  submitted_at timestamptz,
  version integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.supplier_id, b.status, b.submitted_at, b.version
  from public.offer_bids b
  where b.event_id = target_event
    and b.status = 'submitted'
    and (
      b.supplier_id = private.current_supplier_id()
      or private.current_user_manages_offer_event(target_event)
    )
$$;

revoke all on function public.list_offer_submissions(uuid) from public, anon;
grant execute on function public.list_offer_submissions(uuid) to authenticated;
revoke all on function private.buyer_can_read_offer_content(uuid) from public, anon;
revoke all on function private.supplier_may_read_tender(text) from public, anon;
revoke all on function private.reception_is_open(uuid) from public, anon;
grant execute on function private.buyer_can_read_offer_content(uuid) to authenticated;
grant execute on function private.supplier_may_read_tender(text) to authenticated;
grant execute on function private.reception_is_open(uuid) to authenticated;

alter table public.offer_bid_lines enable row level security;
alter table public.offer_bid_files enable row level security;
alter table public.offer_bid_answers enable row level security;
alter table public.nda_acceptances enable row level security;
alter table public.offer_audit enable row level security;

drop policy if exists offer_bids_select on public.offer_bids;
create policy offer_bids_select
on public.offer_bids for select to authenticated
using (
  supplier_id = private.current_supplier_id()
  or private.buyer_can_read_offer_content(event_id)
);

drop policy if exists offer_bids_insert on public.offer_bids;
create policy offer_bids_insert
on public.offer_bids for insert to authenticated
with check (
  supplier_id = private.current_supplier_id()
  and status = 'draft'
  and private.reception_is_open(event_id)
  and exists (
    select 1
    from public.offer_invitations i
    where i.event_id = offer_bids.event_id
      and i.supplier_id = offer_bids.supplier_id
      and i.status in ('invited', 'accepted')
  )
);

drop policy if exists offer_bids_update on public.offer_bids;
create policy offer_bids_update
on public.offer_bids for update to authenticated
using (
  supplier_id = private.current_supplier_id()
  and status = 'draft'
  and private.reception_is_open(event_id)
)
with check (
  supplier_id = private.current_supplier_id()
  and status in ('draft', 'submitted')
);

drop policy if exists offer_bid_lines_select on public.offer_bid_lines;
create policy offer_bid_lines_select
on public.offer_bid_lines for select to authenticated
using (
  supplier_id = private.current_supplier_id()
  or private.buyer_can_read_offer_content(event_id)
);

drop policy if exists offer_bid_lines_write on public.offer_bid_lines;
create policy offer_bid_lines_write
on public.offer_bid_lines for all to authenticated
using (supplier_id = private.current_supplier_id())
with check (supplier_id = private.current_supplier_id());

drop policy if exists offer_bid_files_select on public.offer_bid_files;
create policy offer_bid_files_select
on public.offer_bid_files for select to authenticated
using (
  supplier_id = private.current_supplier_id()
  or private.buyer_can_read_offer_content(event_id)
);

drop policy if exists offer_bid_files_write on public.offer_bid_files;
create policy offer_bid_files_write
on public.offer_bid_files for all to authenticated
using (supplier_id = private.current_supplier_id())
with check (supplier_id = private.current_supplier_id());

drop policy if exists offer_bid_answers_select on public.offer_bid_answers;
create policy offer_bid_answers_select
on public.offer_bid_answers for select to authenticated
using (
  supplier_id = private.current_supplier_id()
  or private.buyer_can_read_offer_content(event_id)
);

drop policy if exists offer_bid_answers_write on public.offer_bid_answers;
create policy offer_bid_answers_write
on public.offer_bid_answers for all to authenticated
using (supplier_id = private.current_supplier_id())
with check (supplier_id = private.current_supplier_id());

drop policy if exists nda_acceptances_select on public.nda_acceptances;
create policy nda_acceptances_select
on public.nda_acceptances for select to authenticated
using (
  supplier_id = private.current_supplier_id()
  or private.current_user_manages_offer_event(event_id)
);

drop policy if exists nda_acceptances_insert on public.nda_acceptances;
create policy nda_acceptances_insert
on public.nda_acceptances for insert to authenticated
with check (
  supplier_id = private.current_supplier_id()
  and user_id = auth.uid()
  and company_id = private.current_company_id()
  and exists (
    select 1
    from public.offer_invitations i
    where i.event_id = nda_acceptances.event_id
      and i.supplier_id = nda_acceptances.supplier_id
  )
);

drop policy if exists offer_invitations_supplier_update on public.offer_invitations;
create policy offer_invitations_supplier_update
on public.offer_invitations for update to authenticated
using (supplier_id = private.current_supplier_id())
with check (
  supplier_id = private.current_supplier_id()
  and status in ('accepted', 'declined')
);

drop policy if exists offer_audit_select on public.offer_audit;
create policy offer_audit_select
on public.offer_audit for select to authenticated
using (
  private.current_user_manages_offer_event(event_id)
  or supplier_id = private.current_supplier_id()
);

grant select, insert, update, delete on public.offer_bid_lines to authenticated;
grant select, insert, update, delete on public.offer_bid_files to authenticated;
grant select, insert, update, delete on public.offer_bid_answers to authenticated;
grant select, insert on public.nda_acceptances to authenticated;
grant select on public.offer_audit to authenticated;
revoke all on public.offer_bid_lines, public.offer_bid_files, public.offer_bid_answers, public.nda_acceptances, public.offer_audit from anon;

drop policy if exists documents_select_tenant on storage.objects;
create policy documents_select_tenant
on storage.objects for select to authenticated
using (
  bucket_id = 'documents'
  and private.storage_company_id(name) = private.current_company_id()
  and (
    (
      private.current_supplier_id() is null
      and (
        split_part(name, '/', 2) <> 'ofertas'
        or exists (
          select 1
          from public.offer_events e
          where e.id::text = split_part(name, '/', 3)
            and e.offers_opened_at is not null
            and private.current_user_manages_offer_event(e.id)
        )
      )
    )
    or (
      split_part(name, '/', 2) = 'licitaciones'
      and private.supplier_may_read_tender(split_part(name, '/', 3))
    )
    or (
      split_part(name, '/', 2) = 'ofertas'
      and split_part(name, '/', 4) = private.current_supplier_id()
    )
  )
);

drop policy if exists documents_insert_offer_file on storage.objects;
create policy documents_insert_offer_file
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documents'
  and split_part(name, '/', 2) = 'ofertas'
  and split_part(name, '/', 4) = private.current_supplier_id()
  and private.current_supplier_id() is not null
  and private.storage_company_id(name) = private.current_company_id()
  and private.reception_is_open(split_part(name, '/', 3)::uuid)
);

create unique index if not exists offer_bids_one_per_supplier
  on public.offer_bids (event_id, supplier_id);

create or replace function private.audit_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.offer_audit (company_id, event_id, supplier_id, actor_id, action, detail)
  select e.company_id, new.event_id, new.supplier_id, auth.uid(),
    case
      when tg_op = 'INSERT' then 'invited'
      when new.status = 'accepted' then 'invitation_accepted'
      when new.status = 'declined' then 'invitation_declined'
      else 'invitation_updated'
    end,
    coalesce(new.contact_email, new.status)
  from public.offer_events e
  where e.id = new.event_id;
  return new;
end;
$$;

drop trigger if exists audit_invitation on public.offer_invitations;
create trigger audit_invitation
after insert or update of status on public.offer_invitations
for each row execute function private.audit_invitation();

create or replace function private.audit_nda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.offer_audit (company_id, event_id, supplier_id, actor_id, action, detail)
  values (new.company_id, new.event_id, new.supplier_id, new.user_id, 'nda_accepted', 'Versión ' || new.document_version || '. Aceptación, no firma electrónica.');
  return new;
end;
$$;

drop trigger if exists audit_nda on public.nda_acceptances;
create trigger audit_nda
after insert on public.nda_acceptances
for each row execute function private.audit_nda();
