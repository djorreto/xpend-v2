-- Enums
create type user_role as enum ('admin','manager','analyst','viewer');
create type project_status as enum ('planning','active','on_hold','completed','cancelled');
create type phase_status as enum ('not_started','in_progress','completed','blocked');
create type licitacion_status as enum ('planned','bases_review','published','evaluation','awarded','contract_signed');
create type licitacion_type as enum ('RFP','RFQ','RFI');
create type licitacion_category as enum ('recurring_service','non_recurring_service','improvement_project','construction_project');
create type baseline_source as enum ('historical','budget','other');

-- Companies
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  logo_url text,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Profiles (1:1 con auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  company_id uuid references public.companies(id) on delete set null,
  role user_role default 'viewer',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Departments/Gerencias (configurable por empresa)
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(company_id, name)
);

-- Proyectos
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  company_id uuid not null references public.companies(id) on delete cascade,
  status project_status default 'planning',
  start_date date not null,
  end_date date,
  budget numeric(15,2),
  currency text default 'USD',
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Fases del proyecto (con sort_order en vez de "order")
create table if not exists public.project_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  start_date date not null,
  end_date date not null,
  status phase_status default 'not_started',
  sort_order integer not null,          -- ← renombrado
  dependencies uuid[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Hitos
create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase_id uuid references public.project_phases(id) on delete set null,
  name text not null,
  description text,
  due_date date not null,
  completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Archivos
create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  file_path text not null,
  file_size bigint not null,
  mime_type text not null,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- Comentarios (chat)
create table if not exists public.project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  parent_id uuid references public.project_comments(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Licitaciones
create table if not exists public.licitaciones (
  id text primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  status licitacion_status default 'planned',
  type licitacion_type,
  category licitacion_category,
  
  -- Baseline y montos
  baseline_currency text default 'USD',
  baseline_amount numeric(15,2),
  baseline_source baseline_source,
  awarded_amount numeric(15,2),
  savings_amount numeric(15,2), -- Calculado: baseline_amount - awarded_amount
  savings_percentage numeric(5,2), -- Calculado: (savings_amount / baseline_amount) * 100
  
  -- Gerencia y responsable
  department_id uuid references public.departments(id) on delete set null,
  responsible_user_id uuid references public.profiles(id) on delete set null,
  
  -- Fechas del proceso
  request_date date,
  publication_date date,
  questions_date date,
  answers_date date,
  proposal_reception_date date,
  proposal_closing_date date,
  committee_date date,
  award_date date,
  contract_signature_date date,
  
  -- Documentos
  tender_document_path text, -- Archivo de bases (hasta 100MB)
  tender_document_name text,
  tender_document_size bigint,
  tender_link text, -- Enlace a drive con anexos
  
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Documentos de licitación (adicionales a las bases)
create table if not exists public.licitacion_documents (
  id uuid primary key default gen_random_uuid(),
  licitacion_id text not null references public.licitaciones(id) on delete cascade,
  name text not null,
  file_path text not null,
  file_size bigint not null,
  mime_type text not null,
  version integer not null default 1,
  is_current boolean default true,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- Spend
create table if not exists public.spend_data (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category text not null,
  subcategory text,
  supplier text not null,
  amount numeric(15,2) not null,
  currency text default 'USD',
  date date not null,
  description text,
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.spend_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  parent_id uuid references public.spend_categories(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Índices
create index if not exists idx_profiles_company_id on public.profiles(company_id);
create index if not exists idx_departments_company_id on public.departments(company_id);
create index if not exists idx_projects_company_id on public.projects(company_id);
create index if not exists idx_projects_status on public.projects(status);
create index if not exists idx_project_phases_project_id on public.project_phases(project_id);
create index if not exists idx_project_milestones_project_id on public.project_milestones(project_id);
create index if not exists idx_project_files_project_id on public.project_files(project_id);
create index if not exists idx_project_comments_project_id on public.project_comments(project_id);
create index if not exists idx_licitaciones_company_id on public.licitaciones(company_id);
create index if not exists idx_licitaciones_status on public.licitaciones(status);
create index if not exists idx_licitacion_documents_licitacion_id on public.licitacion_documents(licitacion_id);
create index if not exists idx_spend_data_company_id on public.spend_data(company_id);
create index if not exists idx_spend_data_category on public.spend_data(category);
create index if not exists idx_spend_data_supplier on public.spend_data(supplier);
create index if not exists idx_spend_data_date on public.spend_data(date);
create index if not exists idx_spend_categories_company_id on public.spend_categories(company_id);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- Calculate savings for licitaciones
create or replace function public.calculate_licitacion_savings()
returns trigger language plpgsql as $$
begin
  if new.baseline_amount is not null and new.awarded_amount is not null then
    new.savings_amount = new.baseline_amount - new.awarded_amount;
    if new.baseline_amount > 0 then
      new.savings_percentage = (new.savings_amount / new.baseline_amount) * 100;
    else
      new.savings_percentage = 0;
    end if;
  else
    new.savings_amount = null;
    new.savings_percentage = null;
  end if;
  return new;
end; $$;

create trigger trg_companies_touch before update on public.companies
for each row execute function public.touch_updated_at();

create trigger trg_profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger trg_departments_touch before update on public.departments
for each row execute function public.touch_updated_at();

create trigger trg_projects_touch before update on public.projects
for each row execute function public.touch_updated_at();

create trigger trg_project_phases_touch before update on public.project_phases
for each row execute function public.touch_updated_at();

create trigger trg_project_milestones_touch before update on public.project_milestones
for each row execute function public.touch_updated_at();

create trigger trg_project_comments_touch before update on public.project_comments
for each row execute function public.touch_updated_at();

create trigger trg_licitaciones_touch before update on public.licitaciones
for each row execute function public.touch_updated_at();

create trigger trg_licitaciones_calculate_savings before insert or update on public.licitaciones
for each row execute function public.calculate_licitacion_savings();

create trigger trg_spend_data_touch before update on public.spend_data
for each row execute function public.touch_updated_at();

create trigger trg_spend_categories_touch before update on public.spend_categories
for each row execute function public.touch_updated_at();

-- RLS
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.projects enable row level security;
alter table public.project_phases enable row level security;
alter table public.project_milestones enable row level security;
alter table public.project_files enable row level security;
alter table public.project_comments enable row level security;
alter table public.licitaciones enable row level security;
alter table public.licitacion_documents enable row level security;
alter table public.spend_data enable row level security;
alter table public.spend_categories enable row level security;

-- Autocrear profile al crear usuario
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Policies

-- profiles: cada uno ve/edita su propio perfil
create policy "profiles_select_self"
on public.profiles for select
using (auth.uid() = id);

create policy "profiles_update_self"
on public.profiles for update
using (auth.uid() = id);

-- companies: ver solo la propia (según profile)
create policy "companies_select_by_member"
on public.companies for select
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = companies.id
));

-- departments: todos los de la empresa pueden ver y admin/manager pueden modificar
create policy "departments_select_by_company"
on public.departments for select
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = departments.company_id
));

create policy "departments_write_by_company"
on public.departments for insert
with check (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = departments.company_id
));

create policy "departments_update_by_company"
on public.departments for update
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = departments.company_id
));

