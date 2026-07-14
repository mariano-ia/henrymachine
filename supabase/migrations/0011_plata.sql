-- 0011: monetización — upsell por experiencia, regalo, leads.

-- Upsell: al terminar una experiencia, ofrecer la siguiente (con cupón opcional).
alter table experiences add column if not exists upsell_experience_id uuid references experiences(id) on delete set null;
alter table experiences add column if not exists upsell_message text;
alter table experiences add column if not exists upsell_promo_code text; -- Promotion Code de Stripe (el código visible, ej. GOLAZO20)

-- que la experiencia no se recomiende a sí misma
alter table experiences drop constraint if exists experiences_upsell_not_self;
alter table experiences add constraint experiences_upsell_not_self
  check (upsell_experience_id is null or upsell_experience_id <> id);

-- Regalo: la compra es para otra persona (el entitlement va al email del regalado).
alter table purchases add column if not exists is_gift boolean not null default false;
alter table purchases add column if not exists gift_recipient_email citext;
alter table purchases add column if not exists gift_message text;

-- Leads: emails de gente que todavía no compró (avisar de nuevos recorridos).
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  source text,                 -- home | paywall | ...
  slug text,                   -- experiencia desde donde se captó (si aplica)
  marketing_consent boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists leads_email_uq on leads (email);
alter table leads enable row level security;
-- sin policies: escribe/lee solo el service role

notify pgrst, 'reload schema';
