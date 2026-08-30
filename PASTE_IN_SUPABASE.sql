-- Farm Manager — paste in Supabase → SQL Editor → Run
-- Safe to re-run. Do this after applying the code update.

-- Staff name on invites. Accepting an invite will not downgrade an existing owner.
alter table public.farm_invites add column if not exists display_name text;
alter table public.farm_members add column if not exists email text;
alter table public.farm_members add column if not exists display_name text;

drop function if exists public.get_farm_invite(uuid);

create or replace function public.get_farm_invite(invite_token uuid)
returns table (
  farm_name text,
  role text,
  email text,
  expires_at timestamptz,
  display_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select f.name, i.role, i.email, i.expires_at, i.display_name
  from public.farm_invites i
  join public.farms f on f.id = i.farm_id
  where i.token = invite_token
    and i.used_at is null
    and i.expires_at > now();
end;
$$;

create or replace function public.accept_farm_invite(invite_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.farm_invites%rowtype;
  user_email text;
  uname text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;

  select * into inv
  from public.farm_invites
  where token = invite_token
    and used_at is null
    and expires_at > now();

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Invite is invalid or expired');
  end if;

  select email, coalesce(raw_user_meta_data->>'full_name', email)
    into user_email, uname
  from auth.users
  where id = uid;

  if user_email is null or lower(user_email) <> lower(inv.email) then
    return jsonb_build_object(
      'ok', false,
      'error', 'Sign in with ' || inv.email || ' to accept this invite'
    );
  end if;

  uname := coalesce(nullif(inv.display_name, ''), uname);

  insert into public.farm_members (farm_id, user_id, role, email, display_name)
  values (inv.farm_id, uid, inv.role, lower(inv.email), uname)
  on conflict (farm_id, user_id) do update
    set role = case
          when farm_members.role = 'owner' then farm_members.role
          else excluded.role
        end,
        email = excluded.email,
        display_name = coalesce(excluded.display_name, farm_members.display_name);

  update public.farm_invites set used_at = now() where id = inv.id;

  return jsonb_build_object('ok', true, 'farm_id', inv.farm_id, 'role', inv.role);
end;
$$;

grant execute on function public.get_farm_invite(uuid) to anon, authenticated;
grant execute on function public.accept_farm_invite(uuid) to authenticated;

-- If your own login is stuck on yard/basic, promote it (change the email):
-- update farm_members set role = 'owner'
-- where user_id = (select id from auth.users where email = 'YOU@YOURFARM.COM');
