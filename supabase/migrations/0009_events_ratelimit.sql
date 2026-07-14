-- 0009: medición (events) + rate limit en Postgres.

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,              -- view_home | view_detail | open_chat | begin_checkout | finish_tour
  anon_id text,
  slug text,
  country text,                    -- x-vercel-ip-country
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists events_name_created_idx on events (name, created_at desc);
alter table events enable row level security;
-- sin policies: escribe/lee solo el service role (server)

create table if not exists rate_limits (
  key text primary key,            -- p.ej. "play:<anonId>:<ip>"
  window_start timestamptz not null,
  count int not null default 0
);
alter table rate_limits enable row level security;

-- golpe atómico de rate limit: true = permitido, false = excedido
create or replace function rl_hit(p_key text, p_window_secs int, p_max int)
returns boolean language plpgsql security definer set search_path = public as $$
declare allowed boolean;
begin
  insert into rate_limits (key, window_start, count) values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when rate_limits.window_start < now() - make_interval(secs => p_window_secs)
                 then 1 else rate_limits.count + 1 end,
    window_start = case when rate_limits.window_start < now() - make_interval(secs => p_window_secs)
                        then now() else rate_limits.window_start end
  returning count <= p_max into allowed;
  return allowed;
end $$;

notify pgrst, 'reload schema';
