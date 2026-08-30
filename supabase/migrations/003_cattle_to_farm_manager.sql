-- Align the original Cattle Manager project with Farm Manager.
-- Safe to re-run on the existing hosted project (idempotent).
-- Run in the Supabase SQL editor after 001 and 002.

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Roles used by Farm Manager feeding permissions (basic / advanced / owner)
-- plus the original Cattle Manager roles.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_type where typname = 'member_role') then
    begin
      alter type public.member_role add value if not exists 'basic';
    exception when duplicate_object then null;
    end;
    begin
      alter type public.member_role add value if not exists 'advanced';
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- Bootstrap policies so onboarding can create the first farm
drop policy if exists "Authenticated can create farms" on public.farms;
create policy "Authenticated can create farms" on public.farms
  for insert to authenticated
  with check (true);

drop policy if exists "Users can join a farm as themselves" on public.farm_members;
create policy "Users can join a farm as themselves" on public.farm_members
  for insert to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Columns Farm Manager added on top of Cattle Manager animals / pens
-- ---------------------------------------------------------------------------
alter table public.pens add column if not exists type text default 'pen';

alter table public.animals add column if not exists herd_id uuid;
alter table public.animals add column if not exists sale_date date;
alter table public.animals add column if not exists sale_price numeric(12,2);
alter table public.animals add column if not exists dead_weight_kg numeric(8,2);
alter table public.animals add column if not exists kill_out_percent numeric(6,2);
alter table public.animals add column if not exists slaughter_grade text;
alter table public.animals add column if not exists sale_notes text;
alter table public.animals add column if not exists is_flagged boolean default false;

