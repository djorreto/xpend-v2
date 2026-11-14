-- Contratos independientes de una licitación. Local de Fase 1.

create table if not exists public.contract_policies (
  company_id uuid primary key references public.companies(id) on delete cascade,
  allow_self_approval boolean not null default false,
  legal_review_required boolean not null default false,
  approver_roles text[] not null default array['admin', 'manager']::text[],
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  check (cardinality(approver_roles) > 0 and approver_roles <@ array['admin', 'manager']::text[])
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  contract_type text,
  supplier_id text references public.suppliers(id),
  counterparty_name text,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'active', 'expired', 'terminated')),
  origin text not null default 'upload' check (origin in ('upload', 'builder', 'award')),
  award_id uuid references public.process_awards(id),
  owner_id uuid references public.profiles(id),
  starts_on date,
  ends_on date,
  renewal text not null default 'unknown' check (renewal in ('automatic', 'manual', 'none', 'unknown')),
  notice_days integer,
  currency text,
  amount numeric(15,2),
  periodicity text,
  adjustment_terms text,
  payment_terms text,
  object_text text,
  scope_text text,
  notes text,
  tags text[] not null default '{}',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists public.contract_documents (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check (kind in ('original', 'annex', 'amendment', 'renewal', 'generated')),
  version integer not null check (version >= 1),
  file_name text not null,
  storage_path text not null,
  mime text,
  size_bytes integer,
  sha256 text,
  processing text not null default 'pending' check (processing in ('pending', 'processed', 'unprocessable')),
  extracted_text text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (contract_id, kind, version)
);

create table if not exists public.contract_extractions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  document_id uuid references public.contract_documents(id) on delete set null,
  field_key text not null,
  proposed_value text not null,
  confirmed_value text,
  source text not null default 'extracted' check (source in ('extracted', 'assisted', 'confirmed')),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  evidence_quote text not null,
  evidence_location text not null,
  review_status text not null default 'pending' check (review_status in ('pending', 'confirmed', 'corrected', 'rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.contract_findings (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  document_id uuid references public.contract_documents(id) on delete set null,
  kind text not null,
  statement text not null,
  corrected_statement text,
  evidence_quote text not null,
  evidence_location text not null,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  review_status text not null default 'pending' check (review_status in ('pending', 'confirmed', 'corrected', 'rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.contract_clauses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_id uuid references public.contract_templates(id) on delete cascade,
  title text not null,
  body text not null,
  optional boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.contract_versions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  version integer not null check (version >= 1),
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved')),
  legal_note text,
  created_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (contract_id, version)
);

create or replace function private.guard_contract_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  policy public.contract_policies;
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
    new.approved_by := auth.uid();
    new.approved_at := now();
    update public.contracts
    set status = 'active', updated_at = now()
    where id = new.contract_id and status in ('draft', 'in_review');
  end if;
  return new;
end;
$$;

drop trigger if exists guard_contract_version on public.contract_versions;
create trigger guard_contract_version
before insert or update on public.contract_versions
for each row execute function private.guard_contract_version();

alter table public.contract_policies enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_documents enable row level security;
alter table public.contract_extractions enable row level security;
alter table public.contract_findings enable row level security;
alter table public.contract_templates enable row level security;
alter table public.contract_clauses enable row level security;
alter table public.contract_versions enable row level security;

revoke all on public.contract_policies, public.contracts, public.contract_documents, public.contract_extractions, public.contract_findings, public.contract_templates, public.contract_clauses, public.contract_versions from anon;
grant select, insert, update on public.contract_policies, public.contracts, public.contract_documents, public.contract_extractions, public.contract_findings, public.contract_templates, public.contract_clauses, public.contract_versions to authenticated;

drop policy if exists contracts_company on public.contracts;
create policy contracts_company on public.contracts for all to authenticated
using (company_id = private.current_company_id() and private.current_supplier_id() is null)
with check (company_id = private.current_company_id() and private.current_supplier_id() is null and private.current_role() in ('admin', 'manager', 'analyst'));

drop policy if exists contract_documents_company on public.contract_documents;
create policy contract_documents_company on public.contract_documents for all to authenticated
using (company_id = private.current_company_id() and private.current_supplier_id() is null)
with check (company_id = private.current_company_id() and private.current_supplier_id() is null and private.current_role() in ('admin', 'manager', 'analyst'));

drop policy if exists contract_extractions_company on public.contract_extractions;
create policy contract_extractions_company on public.contract_extractions for all to authenticated
using (exists (select 1 from public.contracts c where c.id = contract_id and c.company_id = private.current_company_id() and private.current_supplier_id() is null))
with check (exists (select 1 from public.contracts c where c.id = contract_id and c.company_id = private.current_company_id() and private.current_supplier_id() is null and private.current_role() in ('admin', 'manager', 'analyst')));

drop policy if exists contract_findings_company on public.contract_findings;
create policy contract_findings_company on public.contract_findings for all to authenticated
using (exists (select 1 from public.contracts c where c.id = contract_id and c.company_id = private.current_company_id() and private.current_supplier_id() is null))
with check (exists (select 1 from public.contracts c where c.id = contract_id and c.company_id = private.current_company_id() and private.current_supplier_id() is null and private.current_role() in ('admin', 'manager', 'analyst')));

drop policy if exists contract_templates_company on public.contract_templates;
create policy contract_templates_company on public.contract_templates for all to authenticated
using (company_id = private.current_company_id() and private.current_supplier_id() is null)
with check (company_id = private.current_company_id() and private.current_supplier_id() is null and private.current_role() in ('admin', 'manager', 'analyst'));

drop policy if exists contract_clauses_company on public.contract_clauses;
create policy contract_clauses_company on public.contract_clauses for all to authenticated
using (company_id = private.current_company_id() and private.current_supplier_id() is null)
with check (company_id = private.current_company_id() and private.current_supplier_id() is null and private.current_role() in ('admin', 'manager', 'analyst'));

drop policy if exists contract_versions_company on public.contract_versions;
create policy contract_versions_company on public.contract_versions for all to authenticated
using (company_id = private.current_company_id() and private.current_supplier_id() is null)
with check (company_id = private.current_company_id() and private.current_supplier_id() is null and private.current_role() in ('admin', 'manager', 'analyst'));

drop policy if exists contract_policies_company on public.contract_policies;
create policy contract_policies_company on public.contract_policies for all to authenticated
using (company_id = private.current_company_id() and private.current_supplier_id() is null)
with check (company_id = private.current_company_id() and private.current_role() = 'admin' and private.current_supplier_id() is null);
