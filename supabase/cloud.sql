-- Woof Wars cloud save. Run once in the Supabase SQL editor, AFTER clans.sql (it reuses clan_auth for the per-device secret).
-- Opt-in: players switch it on in Save Data. The save is the same JSON as the local save (game progress only, no personal data).

create table if not exists public.cloud_saves (
  player uuid primary key references public.clan_auth(player) on delete cascade,
  data text not null check (char_length(data) <= 300000),
  stage int not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.cloud_saves enable row level security;
revoke all on public.cloud_saves from anon, authenticated;

create or replace function public.cloud_put(p_id uuid, p_secret text, p_data text, p_stage int)
returns text language plpgsql security definer set search_path = public as $$
declare cur public.cloud_saves%rowtype;
begin
  if not public.clan_auth_ok(p_id, p_secret) then return 'auth'; end if;
  if p_data is null or char_length(p_data) > 300000 then return 'size'; end if;
  select * into cur from public.cloud_saves where player = p_id;
  if found and cur.updated_at > now() - interval '20 seconds' then return 'slow'; end if;
  insert into public.cloud_saves (player, data, stage) values (p_id, p_data, least(greatest(coalesce(p_stage, 1), 1), 3000))
  on conflict (player) do update set data = excluded.data, stage = excluded.stage, updated_at = now();
  return 'ok';
end $$;

create or replace function public.cloud_get(p_id uuid, p_secret text)
returns json language plpgsql security definer set search_path = public as $$
declare cur public.cloud_saves%rowtype;
begin
  if not exists (select 1 from public.clan_auth where player = p_id) then return json_build_object('err', 'none'); end if;
  if not public.clan_auth_ok(p_id, p_secret) then return json_build_object('err', 'auth'); end if;
  select * into cur from public.cloud_saves where player = p_id; if not found then return json_build_object('err', 'none'); end if;
  return json_build_object('data', cur.data, 'stage', cur.stage, 'at', cur.updated_at);
end $$;

-- forget me: deletes the cloud save (and, via cascade, clan membership and Dog Park pack)
create or replace function public.cloud_delete(p_id uuid, p_secret text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.clan_auth_ok(p_id, p_secret) then return 'auth'; end if;
  delete from public.clan_auth where player = p_id;
  return 'ok';
end $$;

revoke all on function public.cloud_put(uuid, text, text, int), public.cloud_get(uuid, text), public.cloud_delete(uuid, text) from public, authenticated;
grant execute on function public.cloud_put(uuid, text, text, int), public.cloud_get(uuid, text), public.cloud_delete(uuid, text) to anon;