-- ---------------------------------------------------------------------------
-- Herds
-- ---------------------------------------------------------------------------
create table if not exists public.herds (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  herd_number text not null,
  name text,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (farm_id, herd_number)
);
create index if not exists herds_farm_idx on public.herds(farm_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'animals_herd_id_fkey'
  ) then
    alter table public.animals
      add constraint animals_herd_id_fkey
      foreign key (herd_id) references public.herds(id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Medicines + treatments
-- ---------------------------------------------------------------------------
create table if not exists public.medicines (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  active_ingredient text,
  default_withdrawal_days integer not null default 0,
  default_cost numeric(12,4),
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists medicines_farm_idx on public.medicines(farm_id);

create table if not exists public.treatments (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  animal_id uuid not null references public.animals(id) on delete cascade,
  medicine_id uuid references public.medicines(id) on delete set null,
  medicine_name text not null,
  treated_at date not null default current_date,
  withdrawal_days integer not null default 0,
  cost numeric(12,2),
  ml_used numeric(10,2),
  dose text,
  batch_ref text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);
create index if not exists treatments_animal_idx on public.treatments(animal_id);
create index if not exists treatments_farm_idx on public.treatments(farm_id);

-- ---------------------------------------------------------------------------
-- Feeding
-- ---------------------------------------------------------------------------
create table if not exists public.ingredients (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  unit text not null default 'kg',
  cost_per_unit numeric(12,4) default 0,
  premix_diet_id uuid,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists ingredients_farm_idx on public.ingredients(farm_id);

create table if not exists public.diets (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  diet_type text not null default 'custom',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists diets_farm_idx on public.diets(farm_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ingredients_premix_diet_id_fkey'
  ) then
    alter table public.ingredients
      add constraint ingredients_premix_diet_id_fkey
      foreign key (premix_diet_id) references public.diets(id) on delete set null;
  end if;
end $$;

create table if not exists public.diet_ingredients (
  id uuid primary key default uuid_generate_v4(),
  diet_id uuid not null references public.diets(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  percent numeric(8,3) not null,
  sort_order integer not null default 0
);
create index if not exists diet_ingredients_diet_idx on public.diet_ingredients(diet_id);

create table if not exists public.feeding_programs (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  start_date date not null default current_date,
  status text not null default 'active',
  starter_days integer,
  transition_days integer,
  starter_diet_id uuid references public.diets(id) on delete set null,
  finisher_diet_id uuid references public.diets(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists feeding_programs_farm_idx on public.feeding_programs(farm_id);

create table if not exists public.program_phases (
  id uuid primary key default uuid_generate_v4(),
  program_id uuid not null references public.feeding_programs(id) on delete cascade,
  diet_id uuid not null references public.diets(id) on delete restrict,
  sort_order integer not null default 0,
  steady_days integer not null default 0,
  transition_days integer not null default 0
);
create index if not exists program_phases_program_idx on public.program_phases(program_id);

create table if not exists public.feed_stock (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity_kg numeric(14,3) not null default 0,
  updated_at timestamptz default now(),
  unique (farm_id, ingredient_id)
);

create table if not exists public.feed_loads (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  program_id uuid references public.feeding_programs(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists feed_loads_farm_idx on public.feed_loads(farm_id);

create table if not exists public.feed_load_pens (
  id uuid primary key default uuid_generate_v4(),
  load_id uuid not null references public.feed_loads(id) on delete cascade,
  pen_id uuid not null references public.pens(id) on delete cascade,
  daily_amount_kg numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  unique (load_id, pen_id)
);

create table if not exists public.feed_runs (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  load_id uuid references public.feed_loads(id) on delete set null,
  load_name text,
  program_id uuid references public.feeding_programs(id) on delete set null,
  buffer_kg numeric(12,2) default 0,
  pens_planned_kg numeric(12,2),
  pens_actual_kg numeric(12,2),
  fill_total_kg numeric(12,2),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists feed_runs_farm_idx on public.feed_runs(farm_id);

create table if not exists public.feed_run_pens (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid not null references public.feed_runs(id) on delete cascade,
  pen_id uuid references public.pens(id) on delete set null,
  pen_name text,
  planned_kg numeric(12,2),
  actual_kg numeric(12,2),
  sort_order integer not null default 0,
  animal_count integer,
  kg_per_head numeric(12,4),
  cost_allocated numeric(12,2),
  cost_per_head numeric(12,4)
);

create table if not exists public.feed_run_ingredients (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid not null references public.feed_runs(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id) on delete set null,
  ingredient_name text,
  percent numeric(8,3),
  kg numeric(12,3),
  cost numeric(12,2),
  sort_order integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Enriched view: Cattle Manager ADG + Farm Manager sale / herd / flag columns
-- ---------------------------------------------------------------------------
create or replace view public.animal_latest_weight as
select distinct on (animal_id)
  animal_id,
  weight_kg as latest_weight_kg,
  weighed_at as latest_weigh_date
from public.weights
order by animal_id, weighed_at desc;

create or replace view public.animals_enriched as
select
  a.*,
  p.name as pen_name,
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
left join public.groups g on g.id = a.group_id
left join public.herds h on h.id = a.herd_id
left join public.animal_latest_weight lw on lw.animal_id = a.id;

-- ---------------------------------------------------------------------------
-- RLS for new Farm Manager tables
-- ---------------------------------------------------------------------------
alter table public.herds enable row level security;
alter table public.medicines enable row level security;
alter table public.treatments enable row level security;
alter table public.ingredients enable row level security;
alter table public.diets enable row level security;
alter table public.diet_ingredients enable row level security;
alter table public.feeding_programs enable row level security;
alter table public.program_phases enable row level security;
alter table public.feed_stock enable row level security;
alter table public.feed_loads enable row level security;
alter table public.feed_load_pens enable row level security;
alter table public.feed_runs enable row level security;
alter table public.feed_run_pens enable row level security;
alter table public.feed_run_ingredients enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'herds','medicines','treatments','ingredients','diets',
    'feeding_programs','feed_stock','feed_loads','feed_runs'
  ]
  loop
    execute format('drop policy if exists members_all on public.%I', t);
    execute format(
      'create policy members_all on public.%I for all using (farm_id in (select public.user_farm_ids())) with check (farm_id in (select public.user_farm_ids()))',
      t
    );
  end loop;
end $$;

drop policy if exists members_all on public.diet_ingredients;
create policy members_all on public.diet_ingredients for all
  using (diet_id in (select id from public.diets where farm_id in (select public.user_farm_ids())))
  with check (diet_id in (select id from public.diets where farm_id in (select public.user_farm_ids())));

drop policy if exists members_all on public.program_phases;
create policy members_all on public.program_phases for all
  using (program_id in (select id from public.feeding_programs where farm_id in (select public.user_farm_ids())))
  with check (program_id in (select id from public.feeding_programs where farm_id in (select public.user_farm_ids())));

drop policy if exists members_all on public.feed_load_pens;
create policy members_all on public.feed_load_pens for all
  using (load_id in (select id from public.feed_loads where farm_id in (select public.user_farm_ids())))
  with check (load_id in (select id from public.feed_loads where farm_id in (select public.user_farm_ids())));

drop policy if exists members_all on public.feed_run_pens;
create policy members_all on public.feed_run_pens for all
  using (run_id in (select id from public.feed_runs where farm_id in (select public.user_farm_ids())))
  with check (run_id in (select id from public.feed_runs where farm_id in (select public.user_farm_ids())));

drop policy if exists members_all on public.feed_run_ingredients;
create policy members_all on public.feed_run_ingredients for all
  using (run_id in (select id from public.feed_runs where farm_id in (select public.user_farm_ids())))
  with check (run_id in (select id from public.feed_runs where farm_id in (select public.user_farm_ids())));

drop trigger if exists medicines_updated_at on public.medicines;
create trigger medicines_updated_at before update on public.medicines
  for each row execute function public.handle_updated_at();

drop trigger if exists ingredients_updated_at on public.ingredients;
create trigger ingredients_updated_at before update on public.ingredients
  for each row execute function public.handle_updated_at();

drop trigger if exists diets_updated_at on public.diets;
create trigger diets_updated_at before update on public.diets
  for each row execute function public.handle_updated_at();
