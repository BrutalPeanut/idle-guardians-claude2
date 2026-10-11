-- Barkpocalypse global leaderboard. Run once in the Supabase SQL editor.
create table if not exists public.players (
  id uuid primary key,
  name text not null check (char_length(name) between 3 and 24),
  stage int not null default 1 check (stage between 1 and 3000),
  rebirths int not null default 0 check (rebirths between 0 and 500),
  updated_at timestamptz not null default now()
);
create index if not exists players_rank_idx on public.players (stage desc, rebirths desc, updated_at asc);

alter table public.players enable row level security;
-- Anyone may read the board. Nobody may write directly; writes go through submit_score() below.
drop policy if exists "read board" on public.players;
create policy "read board" on public.players for select using (true);

create or replace function public.submit_score(p_id uuid, p_name text, p_stage int, p_rebirths int)
returns void language plpgsql security definer set search_path = public as $$
declare cur public.players%rowtype; nm text;
begin
  nm := left(regexp_replace(coalesce(p_name, ''), '[^A-Za-z0-9 _-]', '', 'g'), 24);
  if char_length(nm) < 3 then nm := 'Guardian'; end if;
  if p_stage < 1 or p_stage > 3000 or p_rebirths < 0 or p_rebirths > 500 then return; end if;
  select * into cur from public.players where id = p_id;
  if not found then
    insert into public.players (id, name, stage, rebirths) values (p_id, nm, p_stage, p_rebirths);
  else
    -- one update per 5s per player; scores can only go up (a rename alone is allowed)
    if cur.updated_at > now() - interval '5 seconds' then return; end if;
    update public.players set name = nm, stage = greatest(cur.stage, p_stage), rebirths = greatest(cur.rebirths, p_rebirths), updated_at = now() where id = p_id;
  end if;
end $$;

create or replace function public.my_rank(p_id uuid)
returns json language sql security definer set search_path = public stable as $$
  select json_build_object(
    'rank', (select count(*) + 1 from public.players o, public.players m where m.id = p_id and (o.stage, o.rebirths) > (m.stage, m.rebirths)),
    'total', (select count(*) from public.players));
$$;

grant execute on function public.submit_score(uuid, text, int, int) to anon;
grant execute on function public.my_rank(uuid) to anon;
grant select on public.players to anon;
