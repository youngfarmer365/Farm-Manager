-- Allow a programme to exist as a template with no start date.
-- The clock starts the day the programme is put on a load.
-- Additive only. Does not touch animal or pen data.

alter table public.feeding_programs
  alter column start_date drop not null;
