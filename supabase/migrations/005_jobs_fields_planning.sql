-- Jobs (multi-field, pending until completed) + full soil samples + crop history/planning
-- Safe to re-run.

alter table public.farm_fields add column if not exists color text default '#15803d';
alter table public.farm_fields add column if not exists current_crop text;

create table if not exists public.land_jobs (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  title text not null,
  job_type text not null default 'other',
  status text not null default 'pending',
  scheduled_on date,
  completed_on date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists land_jobs_farm_idx on public.land_jobs(farm_id);
create index if not exists land_jobs_status_idx on public.land_jobs(farm_id, status);

create table if not exists public.land_job_fields (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references public.land_jobs(id) on delete cascade,
  field_id uuid not null references public.farm_fields(id) on delete cascade,
  unique (job_id, field_id)
);

create table if not exists public.soil_samples (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  field_id uuid not null references public.farm_fields(id) on delete cascade,
  sampled_on date not null default current_date,
  lab_name text,
  report_no text,
  ph numeric(4,2),
  lime_t_ha numeric(8,2),
  p_mg_l numeric(8,2),
  p_index integer,
  k_mg_l numeric(8,2),
  k_index integer,
  mg_mg_l numeric(8,2),
  mg_index integer,
  om_percent numeric(6,2),
  cu_mg_l numeric(8,2),
  zn_mg_l numeric(8,2),
  mn_mg_l numeric(8,2),
  b_mg_l numeric(8,2),
  texture text,
  recommendation text,
  notes text,
  created_at timestamptz default now()
);
create index if not exists soil_samples_field_idx on public.soil_samples(field_id);

create table if not exists public.field_crops (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  field_id uuid not null references public.farm_fields(id) on delete cascade,
  year integer not null,
  season text not null default 'full',
  crop text not null,
  variety text,
  status text not null default 'planned',
  color text,
  notes text,
  planted_on date,
  harvested_on date,
  created_at timestamptz default now()
);
create index if not exists field_crops_field_year_idx on public.field_crops(field_id, year);

alter table public.land_jobs enable row level security;
alter table public.land_job_fields enable row level security;
alter table public.soil_samples enable row level security;
alter table public.field_crops enable row level security;

do $$
declare t text;
begin
  foreach t in array array['land_jobs','soil_samples','field_crops']
  loop
    execute format('drop policy if exists members_all on public.%I', t);
    execute format(
      'create policy members_all on public.%I for all using (farm_id in (select public.user_farm_ids())) with check (farm_id in (select public.user_farm_ids()))',
      t
    );
  end loop;
end $$;

drop policy if exists members_all on public.land_job_fields;
create policy members_all on public.land_job_fields for all
  using (job_id in (select id from public.land_jobs where farm_id in (select public.user_farm_ids())))
  with check (job_id in (select id from public.land_jobs where farm_id in (select public.user_farm_ids())));

drop trigger if exists land_jobs_updated_at on public.land_jobs;
create trigger land_jobs_updated_at before update on public.land_jobs
  for each row execute function public.handle_updated_at();
