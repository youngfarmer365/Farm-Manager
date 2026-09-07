-- Grazing: animals <-> fields with a full move history.
-- Safe to re-run. Drops animals_enriched first because CREATE OR REPLACE
-- cannot rename/reorder view columns (e.g. pen_short vs field_id).

alter table public.farm_fields add column if not exists graze_days integer default 14;
alter table public.farm_fields add column if not exists rest_days integer default 21;

alter table public.animals add column if not exists field_id uuid references public.farm_fields(id) on delete set null;
create index if not exists animals_field_id_idx on public.animals(field_id);

create table if not exists public.grazing_stays (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  animal_id uuid not null references public.animals(id) on delete cascade,
  field_id uuid references public.farm_fields(id) on delete set null,
  from_pen_id uuid references public.pens(id) on delete set null,
  to_pen_id uuid references public.pens(id) on delete set null,
  started_on date not null default current_date,
  ended_on date,
  notes text,
  created_at timestamptz default now()
);
create index if not exists grazing_stays_farm_idx on public.grazing_stays(farm_id);
create index if not exists grazing_stays_animal_idx on public.grazing_stays(animal_id);
create index if not exists grazing_stays_field_idx on public.grazing_stays(field_id);
create index if not exists grazing_stays_open_idx on public.grazing_stays(farm_id, field_id) where ended_on is null;

alter table public.grazing_stays enable row level security;
drop policy if exists members_all on public.grazing_stays;
create policy members_all on public.grazing_stays for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

drop view if exists public.animals_enriched;

create view public.animals_enriched as
select
  a.*,
  p.name as pen_name,
  left(coalesce(p.name, ''), 12) as pen_short,
  f.name as field_name,
  g.name as group_name,
  g.type as group_type,
  g.color as group_color,
  h.herd_number,
  h.name as herd_label,
  lw.latest_weight_kg,
  lw.latest_weigh_date,
  case
    when a.exit_date is not null then (a.exit_date - a.entry_date)
    else (current_date - a.entry_date)
  end as days_on_farm,
  case
    when a.date_of_birth is not null then (current_date - a.date_of_birth)
    else null
  end as age_days,
  case
    when lw.latest_weight_kg is not null
         and a.purchase_weight_kg is not null
         and a.purchase_weight_kg > 0
         and (lw.latest_weigh_date - a.purchase_date) > 0
    then round(
      ((lw.latest_weight_kg - a.purchase_weight_kg) /
       (lw.latest_weigh_date - a.purchase_date)::numeric)::numeric, 3
    )
    else null
  end as adg_kg_per_day
from public.animals a
left join public.pens p on p.id = a.pen_id
left join public.farm_fields f on f.id = a.field_id
left join public.groups g on g.id = a.group_id
left join public.herds h on h.id = a.herd_id
left join public.animal_latest_weight lw on lw.animal_id = a.id;
