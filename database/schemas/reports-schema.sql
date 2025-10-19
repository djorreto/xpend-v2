-- Tabla para almacenar reportes generados
create table if not exists public.reports (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null check (type in ('spend_analysis', 'project_status', 'vendor_performance', 'budget_tracking', 'compliance')),
  description text,
  status text not null default 'draft' check (status in ('draft', 'generating', 'completed', 'failed')),
  file_path text, -- Ruta del archivo generado en storage
  file_size bigint, -- Tamaño del archivo en bytes
  parameters jsonb, -- Parámetros usados para generar el reporte
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone
);

-- Índices para optimizar consultas
create index if not exists reports_company_id_idx on public.reports(company_id);
create index if not exists reports_created_by_idx on public.reports(created_by);
create index if not exists reports_type_idx on public.reports(type);
create index if not exists reports_status_idx on public.reports(status);
create index if not exists reports_created_at_idx on public.reports(created_at);

-- Trigger para updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger handle_reports_updated_at
  before update on public.reports
  for each row execute procedure public.handle_updated_at();

-- RLS Policies para reports
alter table public.reports enable row level security;

create policy "reports_select_by_company"
on public.reports for select
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = reports.company_id
));

create policy "reports_insert_by_company"
on public.reports for insert
with check (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = reports.company_id
));

create policy "reports_update_by_company"
on public.reports for update
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = reports.company_id
));

create policy "reports_delete_by_company"
on public.reports for delete
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = reports.company_id
));

-- Tabla para almacenar templates de reportes
create table if not exists public.report_templates (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null check (type in ('spend_analysis', 'project_status', 'vendor_performance', 'budget_tracking', 'compliance')),
  description text,
  template_config jsonb not null, -- Configuración del template
  is_default boolean default false,
  company_id uuid references public.companies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Índices para report_templates
create index if not exists report_templates_company_id_idx on public.report_templates(company_id);
create index if not exists report_templates_type_idx on public.report_templates(type);
create index if not exists report_templates_is_default_idx on public.report_templates(is_default);

-- Trigger para updated_at en report_templates
create trigger handle_report_templates_updated_at
  before update on public.report_templates
  for each row execute procedure public.handle_updated_at();

-- RLS Policies para report_templates
alter table public.report_templates enable row level security;

create policy "report_templates_select_by_company"
on public.report_templates for select
using (
  is_default = true or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.company_id = report_templates.company_id
  )
);

create policy "report_templates_insert_by_company"
on public.report_templates for insert
with check (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = report_templates.company_id
));

create policy "report_templates_update_by_company"
on public.report_templates for update
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = report_templates.company_id
));

create policy "report_templates_delete_by_company"
on public.report_templates for delete
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = report_templates.company_id
));

-- Insertar templates por defecto
insert into public.report_templates (name, type, description, template_config, is_default, created_by) values
(
  'Análisis de Gastos por Categoría',
  'spend_analysis',
  'Reporte detallado de gastos agrupados por categoría con gráficos y tendencias',
  '{
    "sections": ["summary", "by_category", "by_vendor", "trends", "recommendations"],
    "chart_types": ["pie", "bar", "line"],
    "date_range": "last_12_months",
    "include_charts": true,
    "include_details": true
  }',
  true,
  (select id from auth.users limit 1)
),
(
  'Estado de Proyectos Activos',
  'project_status',
  'Reporte del estado actual de todos los proyectos con métricas de progreso',
  '{
    "sections": ["overview", "by_status", "by_phase", "milestones", "risks"],
    "chart_types": ["bar", "gantt"],
    "include_milestones": true,
    "include_risks": true,
    "include_budget": true
  }',
  true,
  (select id from auth.users limit 1)
),
(
  'Rendimiento de Proveedores',
  'vendor_performance',
  'Evaluación del rendimiento de proveedores basado en métricas clave',
  '{
    "sections": ["summary", "performance_matrix", "compliance", "recommendations"],
    "chart_types": ["radar", "bar"],
    "metrics": ["delivery_time", "quality", "cost", "compliance"],
    "include_ratings": true
  }',
  true,
  (select id from auth.users limit 1)
),
(
  'Seguimiento de Presupuesto',
  'budget_tracking',
  'Control y seguimiento de presupuestos por proyecto y categoría',
  '{
    "sections": ["overview", "by_project", "by_category", "variances", "forecast"],
    "chart_types": ["bar", "line"],
    "include_forecast": true,
    "include_variances": true,
    "alert_threshold": 0.8
  }',
  true,
  (select id from auth.users limit 1)
);
