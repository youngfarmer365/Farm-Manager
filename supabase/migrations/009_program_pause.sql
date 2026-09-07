-- Pause a feeding programme so transition days do not keep ticking.

alter table public.feeding_programs
  add column if not exists pause_days integer not null default 0;
alter table public.feeding_programs
  add column if not exists paused_on date;
