-- Observaciones de la iniciativa y categoría escrita por el usuario.
-- description sigue siendo el alcance. category de la licitación sigue siendo el tipo de proceso.

alter table public.sourcing_plans
  add column if not exists notes text;

comment on column public.sourcing_plans.notes is
  'Observaciones internas. El alcance vive en description.';

alter table public.licitaciones
  add column if not exists category_label text;

comment on column public.licitaciones.category_label is
  'Categoría escrita en la iniciativa. category es el tipo de proceso, no este texto.';
