-- Safe additive columns used by the phone app.
-- Does not drop views or tables. Does not change existing animal or pen rows.

alter table public.diets add column if not exists batch_kg numeric(12,2);

alter table public.farm_fields add column if not exists graze_days integer default 14;
alter table public.farm_fields add column if not exists rest_days integer default 21;

alter table public.animals add column if not exists field_id uuid references public.farm_fields(id) on delete set null;
create index if not exists animals_field_id_idx on public.animals(field_id);
