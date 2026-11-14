-- Estructuras que existen en el proyecto Supabase antiguo y que el código ya usa.
-- Idempotente: no altera filas existentes. Los datos históricos se cargan aparte.

begin;

create table if not exists public.permissions (
  company_id uuid not null references public.companies(id) on delete cascade,
  id text not null,
  name text not null,
  description text,
  category text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (company_id, id)
);

create index if not exists idx_permissions_company on public.permissions (company_id);
create index if not exists idx_permissions_category on public.permissions (category);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null check (role = any (array['admin','manager','analyst','viewer'])),
  permission_id text not null,
  granted boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint unique_role_permission unique (company_id, role, permission_id),
  constraint role_permissions_permission_fk
    foreign key (company_id, permission_id)
    references public.permissions (company_id, id)
    on delete cascade
);

create index if not exists idx_role_permissions_company on public.role_permissions (company_id);
create index if not exists idx_role_permissions_role on public.role_permissions (role);
create index if not exists idx_role_permissions_permission on public.role_permissions (permission_id);

create table if not exists public.spend_closures (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  period text not null,
  currency text not null default 'CLP',
  source text not null check (source = any (array['si_spend_lines','spend_data'])),
  line_count integer not null default 0,
  total_amount numeric(18,2) not null default 0,
  closed_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz not null default now(),
  constraint spend_closures_company_id_period_currency_key unique (company_id, period, currency)
);

drop trigger if exists trigger_update_permissions_updated_at on public.permissions;
create trigger trigger_update_permissions_updated_at
  before update on public.permissions
  for each row execute function public.handle_updated_at();

drop trigger if exists trigger_update_role_permissions_updated_at on public.role_permissions;
create trigger trigger_update_role_permissions_updated_at
  before update on public.role_permissions
  for each row execute function public.handle_updated_at();

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.spend_closures enable row level security;

revoke all on public.permissions, public.role_permissions, public.spend_closures from anon;
grant select, insert, update, delete on public.permissions, public.role_permissions, public.spend_closures to authenticated;

drop policy if exists "Users can view permissions from their company" on public.permissions;
create policy "Users can view permissions from their company"
  on public.permissions for select to authenticated
  using (
    company_id = private.current_company_id()
    or private.is_platform_admin()
  );

drop policy if exists "Admins can manage permissions" on public.permissions;
create policy "Admins can manage permissions"
  on public.permissions for all to authenticated
  using (
    private.is_platform_admin()
    or (
      company_id = private.current_company_id()
      and private.current_role() in ('admin', 'super_admin')
    )
  )
  with check (
    private.is_platform_admin()
    or (
      company_id = private.current_company_id()
      and private.current_role() in ('admin', 'super_admin')
    )
  );

drop policy if exists "Users can view role permissions from their company" on public.role_permissions;
create policy "Users can view role permissions from their company"
  on public.role_permissions for select to authenticated
  using (
    company_id = private.current_company_id()
    or private.is_platform_admin()
  );

drop policy if exists "Admins can manage role permissions" on public.role_permissions;
create policy "Admins can manage role permissions"
  on public.role_permissions for all to authenticated
  using (
    private.is_platform_admin()
    or (
      company_id = private.current_company_id()
      and private.current_role() in ('admin', 'super_admin')
    )
  )
  with check (
    private.is_platform_admin()
    or (
      company_id = private.current_company_id()
      and private.current_role() in ('admin', 'super_admin')
    )
  );

drop policy if exists spend_closures_company on public.spend_closures;
create policy spend_closures_company
  on public.spend_closures for all to authenticated
  using (
    company_id = private.current_company_id()
    or private.is_platform_admin()
  )
  with check (
    company_id = private.current_company_id()
    or private.is_platform_admin()
  );

commit;
