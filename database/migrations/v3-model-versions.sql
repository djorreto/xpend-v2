-- Versiones del clasificador de gasto.
-- El archivo del modelo no se pisa: cada versión es una fila.
-- is_active marca la que opera Xpend. Solo puede haber una.

create table if not exists public.si_model_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status text not null check (status in ('base', 'candidata', 'publicada', 'archivada')),
  is_active boolean not null default false,
  trained_at date,
  holdout_accuracy numeric,
  rows_count integer,
  class_count integer,
  notes text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create unique index if not exists si_model_versions_one_active
  on public.si_model_versions (is_active)
  where is_active;

alter table public.si_model_versions enable row level security;

drop policy if exists "super admin reads model versions" on public.si_model_versions;
create policy "super admin reads model versions"
  on public.si_model_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'super_admin'
    )
  );

drop policy if exists "super admin writes model versions" on public.si_model_versions;
create policy "super admin writes model versions"
  on public.si_model_versions for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'super_admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'super_admin'
    )
  );
