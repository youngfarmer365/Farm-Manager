-- Open feeding run shared across iPad / phone.
-- Paste this once in Supabase → SQL editor → Run.

create table if not exists public.open_feeding_runs (
  farm_id uuid primary key references public.farms(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.open_feeding_runs enable row level security;

drop policy if exists members_all on public.open_feeding_runs;
create policy members_all on public.open_feeding_runs for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));
