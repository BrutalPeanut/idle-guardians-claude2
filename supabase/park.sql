-- Woof Wars "Dog Park" async PvP. Run once in the Supabase SQL editor, AFTER clans.sql (it reuses clan_auth for the per-device secret).
-- Until it is run, the game offers practice battles against AI packs (clearly labelled).
-- Snapshots are client-reported (like the leaderboard): fine for a casual ladder, not for prizes.

create table if not exists public.park_packs (
  sid bigserial unique,
  player uuid primary key references public.clan_auth(player) on delete cascade,
  name text not null,
  stage int not null default 1,
  power double precision not null default 1,
  hp double precision not null default 1,
  dogs jsonb not null default '[]',
  rating int not null default 1000,
  wins int not null default 0,
  losses int not null default 0,
  updated_at timestamptz not null default now(),
  last_fight timestamptz
);
create index if not exists park_packs_rating_idx on public.park_packs (rating);
alter table public.park_packs enable row level security;
revoke all on public.park_packs from anon, authenticated;

create or replace function public.park_submit(p_id uuid, p_secret text, p_name text, p_stage int, p_power double precision, p_hp double precision, p_dogs jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare r public.park_packs%rowtype;
begin
  if not public.clan_auth_ok(p_id, p_secret) then return json_build_object('err', 'auth'); end if;
  insert into public.park_packs (player, name, stage, power, hp, dogs)
  values (p_id, coalesce(nullif(public.clan_clean(p_name, 24), ''), 'Guardian'), least(greatest(coalesce(p_stage, 1), 1), 3000),
          least(greatest(coalesce(p_power, 1), 1), 1e300), least(greatest(coalesce(p_hp, 1), 1), 1e300),
          case when jsonb_typeof(p_dogs) = 'array' and jsonb_array_length(p_dogs) <= 4 then p_dogs else '[]'::jsonb end)
  on conflict (player) do update set name = excluded.name, stage = excluded.stage, power = excluded.power, hp = excluded.hp, dogs = excluded.dogs, updated_at = now()
  returning * into r;
  return json_build_object('rating', r.rating, 'wins', r.wins, 'losses', r.losses);
end $$;

-- 3 opponents near your rating (no player ids returned; `sid` is an opaque ticket for park_result)
create or replace function public.park_opponents(p_id uuid)
returns table (sid bigint, name text, stage int, power double precision, hp double precision, dogs jsonb, rating int)
language sql security definer stable set search_path = public as $$
  with me as (select rating from public.park_packs where player = p_id)
  select o.sid, o.name, o.stage, o.power, o.hp, o.dogs, o.rating
  from public.park_packs o, me
  where o.player <> p_id and o.updated_at > now() - interval '30 days'
  order by abs(o.rating - me.rating) + random() * 120
  limit 3
$$;

-- the attacker reports the result; only the attacker's rating moves (defending never costs anything)
create or replace function public.park_result(p_id uuid, p_secret text, p_sid bigint, p_won boolean)
returns json language plpgsql security definer set search_path = public as $$
declare me public.park_packs%rowtype; opp int; e double precision; d int;
begin
  if not public.clan_auth_ok(p_id, p_secret) then return json_build_object('err', 'auth'); end if;
  select * into me from public.park_packs where player = p_id for update; if not found then return json_build_object('err', 'none'); end if;
  if me.last_fight > now() - interval '8 seconds' then return json_build_object('err', 'slow'); end if;
  select rating into opp from public.park_packs where sid = p_sid; if not found then return json_build_object('err', 'gone'); end if;
  e := 1 / (1 + power(10, (opp - me.rating) / 400.0));
  d := round(32 * ((case when p_won then 1 else 0 end) - e));
  update public.park_packs set rating = greatest(0, rating + d), wins = wins + (case when p_won then 1 else 0 end),
    losses = losses + (case when p_won then 0 else 1 end), last_fight = now() where player = p_id;
  return json_build_object('rating', greatest(0, me.rating + d), 'delta', d);
end $$;

create or replace function public.park_top(p_limit int default 20)
returns table (name text, stage int, rating int, wins int)
language sql security definer stable set search_path = public as $$
  select name, stage, rating, wins from public.park_packs where updated_at > now() - interval '30 days'
  order by rating desc, wins desc limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

revoke all on function public.park_submit(uuid, text, text, int, double precision, double precision, jsonb), public.park_opponents(uuid),
  public.park_result(uuid, text, bigint, boolean), public.park_top(int) from public, authenticated;
grant execute on function public.park_submit(uuid, text, text, int, double precision, double precision, jsonb), public.park_opponents(uuid),
  public.park_result(uuid, text, bigint, boolean), public.park_top(int) to anon;