create policy "departments_delete_by_company"
on public.departments for delete
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = departments.company_id
));

-- projects: restringir por company del profile
create policy "projects_select_by_company"
on public.projects for select
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = projects.company_id
));

create policy "projects_write_by_company"
on public.projects for insert
with check (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = projects.company_id
));

create policy "projects_update_by_company"
on public.projects for update
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = projects.company_id
));

-- Aplica el mismo patrón a tablas hijas por project_id o company_id:

create policy "phases_select_by_project_company"
on public.project_phases for select
using (exists (
  select 1
  from public.projects pr
  join public.profiles p on p.company_id = pr.company_id and p.id = auth.uid()
  where pr.id = project_phases.project_id
));

create policy "phases_write_by_project_company"
on public.project_phases for insert
with check (exists (
  select 1
  from public.projects pr
  join public.profiles p on p.company_id = pr.company_id and p.id = auth.uid()
  where pr.id = project_phases.project_id
));

create policy "phases_update_by_project_company"
on public.project_phases for update
using (exists (
  select 1
  from public.projects pr
  join public.profiles p on p.company_id = pr.company_id and p.id = auth.uid()
  where pr.id = project_phases.project_id
));

-- Milestones policies
create policy "milestones_select_by_project_company"
on public.project_milestones for select
using (exists (
  select 1
  from public.projects pr
  join public.profiles p on p.company_id = pr.company_id and p.id = auth.uid()
  where pr.id = project_milestones.project_id
));

