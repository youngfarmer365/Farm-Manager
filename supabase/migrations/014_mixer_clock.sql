-- Mixer Clock: default premix batch size + one-shot snapshot for the yard app.
alter table public.diets add column if not exists batch_kg numeric(12,2);

create or replace function public.mixer_clock_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  fid uuid;
  result jsonb;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  select farm_id into fid
  from public.farm_members
  where user_id = uid
  limit 1;

  if fid is null then
    raise exception 'no farm';
  end if;

  select jsonb_build_object(
    'farmId', fid,
    'premixes', (
      select coalesce(jsonb_agg(x), '[]'::jsonb)
      from (
        select
          d.id as "dietId",
          d.name,
          (select i.id from public.ingredients i where i.premix_diet_id = d.id limit 1) as "ingredientId",
          coalesce(d.batch_kg, 500) as "batchKg",
          (
            select coalesce(jsonb_agg(jsonb_build_object(
              'id', di.ingredient_id,
              'name', ing.name,
              'percent', di.percent
            ) order by di.sort_order), '[]'::jsonb)
            from public.diet_ingredients di
            join public.ingredients ing on ing.id = di.ingredient_id
            where di.diet_id = d.id
          ) as lines
        from public.diets d
        where d.farm_id = fid
          and lower(coalesce(d.diet_type, '')) = 'premix'
          and coalesce(d.is_active, true)
        order by d.name
      ) x
    ),
    'loads', (
      select coalesce(jsonb_agg(x), '[]'::jsonb)
      from (
        select
          l.id,
          l.name,
          l.program_id,
          (
            select coalesce(jsonb_agg(jsonb_build_object(
              'id', p.id,
              'name', p.name,
              'kg', flp.daily_amount_kg
            ) order by flp.sort_order), '[]'::jsonb)
            from public.feed_load_pens flp
            join public.pens p on p.id = flp.pen_id
            where flp.load_id = l.id
          ) as pens
        from public.feed_loads l
        where l.farm_id = fid
        order by l.created_at desc
      ) x
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.mixer_clock_snapshot() from public;
grant execute on function public.mixer_clock_snapshot() to authenticated;
grant execute on function public.mixer_clock_snapshot() to anon;
