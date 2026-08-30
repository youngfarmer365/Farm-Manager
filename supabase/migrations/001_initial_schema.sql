-- Farm Manager schema - Part 1 (animals, farms, members)
-- Originally created as Cattle Manager; kept as the base migration.
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

create table public.farms (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  location text,
  timezone text default 'Pacific/Auckland',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create type public.member_role as enum ('owner', 'manager', 'worker', 'viewer');

create table public.farm_members (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'worker',
  created_at timestamptz default now(),
  unique (farm_id, user_id)
);

-- PENS
create table public.pens (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  description text,
  capacity integer,
  area_ha numeric(10,2),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (farm_id, name)
);

-- GROUPS
create table public.groups (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  type text not null default 'custom',
  description text,
  color text default '#3b82f6',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (farm_id, name)
);

-- ANIMALS
create type public.animal_status as enum ('active', 'sold', 'dead', 'transferred');
create type public.animal_sex as enum ('male', 'female', 'steer', 'heifer', 'bull', 'cow', 'unknown');

create table public.animals (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  tag text not null,
  eid text,
  breed text,
  sex public.animal_sex default 'unknown',
  date_of_birth date,
  purchase_date date not null,
  purchase_weight_kg numeric(8,2),
  purchase_price numeric(12,2),
  source text,
  entry_date date not null default current_date,
  exit_date date,
  status public.animal_status not null default 'active',
  pen_id uuid references public.pens(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  notes text,
  photo_url text,
  expected_finish_weight_kg numeric(8,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references public.profiles(id),
  unique (farm_id, tag)
);

create index animals_farm_id_idx on public.animals(farm_id);
create index animals_status_idx on public.animals(status);
create index animals_group_id_idx on public.animals(group_id);
create index animals_pen_id_idx on public.animals(pen_id);
create index animals_purchase_date_idx on public.animals(purchase_date);
create index animals_entry_date_idx on public.animals(entry_date);
create index animals_exit_date_idx on public.animals(exit_date);
create index animals_dob_idx on public.animals(date_of_birth);
create index animals_tag_trgm_idx on public.animals using gin (tag gin_trgm_ops);

-- WEIGHTS
create table public.weights (
  id uuid primary key default uuid_generate_v4(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  weight_kg numeric(8,2) not null check (weight_kg > 0),
  weighed_at date not null default current_date,
  notes text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  unique (animal_id, weighed_at)
);

create index weights_animal_id_idx on public.weights(animal_id);
create index weights_weighed_at_idx on public.weights(weighed_at);

-- VIEWS
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
left join public.animal_latest_weight lw on lw.animal_id = a.id;

-- RLS
alter table public.farms enable row level security;
alter table public.profiles enable row level security;
alter table public.farm_members enable row level security;
alter table public.pens enable row level security;
alter table public.groups enable row level security;
alter table public.animals enable row level security;
alter table public.weights enable row level security;

create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

create or replace function public.user_farm_ids()
returns setof uuid language sql security definer stable as $$
  select farm_id from public.farm_members where user_id = auth.uid();
$$;

create or replace function public.user_role_on_farm(fid uuid)
returns public.member_role language sql security definer stable as $$
  select role from public.farm_members where user_id = auth.uid() and farm_id = fid limit 1;
$$;

create policy "Members can view their farms" on public.farms for select
  using (id in (select public.user_farm_ids()));
create policy "Owners can update their farms" on public.farms for update
  using (public.user_role_on_farm(id) = 'owner');

create policy "Members can view farm members" on public.farm_members for select
  using (farm_id in (select public.user_farm_ids()));
create policy "Owners/managers can manage members" on public.farm_members for all
  using (public.user_role_on_farm(farm_id) in ('owner', 'manager'));

create policy "Members can view pens" on public.pens for select
  using (farm_id in (select public.user_farm_ids()));
create policy "Managers+ can manage pens" on public.pens for all
  using (public.user_role_on_farm(farm_id) in ('owner', 'manager'));

create policy "Members can view groups" on public.groups for select
  using (farm_id in (select public.user_farm_ids()));
create policy "Managers+ can manage groups" on public.groups for all
  using (public.user_role_on_farm(farm_id) in ('owner', 'manager'));

create policy "Members can view animals" on public.animals for select
  using (farm_id in (select public.user_farm_ids()));
create policy "Workers+ can insert animals" on public.animals for insert
  with check (farm_id in (select public.user_farm_ids()) and public.user_role_on_farm(farm_id) in ('owner', 'manager', 'worker'));
create policy "Workers+ can update animals" on public.animals for update
  using (farm_id in (select public.user_farm_ids()) and public.user_role_on_farm(farm_id) in ('owner', 'manager', 'worker'));
create policy "Managers+ can delete animals" on public.animals for delete
  using (public.user_role_on_farm(farm_id) in ('owner', 'manager'));

create policy "Members can view weights" on public.weights for select
  using (animal_id in (select id from public.animals where farm_id in (select public.user_farm_ids())));
create policy "Workers+ can manage weights" on public.weights for all
  using (animal_id in (select id from public.animals where farm_id in (select public.user_farm_ids()) and public.user_role_on_farm(farm_id) in ('owner', 'manager', 'worker')));

-- TRIGGERS
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger farms_updated_at before update on public.farms for each row execute function public.handle_updated_at();
create trigger pens_updated_at before update on public.pens for each row execute function public.handle_updated_at();
create trigger groups_updated_at before update on public.groups for each row execute function public.handle_updated_at();
create trigger animals_updated_at before update on public.animals for each row execute function public.handle_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.handle_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
