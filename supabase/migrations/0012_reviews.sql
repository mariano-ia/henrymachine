-- 0012: reviews reales (con moderación) — reemplazan las mock del detalle.

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references experiences(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  body text,
  author_name text,
  country text,                       -- ISO-2 (PE, AR, ...)
  anon_id text,
  user_id uuid,
  verified_purchase boolean not null default false,
  status text not null default 'pending', -- pending | approved | featured | rejected
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reviews_exp_status_idx on reviews (experience_id, status);
-- una review por anon por experiencia (evita spam del mismo dispositivo)
create unique index if not exists reviews_anon_uq on reviews (experience_id, anon_id) where anon_id is not null;

alter table reviews enable row level security;
create policy "reviews_public_read" on reviews for select to anon, authenticated
  using (status in ('approved', 'featured'));
-- alta/moderación: solo service role (server)

create trigger trg_reviews_updated before update on reviews
  for each row execute function set_updated_at();

notify pgrst, 'reload schema';
