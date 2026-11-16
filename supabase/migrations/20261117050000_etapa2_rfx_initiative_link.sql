-- Etapa 2 (complemento): vínculo RFx -> iniciativa.
-- Producción no tenía rfx_projects.sourcing_plan_id (el baseline local sí). La app ya lo consulta al crear un RFx
-- desde una iniciativa y las Etapas 3-5 lo usan para derivar hitos. Cambio aditivo, nullable, sin reescritura de datos.
-- Rollback: alter table public.rfx_projects drop column sourcing_plan_id;  (solo si ningún RFx lo usa)
alter table public.rfx_projects
  add column if not exists sourcing_plan_id uuid references public.sourcing_plans(id) on delete set null;
create index if not exists idx_rfx_projects_sourcing_plan on public.rfx_projects (sourcing_plan_id);
