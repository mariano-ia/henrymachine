-- 0020: insights — reportes del análisis LLM de las jugadas (histórico).

create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null default 'manual',          -- 'auto' | 'manual'
  plays_analyzed int not null default 0,
  window_from timestamptz,
  window_to timestamptz,
  summary text,
  items jsonb not null default '[]'
);
create index if not exists insights_created_idx on insights (created_at desc);

alter table insights enable row level security;
-- sin policies: lo lee/escribe solo el service_role (el admin corre server-side).