create policy "milestones_write_by_project_company"
on public.project_milestones for insert
with check (exists (
  select 1
  from public.projects pr
  join public.profiles p on p.company_id = pr.company_id and p.id = auth.uid()
  where pr.id = project_milestones.project_id
));

create policy "milestones_update_by_project_company"
on public.project_milestones for update
using (exists (
  select 1
  from public.projects pr
  join public.profiles p on p.company_id = pr.company_id and p.id = auth.uid()
  where pr.id = project_milestones.project_id
));

-- Project files policies
create policy "project_files_select_by_project_company"
on public.project_files for select
using (exists (
  select 1
  from public.projects pr
  join public.profiles p on p.company_id = pr.company_id and p.id = auth.uid()
  where pr.id = project_files.project_id
));

create policy "project_files_write_by_project_company"
on public.project_files for insert
with check (exists (
  select 1
  from public.projects pr
  join public.profiles p on p.company_id = pr.company_id and p.id = auth.uid()
  where pr.id = project_files.project_id
));

create policy "project_files_delete_by_project_company"
on public.project_files for delete
using (exists (
  select 1
  from public.projects pr
  join public.profiles p on p.company_id = pr.company_id and p.id = auth.uid()
  where pr.id = project_files.project_id
));

-- Project comments policies
create policy "project_comments_select_by_project_company"
on public.project_comments for select
using (exists (
  select 1
  from public.projects pr
  join public.profiles p on p.company_id = pr.company_id and p.id = auth.uid()
  where pr.id = project_comments.project_id
));

create policy "project_comments_write_by_project_company"
on public.project_comments for insert
with check (exists (
  select 1
  from public.projects pr
  join public.profiles p on p.company_id = pr.company_id and p.id = auth.uid()
  where pr.id = project_comments.project_id
));

create policy "project_comments_update_by_project_company"
on public.project_comments for update
using (exists (
  select 1
  from public.projects pr
  join public.profiles p on p.company_id = pr.company_id and p.id = auth.uid()
  where pr.id = project_comments.project_id
));

-- Licitaciones policies
create policy "licitaciones_select_by_company"
on public.licitaciones for select
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = licitaciones.company_id
));

create policy "licitaciones_write_by_company"
on public.licitaciones for insert
with check (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = licitaciones.company_id
));

create policy "licitaciones_update_by_company"
on public.licitaciones for update
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = licitaciones.company_id
));

create policy "licitaciones_delete_by_company"
on public.licitaciones for delete
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = licitaciones.company_id
));

-- Licitacion documents policies
create policy "licitacion_documents_select_by_company"
on public.licitacion_documents for select
using (exists (
  select 1
  from public.licitaciones l
  join public.profiles p on p.company_id = l.company_id and p.id = auth.uid()
  where l.id = licitacion_documents.licitacion_id
));

create policy "licitacion_documents_write_by_company"
on public.licitacion_documents for insert
with check (exists (
  select 1
  from public.licitaciones l
  join public.profiles p on p.company_id = l.company_id and p.id = auth.uid()
  where l.id = licitacion_documents.licitacion_id
));

create policy "licitacion_documents_delete_by_company"
on public.licitacion_documents for delete
using (exists (
  select 1
  from public.licitaciones l
  join public.profiles p on p.company_id = l.company_id and p.id = auth.uid()
  where l.id = licitacion_documents.licitacion_id
));

-- Spend data policies
create policy "spend_data_select_by_company"
on public.spend_data for select
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = spend_data.company_id
));

create policy "spend_data_write_by_company"
on public.spend_data for insert
with check (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = spend_data.company_id
));

create policy "spend_data_update_by_company"
on public.spend_data for update
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = spend_data.company_id
));

-- Spend categories policies
create policy "spend_categories_select_by_company"
on public.spend_categories for select
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = spend_categories.company_id
));

create policy "spend_categories_write_by_company"
on public.spend_categories for insert
with check (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = spend_categories.company_id
));

create policy "spend_categories_update_by_company"
on public.spend_categories for update
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = spend_categories.company_id
));
