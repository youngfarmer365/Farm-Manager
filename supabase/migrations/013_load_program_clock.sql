-- Each load keeps its own programme clock.
-- The same programme can run on several loads without sharing pause or day number.
-- Additive only. Does not touch animal or pen data.

alter table public.feed_loads
  add column if not exists program_start_date date;
alter table public.feed_loads
  add column if not exists program_pause_days integer not null default 0;
alter table public.feed_loads
  add column if not exists program_paused_on date;
alter table public.feed_loads
  add column if not exists program_status text not null default 'active';

-- Seed existing loads from the old shared programme clock so current day numbers stay put.
update public.feed_loads l
set
  program_start_date = p.start_date,
  program_pause_days = coalesce(p.pause_days, 0),
  program_paused_on = p.paused_on,
  program_status = coalesce(p.status, 'active')
from public.feeding_programs p
where l.program_id = p.id
  and l.program_start_date is null;
