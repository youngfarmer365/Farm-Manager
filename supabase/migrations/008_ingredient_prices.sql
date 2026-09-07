-- Price history for ingredients. Current price stays on ingredients.cost_per_unit.
-- Feed runs keep their own snapshotted cost and are never recalculated.

create table if not exists public.ingredient_prices (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  cost_per_unit numeric(12,4) not null default 0,
  effective_on date not null default current_date,
  notes text,
  created_at timestamptz default now()
);
create index if not exists ingredient_prices_ing_idx
  on public.ingredient_prices(ingredient_id, effective_on desc);
create index if not exists ingredient_prices_farm_idx
  on public.ingredient_prices(farm_id, effective_on desc);

alter table public.ingredient_prices enable row level security;
drop policy if exists members_all on public.ingredient_prices;
create policy members_all on public.ingredient_prices for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

insert into public.ingredient_prices (farm_id, ingredient_id, cost_per_unit, effective_on)
select i.farm_id, i.id, coalesce(i.cost_per_unit, 0), coalesce(i.created_at::date, current_date)
from public.ingredients i
where not exists (
  select 1 from public.ingredient_prices p where p.ingredient_id = i.id
);
