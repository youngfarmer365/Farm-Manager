-- Default batch size on a premix diet (kg to mix).
alter table public.diets add column if not exists batch_kg numeric(12,2);
