-- Farm fields, grazing, soil, grass, fertiliser, spraying, inventory
-- Run this in Supabase SQL editor after 001.

create table if not exists public.farm_fields (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  area_ha numeric(12,4),
  geojson jsonb,
  color text default '#15803d',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists farm_fields_farm_idx on public.farm_fields(farm_id);

create table if not exists public.grazing_stints (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  field_id uuid not null references public.farm_fields(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  group_name text not null,
  head_count integer,
  started_on date not null default current_date,
  ended_on date,
  notes text,
  created_at timestamptz default now()
);
create index if not exists grazing_stints_field_idx on public.grazing_stints(field_id);

create table if not exists public.field_doses (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  field_id uuid references public.farm_fields(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  group_name text,
  treated_on date not null default current_date,
  product text not null,
  dose_notes text,
  withdrawal_days integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.fertiliser_applications (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  field_id uuid not null references public.farm_fields(id) on delete cascade,
  applied_on date not null default current_date,
  kind text not null default 'chemical',
  product text not null,
  rate_kg_ha numeric(12,2),
  total_kg numeric(12,2),
  n_kg_ha numeric(8,2),
  p_kg_ha numeric(8,2),
  k_kg_ha numeric(8,2),
  weather jsonb,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.ph_tests (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  field_id uuid not null references public.farm_fields(id) on delete cascade,
  tested_on date not null default current_date,
  ph numeric(4,2) not null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.grass_covers (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  field_id uuid not null references public.farm_fields(id) on delete cascade,
  measured_on date not null default current_date,
  dm_kg_ha numeric(10,0) not null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.sprayers (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  tank_litres numeric(10,1) not null,
  default_water_l_ha numeric(8,1) default 200,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.chemical_stock (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  product_name text not null,
  pcs_number text,
  unit text not null default 'L',
  quantity numeric(12,3) not null default 0,
  active_substance text,
  notes text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.spray_jobs (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  sprayer_id uuid references public.sprayers(id) on delete set null,
  water_l_ha numeric(8,1) not null default 200,
  status text not null default 'draft',
  weather jsonb,
  grazing_interval_days integer,
  applied_on date,
  notes text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists public.spray_job_fields (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references public.spray_jobs(id) on delete cascade,
  field_id uuid not null references public.farm_fields(id) on delete cascade,
  area_ha numeric(12,4) not null
);

create table if not exists public.spray_job_products (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references public.spray_jobs(id) on delete cascade,
  sort_order integer not null default 0,
  product_name text not null,
  pcs_number text,
  unit text not null default 'L/ha',
  rate numeric(12,4) not null,
  amount_total numeric(12,4),
  fill_order integer not null default 0
);

alter table public.farm_fields enable row level security;
alter table public.grazing_stints enable row level security;
alter table public.field_doses enable row level security;
alter table public.fertiliser_applications enable row level security;
alter table public.ph_tests enable row level security;
alter table public.grass_covers enable row level security;
alter table public.sprayers enable row level security;
alter table public.chemical_stock enable row level security;
alter table public.spray_jobs enable row level security;
alter table public.spray_job_fields enable row level security;
alter table public.spray_job_products enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'farm_fields','grazing_stints','field_doses','fertiliser_applications',
    'ph_tests','grass_covers','sprayers','chemical_stock','spray_jobs'
  ]
  loop
    execute format('drop policy if exists members_all on public.%I', t);
    execute format(
      'create policy members_all on public.%I for all using (farm_id in (select public.user_farm_ids())) with check (farm_id in (select public.user_farm_ids()))',
      t
    );
  end loop;
end $$;

drop policy if exists members_all on public.spray_job_fields;
create policy members_all on public.spray_job_fields for all
  using (job_id in (select id from public.spray_jobs where farm_id in (select public.user_farm_ids())))
  with check (job_id in (select id from public.spray_jobs where farm_id in (select public.user_farm_ids())));

drop policy if exists members_all on public.spray_job_products;
create policy members_all on public.spray_job_products for all
  using (job_id in (select id from public.spray_jobs where farm_id in (select public.user_farm_ids())))
  with check (job_id in (select id from public.spray_jobs where farm_id in (select public.user_farm_ids())));

drop trigger if exists farm_fields_updated_at on public.farm_fields;
create trigger farm_fields_updated_at before update on public.farm_fields
  for each row execute function public.handle_updated_at();
