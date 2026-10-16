-- Woof Wars online clans. Run once in the Supabase SQL editor. Until it is run, the game keeps using the practice clans.
-- Security model: the anon key is public, so nothing is readable or writable directly. Every call goes through a
-- SECURITY DEFINER function, and every write needs the player's id AND a per-device secret (registered on first use,
-- stored only as a SHA-256 hash). Rosters never expose player ids, so knowing someone's leaderboard id is not enough to act as them.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.clan_auth (
  player uuid primary key,
  secret_hash text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.clans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 20),
  tag text not null check (char_length(tag) between 2 and 4),
  min_stage int not null default 1 check (min_stage between 1 and 500),
  owner uuid not null,
  created_at timestamptz not null default now()
);
create unique index if not exists clans_name_uq on public.clans (lower(name));
create table if not exists public.clan_members (
  player uuid primary key references public.clan_auth(player) on delete cascade,
  clan uuid not null references public.clans(id) on delete cascade,
  name text not null,
  stage int not null default 1,
  week text not null default '',
  week_dmg double precision not null default 0,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists clan_members_clan_idx on public.clan_members (clan);

alter table public.clan_auth enable row level security;
alter table public.clans enable row level security;
alter table public.clan_members enable row level security;
revoke all on public.clan_auth, public.clans, public.clan_members from anon, authenticated;

create or replace function public.clan_clean(t text, maxlen int) returns text language sql immutable set search_path = public as $$
  select left(btrim(regexp_replace(coalesce(t, ''), '[^A-Za-z0-9 _-]', '', 'g')), maxlen)
$$;

-- registers the secret on first use, then checks it
create or replace function public.clan_auth_ok(p_id uuid, p_secret text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  if p_id is null or p_secret is null or char_length(p_secret) < 32 or char_length(p_secret) > 128 then return false; end if;
  select secret_hash into h from public.clan_auth where player = p_id;
  if not found then
    insert into public.clan_auth (player, secret_hash) values (p_id, encode(digest(p_secret, 'sha256'), 'hex'));
    return true;
  end if;
  return h = encode(digest(p_secret, 'sha256'), 'hex');
end $$;

create or replace function public.clan_list(p_week text, p_limit int default 30)
returns table (id uuid, name text, tag text, min_stage int, members int, online int, week_total double precision)
language sql security definer stable set search_path = public as $$
  select c.id, c.name, c.tag, c.min_stage,
    count(m.player)::int,
    count(m.player) filter (where m.last_seen > now() - interval '15 minutes')::int,
    coalesce(sum(m.week_dmg) filter (where m.week = p_week), 0)
  from public.clans c left join public.clan_members m on m.clan = c.id
  group by c.id
  having count(m.player) between 1 and 29
  order by count(m.player) filter (where m.last_seen > now() - interval '3 days') desc, c.created_at asc
  limit least(greatest(coalesce(p_limit, 30), 1), 50)
$$;

create or replace function public.clan_mine(p_id uuid) returns uuid
language sql security definer stable set search_path = public as $$
  select clan from public.clan_members where player = p_id
$$;

create or replace function public.clan_roster(p_clan uuid, p_id uuid)
returns table (name text, stage int, week text, week_dmg double precision, last_seen timestamptz, is_me boolean)
language sql security definer stable set search_path = public as $$
  select m.name, m.stage, m.week, m.week_dmg, m.last_seen, m.player = p_id
  from public.clan_members m where m.clan = p_clan order by m.week_dmg desc, m.stage desc limit 30
$$;

create or replace function public.clan_create(p_id uuid, p_secret text, p_name text, p_tag text, p_min int, p_pname text, p_stage int)
returns text language plpgsql security definer set search_path = public as $$
declare nm text := public.clan_clean(p_name, 20); tg text := upper(public.clan_clean(replace(p_tag, ' ', ''), 4)); cid uuid;
begin
  if not public.clan_auth_ok(p_id, p_secret) then return 'auth'; end if;
  if exists (select 1 from public.clan_members where player = p_id) then return 'member'; end if;
  if char_length(nm) < 3 then return 'name'; end if;
  if char_length(tg) < 2 then return 'tag'; end if;
  if exists (select 1 from public.clans where lower(name) = lower(nm)) then return 'taken'; end if;
  if (select count(*) from public.clans where owner = p_id and created_at > now() - interval '1 day') >= 2 then return 'limit'; end if;
  insert into public.clans (name, tag, min_stage, owner) values (nm, tg, least(greatest(coalesce(p_min, 1), 1), 500), p_id) returning id into cid;
  insert into public.clan_members (player, clan, name, stage) values (p_id, cid, coalesce(nullif(public.clan_clean(p_pname, 24), ''), 'Guardian'), least(greatest(coalesce(p_stage, 1), 1), 3000));
  return cid::text;
end $$;

create or replace function public.clan_join(p_id uuid, p_secret text, p_clan uuid, p_pname text, p_stage int)
returns text language plpgsql security definer set search_path = public as $$
declare c public.clans%rowtype; n int;
begin
  if not public.clan_auth_ok(p_id, p_secret) then return 'auth'; end if;
  if exists (select 1 from public.clan_members where player = p_id) then return 'member'; end if;
  select * into c from public.clans where id = p_clan for update; if not found then return 'gone'; end if;
  if coalesce(p_stage, 1) < c.min_stage then return 'stage'; end if;
  select count(*) into n from public.clan_members where clan = p_clan; if n >= 30 then return 'full'; end if;
  insert into public.clan_members (player, clan, name, stage) values (p_id, p_clan, coalesce(nullif(public.clan_clean(p_pname, 24), ''), 'Guardian'), least(greatest(coalesce(p_stage, 1), 1), 3000));
  return 'ok';
end $$;

create or replace function public.clan_leave(p_id uuid, p_secret text) returns text
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if not public.clan_auth_ok(p_id, p_secret) then return 'auth'; end if;
  delete from public.clan_members where player = p_id returning clan into cid;
  if cid is not null and not exists (select 1 from public.clan_members where clan = cid) then delete from public.clans where id = cid; end if;
  return 'ok';
end $$;

-- heartbeat + weekly raid damage. Damage only goes up within a week; a new week key starts from the reported value.
create or replace function public.clan_report(p_id uuid, p_secret text, p_pname text, p_stage int, p_week text, p_dmg double precision)
returns text language plpgsql security definer set search_path = public as $$
declare m public.clan_members%rowtype; d double precision := least(greatest(coalesce(p_dmg, 0), 0), 1e300);
begin
  if not public.clan_auth_ok(p_id, p_secret) then return 'auth'; end if;
  select * into m from public.clan_members where player = p_id; if not found then return 'none'; end if;
  if m.last_seen > now() - interval '10 seconds' then return 'slow'; end if;
  update public.clan_members set
    name = coalesce(nullif(public.clan_clean(p_pname, 24), ''), m.name),
    stage = greatest(m.stage, least(greatest(coalesce(p_stage, 1), 1), 3000)),
    week = left(coalesce(p_week, ''), 12),
    week_dmg = case when m.week = left(coalesce(p_week, ''), 12) then greatest(m.week_dmg, d) else d end,
    last_seen = now()
  where player = p_id;
  return 'ok';
end $$;

revoke all on function public.clan_auth_ok(uuid, text) from public, anon, authenticated;
revoke all on function public.clan_list(text, int), public.clan_mine(uuid), public.clan_roster(uuid, uuid),
  public.clan_create(uuid, text, text, text, int, text, int), public.clan_join(uuid, text, uuid, text, int),
  public.clan_leave(uuid, text), public.clan_report(uuid, text, text, int, text, double precision) from public, authenticated;
grant execute on function public.clan_list(text, int), public.clan_mine(uuid), public.clan_roster(uuid, uuid),
  public.clan_create(uuid, text, text, text, int, text, int), public.clan_join(uuid, text, uuid, text, int),
  public.clan_leave(uuid, text), public.clan_report(uuid, text, text, int, text, double precision) to anon;
