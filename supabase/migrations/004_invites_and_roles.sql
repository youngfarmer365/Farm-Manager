-- Yard staff invites + member display fields. Safe to re-run.

alter table public.farm_members add column if not exists email text;
alter table public.farm_members add column if not exists display_name text;

create table if not exists public.farm_invites (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  email text not null,
  role text not null default 'basic',
  token uuid not null default uuid_generate_v4(),
  invited_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  used_at timestamptz,
  unique (token)
);
create index if not exists farm_invites_farm_idx on public.farm_invites(farm_id);
create index if not exists farm_invites_email_idx on public.farm_invites(lower(email));

alter table public.farm_invites enable row level security;

drop policy if exists members_manage_invites on public.farm_invites;
create policy members_manage_invites on public.farm_invites for all
  using (
    farm_id in (select public.user_farm_ids())
    and public.user_role_on_farm(farm_id)::text in ('owner', 'advanced', 'manager')
  )
  with check (
    farm_id in (select public.user_farm_ids())
    and public.user_role_on_farm(farm_id)::text in ('owner', 'advanced', 'manager')
  );

create or replace function public.get_farm_invite(invite_token uuid)
returns table (
  farm_name text,
  role text,
  email text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select f.name, i.role, i.email, i.expires_at
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

  insert into public.farm_members (farm_id, user_id, role, email, display_name)
  values (inv.farm_id, uid, inv.role, lower(inv.email), uname)
  on conflict (farm_id, user_id) do update
    set role = excluded.role,
        email = excluded.email,
        display_name = excluded.display_name;

  update public.farm_invites set used_at = now() where id = inv.id;

  return jsonb_build_object('ok', true, 'farm_id', inv.farm_id, 'role', inv.role);
end;
$$;

grant execute on function public.get_farm_invite(uuid) to anon, authenticated;
grant execute on function public.accept_farm_invite(uuid) to authenticated;
