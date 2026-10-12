-- Woof Wars anonymous usage + crash events. Run once in the Supabase SQL editor.
-- Insert-only through log_batch(); nobody can read or change rows from the client.
create table if not exists public.telemetry_events (
  id bigserial primary key,
  at timestamptz not null default now(),
  aid uuid not null,
  ver text not null,
  plat text not null,
  name text not null check (char_length(name) between 1 and 40),
  props jsonb not null default '{}'::jsonb
);
create index if not exists telemetry_name_at_idx on public.telemetry_events (name, at desc);
create index if not exists telemetry_aid_idx on public.telemetry_events (aid, at desc);
alter table public.telemetry_events enable row level security;
-- (no policies on purpose: anon can neither select nor insert directly)

create or replace function public.log_batch(p_aid uuid, p_ver text, p_plat text, p_events jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare ev jsonb; n int := 0; nm text; pr jsonb;
begin
  if p_events is null or jsonb_typeof(p_events) <> 'array' then return; end if;
  -- cheap abuse guard: at most 200 rows per player per hour
  if (select count(*) from public.telemetry_events where aid = p_aid and at > now() - interval '1 hour') > 200 then return; end if;
  for ev in select * from jsonb_array_elements(p_events) loop
    n := n + 1; exit when n > 50;
    nm := left(regexp_replace(coalesce(ev->>'n', ''), '[^A-Za-z0-9_.-]', '', 'g'), 40);
    if char_length(nm) < 1 then continue; end if;
    pr := case when jsonb_typeof(ev->'p') = 'object' and length((ev->'p')::text) <= 600 then ev->'p' else '{}'::jsonb end;
    insert into public.telemetry_events (aid, ver, plat, name, props) values (p_aid, left(coalesce(p_ver, ''), 16), left(coalesce(p_plat, ''), 12), nm, pr);
  end loop;
end $$;
grant execute on function public.log_batch(uuid, text, text, jsonb) to anon;
