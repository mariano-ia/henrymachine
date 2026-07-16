-- 0021: insight_actions — "apliqué este insight el día X" (para verificar impacto).

create table if not exists insight_actions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  insight_id uuid not null references insights(id) on delete cascade,
  item_index int not null,
  kind text not null default 'add_utility',   -- por ahora solo Guía útil
  utility_id uuid,                             -- la utility creada (si aplica)
  metric_slug text,                            -- recorrido a medir
  metric_step int,                             -- parada a medir (abandono)
  keywords jsonb not null default '[]',        -- palabras del tema (volumen)
  baseline jsonb not null default '{}'         -- snapshot del "antes" al aplicar
);
create index if not exists insight_actions_insight_idx on insight_actions (insight_id);
-- idempotencia: un insight+item se aplica una sola vez
create unique index if not exists insight_actions_uq on insight_actions (insight_id, item_index);

alter table insight_actions enable row level security;
-- sin policies: lo lee/escribe solo el service_role (admin server-side).
