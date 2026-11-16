-- Etapa 6: acceso autorizado de un Super Admin a más de una empresa (por ejemplo, una empresa de demostración).
--
-- Contexto: la identidad (usuario Auth, correo, contraseña y rol) no cambia nunca. La "empresa activa" de una persona es
-- profiles.company_id, de lo que dependen todas las políticas RLS. Esta migración agrega una lista cerrada de empresas a las
-- que cada persona puede cambiar y una función que solo mueve ese puntero, con bitácora. Sin cambios en las políticas de RLS.
--
-- Reglas:
--   * Solo un super_admin (perfil interno) cambia de empresa, y solo a una empresa de su lista (tenant_access).
--   * La lista y la bitácora no se escriben desde la aplicación: solo las funciones y el seed administrativo.
--   * Cada cambio queda en tenant_switch_log. Volver a la empresa propia es otro cambio igual.
--
-- Rollback: drop function public.switch_tenant(uuid), public.list_my_tenants();
--           drop table public.tenant_switch_log, public.tenant_access;

create table if not exists public.tenant_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null default 'granted' check (kind in ('home', 'granted')),
  granted_by text,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

create table if not exists public.tenant_switch_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  from_company uuid,
  to_company uuid not null,
  switched_at timestamptz not null default now()
);
create index if not exists tenant_switch_log_user_idx on public.tenant_switch_log (user_id, switched_at desc);

alter table public.tenant_access enable row level security;
alter table public.tenant_switch_log enable row level security;
drop policy if exists tenant_access_select_own on public.tenant_access;
create policy tenant_access_select_own on public.tenant_access for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists tenant_switch_log_select_own on public.tenant_switch_log;
create policy tenant_switch_log_select_own on public.tenant_switch_log for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.tenant_access, public.tenant_switch_log from anon;
revoke insert, update, delete, truncate on public.tenant_access, public.tenant_switch_log from authenticated;

create or replace function private.forbid_tenant_log_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'La bitácora de cambios de empresa no se edita ni se borra';
end $$;
drop trigger if exists forbid_mutation on public.tenant_switch_log;
create trigger forbid_mutation before update or delete on public.tenant_switch_log for each row execute function private.forbid_tenant_log_mutation();

-- Empresas a las que puede cambiar quien llama (vacío para cualquier perfil que no sea super_admin interno).
create or replace function public.list_my_tenants()
returns table (company_id uuid, name text, is_demo boolean, is_active boolean, is_home boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, coalesce((c.settings ->> 'demo')::boolean, false), c.id = p.company_id, a.kind = 'home'
    from public.profiles p
    join public.tenant_access a on a.user_id = p.id
    join public.companies c on c.id = a.company_id
   where p.id = (select auth.uid()) and p.role::text = 'super_admin' and p.supplier_id is null
   order by (a.kind = 'home') desc, c.name
$$;

create or replace function public.switch_tenant(p_company uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  p public.profiles%rowtype;
begin
  select * into p from public.profiles where id = actor;
  if not found or p.role::text <> 'super_admin' or p.supplier_id is not null then
    raise exception 'Solo un Super Admin puede cambiar de empresa';
  end if;
  if not exists (select 1 from public.tenant_access a where a.user_id = actor and a.company_id = p_company) then
    raise exception 'No tienes autorización para esa empresa';
  end if;
  if p.company_id is distinct from p_company then
    update public.profiles set company_id = p_company where id = actor;
    insert into public.tenant_switch_log (user_id, from_company, to_company) values (actor, p.company_id, p_company);
  end if;
end $$;

revoke all on function public.list_my_tenants(), public.switch_tenant(uuid) from public, anon;
grant execute on function public.list_my_tenants(), public.switch_tenant(uuid) to authenticated;
