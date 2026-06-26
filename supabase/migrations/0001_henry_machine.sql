-- ============================================================================
-- Henry Machine — MODELO DE DATOS FINAL (endurecido)  ·  migration 0001
-- Supabase: Postgres + Auth (auth.users) + Storage. RLS ON en TODO.
-- Backend = service_role (bypassa RLS). IDs uuid, timestamps timestamptz.
--
-- DECISIÓN NUCLEAR (confirmada): el GATE del paywall vive en Postgres, no en el
-- front. Para anónimos el runtime corre 100% por service_role (la API decide qué
-- pasos servir). Para autores la RLS de steps protege drafts. El contenido pago
-- NUNCA sale de Postgres para quien no compró.
--
-- Toda la migración corre en UNA transacción (rollback total si algo falla → no
-- quedan tablas con RLS ON sin policies = lockout).  [fix perf B5]
-- ============================================================================
begin;

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";      -- emails case-insensitive sin lower()

-- ────────────────────────────────────────────────────────────────────────────
-- ENUMS  (idempotentes para re-correr en dev)  [fix perf B5]
-- ────────────────────────────────────────────────────────────────────────────
do $$ begin create type experience_status as enum ('draft','published','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type step_type as enum ('message','arrival','media','interactive','paywall'); exception when duplicate_object then null; end $$;
do $$ begin create type media_kind as enum ('video','image','audio'); exception when duplicate_object then null; end $$;
do $$ begin create type content_source_kind as enum ('youtube','pdf','url','text','video_file'); exception when duplicate_object then null; end $$;
do $$ begin create type ingest_status as enum ('pending','ingesting','ready','error'); exception when duplicate_object then null; end $$;
do $$ begin create type session_status as enum ('NO_INICIADO','EN_CURSO','TERMINADO','EXPIRADO'); exception when duplicate_object then null; end $$;
do $$ begin create type tour_phase as enum ('CAMINANDO','EN_PARADA','EN_PAUSA'); exception when duplicate_object then null; end $$;
do $$ begin create type interaction_mode as enum ('normal','express','solo_ver','refugio','safety'); exception when duplicate_object then null; end $$;
do $$ begin create type step_runtime_state as enum ('pendiente','actual','completada','salteada','vista'); exception when duplicate_object then null; end $$;
do $$ begin create type message_role as enum ('user','henry','system'); exception when duplicate_object then null; end $$;
do $$ begin create type purchase_status as enum ('pending','paid','refunded','failed','expired'); exception when duplicate_object then null; end $$;
do $$ begin create type entitlement_source as enum ('purchase','grant','free'); exception when duplicate_object then null; end $$;
do $$ begin create type sale_status as enum ('paid','refunded'); exception when duplicate_object then null; end $$;
do $$ begin create type generation_status as enum ('pending','running','done','error'); exception when duplicate_object then null; end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- updated_at (DRY) — definida ANTES de usarse en triggers
-- ────────────────────────────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- AUTORÍA
-- ────────────────────────────────────────────────────────────────────────────
create table authors (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Autor',
  is_henry     boolean not null default false,
  is_admin     boolean not null default false,   -- solo service_role lo escribe (RLS)
  created_at   timestamptz not null default now()
);

create table voice_profiles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_global  boolean not null default false,
  profile    jsonb not null default '{}'::jsonb,
  created_by uuid references authors(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index voice_profiles_one_global on voice_profiles (is_global) where is_global;

-- ────────────────────────────────────────────────────────────────────────────
-- EXPERIENCIAS
-- ────────────────────────────────────────────────────────────────────────────
create table experiences (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references authors(id) on delete restrict,
  slug          text not null unique,
  title         text not null,
  city          text,
  pitch         text,
  cover_path    text,                              -- bucket público de covers
  language      text not null default 'es',
  status        experience_status not null default 'draft',

  expected_minutes    integer,
  resume_window_hours integer not null default 24 check (resume_window_hours > 0),

  price_cents     integer not null default 0 check (price_cents >= 0),
  currency        text not null default 'usd' check (currency = lower(currency)),  -- [fix M6/B2]
  stripe_price_id text,

  -- voz GLOBAL como override apuntando a voice_profiles; voz DESTILADA por
  -- experiencia (la que produce el generador) va inline en voice_override. [fix prod #2]
  voice_profile_id uuid references voice_profiles(id) on delete set null,
  voice_override   jsonb,                          -- voz destilada por experiencia (editable)

  generated_from text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz,

  constraint paid_needs_stripe_price
    check (price_cents = 0 or stripe_price_id is not null or status <> 'published')
);
create index experiences_author_idx    on experiences (author_id);
create index experiences_published_idx on experiences (published_at desc) where status = 'published';  -- [fix perf B1]

-- ────────────────────────────────────────────────────────────────────────────
-- GROUNDING (agnóstico de Vertex)
-- ────────────────────────────────────────────────────────────────────────────
create table content_sources (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid not null references experiences(id) on delete cascade,
  inline_text   text,
  rag_provider   text,
  rag_corpus_ref text,
  ingest_status ingest_status not null default 'ready',
  ingest_error  text,
  ingested_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index content_sources_experience_uq on content_sources (experience_id);

create table content_source_items (
  id         uuid primary key default gen_random_uuid(),
  source_id  uuid not null references content_sources(id) on delete cascade,
  kind       content_source_kind not null,
  uri        text not null,
  label      text,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index content_source_items_source_idx on content_source_items (source_id, position);

-- ────────────────────────────────────────────────────────────────────────────
-- GENERACIÓN (el generador async escribe acá — service_role)  [fix prod: generation_jobs]
-- ────────────────────────────────────────────────────────────────────────────
create table generation_jobs (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid references experiences(id) on delete cascade,  -- null hasta crear el draft
  author_id     uuid not null references authors(id) on delete cascade,
  story         text not null,                     -- relato NL del autor
  step_count    integer check (step_count is null or step_count between 1 and 100),
  status        generation_status not null default 'pending',
  error         text,
  draft         jsonb,                              -- salida del generador (auditoría)
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index generation_jobs_author_idx on generation_jobs (author_id, created_at desc);

-- ────────────────────────────────────────────────────────────────────────────
-- PASOS (beats; invitación, no misión)
-- ────────────────────────────────────────────────────────────────────────────
create table steps (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid not null references experiences(id) on delete cascade,
  position      integer not null check (position >= 1),
  type          step_type not null default 'message',

  title         text,
  -- los 4 mensajes del beat (spec §8.1). body = invitación principal (back-compat). [fix prod #10]
  body          text,
  arrive_script text,
  proposal      text,
  payoff        text,
  walk_to_next  text,

  place_query   text,
  address       text,
  lat           double precision,
  lng           double precision,
  orientation_hint text,

  knowledge_scope jsonb not null default '{}'::jsonb,

  meta          jsonb not null default '{}'::jsonb,
  meta_verified boolean not null default false,

  is_paywall      boolean not null default false,
  paywall_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- DEFERRABLE: permite reordenar con un solo UPDATE batch sin colisión.  [fix integridad A1]
  constraint steps_experience_position_key unique (experience_id, position)
    deferrable initially immediate,
  -- coherencia type<->is_paywall: no dos fuentes de verdad sueltas.  [fix integridad D5]
  constraint step_paywall_type_coherent check ((type = 'paywall') = is_paywall),
  -- 'arrival' requiere al menos un puntero de lugar (el sistema, no el modelo).  [fix integridad D4]
  constraint arrival_needs_place
    check (type <> 'arrival' or place_query is not null or address is not null or
           (lat is not null and lng is not null))
);
-- (el unique constraint ya provee el índice (experience_id, position); no se duplica)  [fix perf B2]
create unique index steps_one_paywall_per_exp on steps (experience_id) where is_paywall;
-- composite key para la FK compuesta de step_media (gate consistente)  [fix integridad M4 / perf M4]
create unique index steps_id_experience_uq on steps (id, experience_id);

-- ────────────────────────────────────────────────────────────────────────────
-- MULTIMEDIA POR PASO (0..N → Storage). experience_id + step_position denormalizados.
-- ────────────────────────────────────────────────────────────────────────────
create table step_media (
  id            uuid primary key default gen_random_uuid(),
  step_id       uuid not null,
  experience_id uuid not null,
  step_position integer not null,                  -- denormalizado: gate sin join  [fix perf A1/M4]
  kind          media_kind not null,
  bucket        text not null default 'experience-media',  -- discriminador de bucket [fix prod #6]
  storage_path  text,
  external_url  text,
  gated         boolean not null default false,    -- media individual marcada como pago [fix integridad A2]
  caption       text,
  duration_sec  integer,
  width         integer,
  height        integer,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),

  -- exactamente UNA fuente (no ambas).  [fix integridad M4]
  check (num_nonnulls(storage_path, external_url) = 1),
  -- FK COMPUESTA: imposible insertar media cuyo experience_id no coincida con el del step.
  -- ata step_id + experience_id a la misma fila de steps → el gate no puede mentir. [fix M4]
  constraint step_media_step_fk
    foreign key (step_id, experience_id) references steps (id, experience_id) on delete cascade
);
create index step_media_step_idx on step_media (step_id, position);
create index step_media_exp_idx  on step_media (experience_id);

-- trigger: mantiene step_position sincronizado con steps.position (denormalización segura)
create or replace function sync_step_media_position() returns trigger
language plpgsql as $$
begin
  select position into new.step_position from steps where id = new.step_id;
  return new;
end $$;
create trigger trg_step_media_pos before insert on step_media
  for each row execute function sync_step_media_position();

-- si el step se reordena, propagar a su media
create or replace function propagate_step_position() returns trigger
language plpgsql as $$
begin
  if new.position <> old.position then
    update step_media set step_position = new.position where step_id = new.id;
  end if;
  return new;
end $$;
create trigger trg_steps_propagate_pos after update of position on steps
  for each row execute function propagate_step_position();

-- ============================================================================
-- PAGOS Y ACCESO
-- ============================================================================
create table stripe_events (
  event_id     text primary key,
  type         text not null,
  payload      jsonb not null,                     -- NOT NULL: el evento se guarda íntegro [fix integridad M3]
  received_at  timestamptz not null default now(),
  processed_at timestamptz                         -- idempotencia real = processed_at IS NOT NULL [fix pagos A3]
);

-- purchases: la fila se crea en estado 'pending' AL INICIAR el checkout (service_role),
-- con experience_id + anon_id + stripe_checkout_session_id. El webhook hace UPDATE.
-- Esto persiste el puente checkout→identidad ANTES del webhook.  [fix pagos A2 / prod relación]
create table purchases (
  id              uuid primary key default gen_random_uuid(),
  experience_id   uuid not null references experiences(id) on delete restrict,
  user_id         uuid references auth.users(id) on delete set null,
  anon_id         text,                            -- puente anónimo→pago (client_reference_id) [fix pagos A2]
  purchaser_email citext,                          -- citext: case-insensitive sin lower()  [fix perf A2]
  status          purchase_status not null default 'pending',
  amount_cents    integer not null default 0 check (amount_cents >= 0),
  currency        text not null default 'usd' check (currency = lower(currency)),

  stripe_checkout_session_id text unique,          -- idempotency anchor real
  stripe_payment_intent_id   text,
  stripe_event_id            text references stripe_events(event_id),

  created_at  timestamptz not null default now(),
  paid_at     timestamptz,
  refunded_at timestamptz,

  check (user_id is not null or anon_id is not null or purchaser_email is not null),
  check (purchaser_email is null or length(trim(purchaser_email::text)) > 0)  -- no email vacío [fix pagos M1]
);
create index purchases_experience_idx on purchases (experience_id);
create index purchases_user_idx       on purchases (user_id) where user_id is not null;
create index purchases_email_idx      on purchases (purchaser_email) where purchaser_email is not null;
create index purchases_anon_idx       on purchases (anon_id) where anon_id is not null;
create index purchases_pi_idx         on purchases (stripe_payment_intent_id) where stripe_payment_intent_id is not null;  -- refund lookup [fix pagos A4]

-- entitlements: FUENTE DE VERDAD del acceso. Solo service_role la escribe (webhook).
-- Ligada a user_id O grant_email O anon_id. unique por purchase_id = idempotencia dura.
create table entitlements (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid not null references experiences(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  grant_email   citext,                            -- citext  [fix pagos M1 / perf A2]
  anon_id       text,                              -- acceso anónimo ligado a la sesión [fix pagos A1]
  source        entitlement_source not null default 'purchase',
  purchase_id   uuid references purchases(id) on delete set null,
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz,

  constraint entitlement_subject
    check (user_id is not null or grant_email is not null or anon_id is not null),
  check (grant_email is null or length(trim(grant_email::text)) > 0)  -- no email vacío [fix pagos M1/seg A4]
);
-- únicos por sujeto (activos e inactivos: el unique es estructural)
create unique index entitlements_user_uq  on entitlements (experience_id, user_id)  where user_id is not null;
create unique index entitlements_email_uq on entitlements (experience_id, grant_email) where grant_email is not null;
create unique index entitlements_anon_uq  on entitlements (experience_id, anon_id)   where anon_id is not null;
-- idempotencia dura del webhook: una compra ⇒ a lo sumo un entitlement  [fix pagos A3 / perf A3]
create unique index entitlements_purchase_uq on entitlements (purchase_id) where purchase_id is not null;
-- índices PARCIALES sobre ACTIVOS para el lookup de acceso (el hot path)  [fix perf A2]
create index entitlements_user_active_idx  on entitlements (experience_id, user_id)
  where user_id is not null and revoked_at is null;
create index entitlements_email_active_idx on entitlements (experience_id, grant_email)
  where grant_email is not null and revoked_at is null;
create index entitlements_anon_active_idx  on entitlements (experience_id, anon_id)
  where anon_id is not null and revoked_at is null;
-- reconciliación por email al loguear (filtro solo-por-email, pendientes)  [fix perf B3]
create index entitlements_grant_email_idx on entitlements (grant_email)
  where grant_email is not null and user_id is null;

create table sales (
  id               uuid primary key default gen_random_uuid(),
  experience_id    uuid not null references experiences(id) on delete restrict,
  experience_title text,
  purchase_id      uuid references purchases(id) on delete set null,
  email            citext,
  amount_cents     integer not null check (amount_cents >= 0),  -- consistencia con purchases [fix integridad B2]
  currency         text not null default 'usd' check (currency = lower(currency)),
  status           sale_status not null default 'paid',
  stripe_session_id text,
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  refunded_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index sales_experience_idx on sales (experience_id);
create index sales_email_idx      on sales (email);
create unique index sales_stripe_session_uq on sales (stripe_session_id) where stripe_session_id is not null;

-- ============================================================================
-- RUNTIME / SESIÓN  (server stateless)
-- ============================================================================
create table play_sessions (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid not null references experiences(id) on delete cascade,

  user_id  uuid references auth.users(id) on delete set null,
  anon_id  text,
  email    citext,

  -- ligadura opcional al entitlement: habilita "uso único por compra" si se confirma. [fix prod #9]
  entitlement_id uuid references entitlements(id) on delete set null,

  status session_status   not null default 'NO_INICIADO',
  phase  tour_phase       not null default 'CAMINANDO',
  mode   interaction_mode not null default 'normal',

  current_step_position integer not null default 1,  -- puntero BLANDO (clamp en runtime) [fix integridad M2]
  turns_in_step integer not null default 0,
  total_turns   integer not null default 0,
  wind_down     boolean not null default false,
  paywall_passed boolean not null default false,

  started_at     timestamptz,
  expires_at     timestamptz,
  last_active_at timestamptz not null default now(),
  created_at     timestamptz not null default now(),

  constraint session_subject check (user_id is not null or anon_id is not null),
  -- anon_id de alta entropía (token, no id de UI adivinable)  [fix seg A3]
  constraint session_anon_entropy check (anon_id is null or length(anon_id) >= 24),
  -- una sesión EN_CURSO DEBE tener expires_at (no hay sesión viva sin caducidad) [fix integridad B4]
  constraint session_active_has_expiry check (status <> 'EN_CURSO' or expires_at is not null)
);
create index play_sessions_experience_idx on play_sessions (experience_id);
create index play_sessions_user_idx on play_sessions (user_id) where user_id is not null;
create index play_sessions_anon_idx on play_sessions (anon_id) where anon_id is not null;
create unique index play_sessions_active_by_user on play_sessions (experience_id, user_id)
  where status = 'EN_CURSO' and user_id is not null;
create unique index play_sessions_active_by_anon on play_sessions (experience_id, anon_id)
  where status = 'EN_CURSO' and anon_id is not null;
-- barrido de expiración eficiente (job)  [fix perf M1]
create index play_sessions_expiry_idx on play_sessions (expires_at) where status = 'EN_CURSO';

create table session_step_states (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references play_sessions(id) on delete cascade,
  step_id    uuid not null references steps(id) on delete cascade,
  state      step_runtime_state not null default 'pendiente',
  updated_at timestamptz not null default now(),
  unique (session_id, step_id)
);
create index session_step_states_session_idx on session_step_states (session_id);
create trigger trg_sss_updated before update on session_step_states
  for each row execute function set_updated_at();

create table session_messages (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references play_sessions(id) on delete cascade,
  role          message_role not null,
  text          text not null,
  step_position integer,
  phase         tour_phase,                        -- fase en que ocurrió (reanudación coherente) [fix prod #3]
  intent        text,                              -- intención clasificada (analytics)          [fix prod #3]
  media_id      uuid references step_media(id) on delete set null,  -- beat multimedia logueado  [fix prod #3]
  created_at    timestamptz not null default now()
);
create index session_messages_session_idx on session_messages (session_id, created_at);

create table support_flags (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid references play_sessions(id) on delete set null,
  experience_id uuid references experiences(id) on delete set null,
  user_id       uuid references auth.users(id) on delete set null,
  email         citext,
  reason        text not null,
  resolved      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index support_flags_experience_idx on support_flags (experience_id);

-- ============================================================================
-- updated_at triggers (la función set_updated_at ya está definida arriba)
-- ============================================================================
create trigger trg_experiences_updated     before update on experiences     for each row execute function set_updated_at();
create trigger trg_steps_updated           before update on steps           for each row execute function set_updated_at();
create trigger trg_content_sources_updated before update on content_sources for each row execute function set_updated_at();
create trigger trg_voice_profiles_updated  before update on voice_profiles  for each row execute function set_updated_at();

-- ============================================================================
-- REFUND: propaga purchases.refunded → entitlements.revoked_at (acople real) [fix integridad A4]
-- ============================================================================
create or replace function revoke_entitlement_on_refund() returns trigger
language plpgsql as $$
begin
  if new.status = 'refunded' and old.status is distinct from 'refunded' then
    update entitlements set revoked_at = now()
      where purchase_id = new.id and revoked_at is null;
    update sales set status = 'refunded', refunded_at = now()
      where purchase_id = new.id and status <> 'refunded';
  end if;
  return new;
end $$;
create trigger trg_purchase_refund after update on purchases
  for each row execute function revoke_entitlement_on_refund();

-- ============================================================================
-- PUBLICACIÓN: valida la experiencia entera al pasar draft→published. [fix integridad D4/A5, pagos M4]
-- (corre con privilegios del dueño; lee steps sin chocar RLS)
-- ============================================================================
create or replace function assert_publishable(exp uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  n_steps int;
  pw_pos  int;
  price   int;
  bad_arrival int;
begin
  select count(*) into n_steps from steps where experience_id = exp;
  if n_steps = 0 then raise exception 'No se puede publicar sin pasos'; end if;

  select price_cents into price from experiences where id = exp;
  select min(position) into pw_pos from steps where experience_id = exp and is_paywall;

  -- exp paga DEBE tener paso paywall (si no, se regala entera).  [fix pagos M4]
  if price > 0 and pw_pos is null then
    raise exception 'Experiencia paga sin paso paywall: se regalaría entera';
  end if;
  -- exp gratis NO debe tener paywall (estado sin sentido).        [fix integridad A5]
  if price = 0 and pw_pos is not null then
    raise exception 'Experiencia gratis con paywall: estado inválido';
  end if;

  -- todos los 'arrival' con lugar verificado (no inventar direcciones). [fix integridad D4]
  select count(*) into bad_arrival from steps
    where experience_id = exp and type = 'arrival'
      and (place_query is null and address is null and (lat is null or lng is null));
  if bad_arrival > 0 then
    raise exception 'Hay % paso(s) arrival sin dirección/lugar verificado', bad_arrival;
  end if;
end $$;

-- gatillo de publicación + inmutabilidad de published.  [fix integridad D1]
create or replace function guard_experience_publish() returns trigger
language plpgsql as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    perform assert_publishable(new.id);
    new.published_at = coalesce(new.published_at, now());
  end if;
  return new;
end $$;
create trigger trg_experience_publish before update on experiences
  for each row execute function guard_experience_publish();

-- inmutabilidad de contenido publicado: prohíbe editar/borrar/reordenar steps de
-- una experiencia 'published'. Para editar: archivar→clonar a draft, o despublicar.  [fix integridad D1]
create or replace function guard_steps_immutable() returns trigger
language plpgsql as $$
declare st experience_status;
begin
  select status into st from experiences
    where id = coalesce(new.experience_id, old.experience_id);
  if st = 'published' then
    raise exception 'No se puede modificar pasos de una experiencia publicada (clonar a draft)';
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_steps_immutable before insert or update or delete on steps
  for each row execute function guard_steps_immutable();

-- ============================================================================
-- RLS — HELPERS (SECURITY DEFINER stable, search_path fijo)
-- ============================================================================
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from authors where id = auth.uid()), false);
$$;

create or replace function is_experience_author(exp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from experiences e
    where e.id = exp and (e.author_id = auth.uid() or is_admin())
  );
$$;

-- acceso pago: OR partido en EXISTS independientes (cada uno pega a SU índice). [fix perf A2]
-- Cubre user_id, email del JWT (no vacío), y NO la rama anónima (el anónimo va por
-- service_role; ver decisión). Email vacío NUNCA matchea.  [fix seg A4 / pagos M1]
create or replace function has_experience_access(exp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from experiences e where e.id = exp and e.price_cents = 0)
    or exists (
      select 1 from entitlements en
      where en.experience_id = exp and en.revoked_at is null
        and en.user_id = auth.uid()
    )
    or exists (
      select 1 from entitlements en
      where en.experience_id = exp and en.revoked_at is null
        and auth.jwt() ->> 'email' is not null
        and en.grant_email = (auth.jwt() ->> 'email')::citext
    );
$$;

create or replace function paywall_position(exp uuid) returns integer
language sql stable security definer set search_path = public as $$
  select min(position) from steps where experience_id = exp and is_paywall;
$$;

-- gate de un paso, reusable por la RPC del player Y por el backend de signed-URLs.
-- Una sola fuente de verdad para "¿este viewer puede leer este step?".  [fix prod #5 / perf A1]
create or replace function can_read_step(p_step_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  with s as (
    select st.experience_id, st.position, e.status
    from steps st join experiences e on e.id = st.experience_id
    where st.id = p_step_id
  )
  select exists (
    select 1 from s
    where (s.status = 'published'
           or (s.status = 'archived' and has_experience_access(s.experience_id)))  -- archived conserva acceso comprado [fix integridad D2]
      and (
        paywall_position(s.experience_id) is null
        or s.position <= paywall_position(s.experience_id)
        or has_experience_access(s.experience_id)
      )
  )
  or is_experience_author((select experience_id from s));  -- autor preview
$$;

-- RPC del player: calcula el gate UNA vez (no por fila) y devuelve los pasos visibles.
-- Hot path del 90% del tráfico. RLS de steps queda para autores; esto es para el player. [fix perf A1]
create or replace function player_steps(p_exp uuid)
returns setof steps
language sql stable security definer set search_path = public as $$
  with gate as (
    select paywall_position(p_exp) as pw,
           has_experience_access(p_exp) as acc,
           exists (select 1 from experiences e
                   where e.id = p_exp
                     and (e.status = 'published'
                          or (e.status = 'archived' and has_experience_access(p_exp)))) as visible
  )
  select s.* from steps s, gate
  where s.experience_id = p_exp and gate.visible
    and (gate.pw is null or s.position <= gate.pw or gate.acc)
  order by s.position;
$$;

-- ============================================================================
-- RLS — ENABLE EN TODO
-- ============================================================================
alter table authors              enable row level security;
alter table voice_profiles       enable row level security;
alter table experiences          enable row level security;
alter table content_sources      enable row level security;
alter table content_source_items enable row level security;
alter table generation_jobs      enable row level security;
alter table steps                enable row level security;
alter table step_media           enable row level security;
alter table stripe_events        enable row level security;
alter table purchases            enable row level security;
alter table entitlements         enable row level security;
alter table sales                enable row level security;
alter table play_sessions        enable row level security;
alter table session_step_states  enable row level security;
alter table session_messages     enable row level security;
alter table support_flags        enable row level security;

-- ============================================================================
-- RLS — POLÍTICAS
-- ============================================================================

-- authors: cada uno su fila. is_admin/is_henry NO se auto-editan (solo service_role). [fix seg B2/integridad B1]
create policy authors_self on authors for select to authenticated
  using (id = auth.uid() or is_admin());
create policy authors_self_insert on authors for insert to authenticated
  with check (id = auth.uid() and is_admin = false and is_henry = false);
create policy authors_self_update on authors for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and is_admin = (select a.is_admin from authors a where a.id = auth.uid())
    and is_henry = (select a.is_henry from authors a where a.id = auth.uid())
  );

-- voice_profiles: la voz global NO viaja al cliente (es IP / prompt-leak).  [fix seg M1]
-- Solo autores leen perfiles; el player groundeado corre server-side (service_role).
create policy vp_author_read on voice_profiles for select to authenticated
  using (exists (select 1 from authors a where a.id = auth.uid()));
create policy vp_admin_write on voice_profiles for all to authenticated
  using (is_admin()) with check (is_admin());

-- experiences: público ve publicadas; autor gestiona las suyas.
create policy exp_public_read on experiences for select to anon, authenticated
  using (status = 'published');
create policy exp_author_all on experiences for all to authenticated
  using (author_id = auth.uid() or is_admin())
  with check (author_id = auth.uid() or is_admin());
-- NOTA: columnas sensibles (stripe_price_id, generated_from, voice_override) se sirven
-- al catálogo público vía VISTA experiences_public (abajo), no por select * de anon.  [fix seg M3]

-- content_sources / items: PRIVADO. Solo autor. (el player groundeado = service_role) [fix seg M2]
create policy cs_author_all on content_sources for all to authenticated
  using (is_experience_author(experience_id))
  with check (is_experience_author(experience_id));
create policy csi_author_all on content_source_items for all to authenticated
  using (exists (select 1 from content_sources s
                 where s.id = content_source_items.source_id and is_experience_author(s.experience_id)))
  with check (exists (select 1 from content_sources s
                      where s.id = content_source_items.source_id and is_experience_author(s.experience_id)));

-- generation_jobs: el autor ve los suyos. Escribir = service_role (el generador corre server). [fix prod]
create policy genjobs_author_read on generation_jobs for select to authenticated
  using (author_id = auth.uid() or is_admin());

-- steps: GATE en RLS para autores y como red de seguridad. El player usa player_steps(). [fix perf A1]
create policy steps_author_all on steps for all to authenticated
  using (is_experience_author(experience_id))
  with check (is_experience_author(experience_id));
create policy steps_player_read on steps for select to anon, authenticated
  using (can_read_step(id));   -- una sola fuente de verdad del gate  [fix prod #5]

-- step_media: gate vía el step padre (gated individual o por posición). [fix integridad A2]
create policy media_author_all on step_media for all to authenticated
  using (is_experience_author(experience_id))
  with check (is_experience_author(experience_id));
create policy media_player_read on step_media for select to anon, authenticated
  using (
    can_read_step(step_id)
    and (not gated or has_experience_access(experience_id))  -- media marcada gated requiere acceso aunque el step sea libre
  );

-- stripe_events / purchases(write) / entitlements(write) / sales(write): sin policy ⇒ solo service_role.

-- purchases: el jugador lee las suyas (email del JWT NO vacío).  [fix seg A4 / pagos M1]
create policy purchases_self_read on purchases for select to authenticated
  using (
    user_id = auth.uid()
    or (auth.jwt() ->> 'email' is not null and purchaser_email = (auth.jwt() ->> 'email')::citext)
  );
-- el autor NO lee purchases (PII de compradores anónimos). Usa sales (snapshot). [fix seg M5]
-- (si necesita conciliar emails, lo hace por service_role)

-- entitlements: el jugador lee los suyos (email del JWT NO vacío).  [fix seg A4]
create policy entitlements_self_read on entitlements for select to authenticated
  using (
    user_id = auth.uid()
    or (auth.jwt() ->> 'email' is not null and grant_email = (auth.jwt() ->> 'email')::citext)
  );

-- sales: solo el autor lee (contabilidad).
create policy sales_author_read on sales for select to authenticated
  using (is_experience_author(experience_id));

-- play_sessions: dueño logueado SELECT. El runtime anónimo va 100% por service_role.
-- Sin escritura por cliente (ni anon, ni authenticated): el avance lo hace la API. [fix seg A1/A2, pagos M5, perf M2]
create policy sessions_user_read on play_sessions for select to authenticated
  using (user_id = auth.uid());
create policy sessions_author_read on play_sessions for select to authenticated
  using (is_experience_author(experience_id));   -- analytics
-- (NO hay sessions_anon_*; el anónimo rehidrata vía API service_role)

-- session_step_states / session_messages: leer si la sesión es del usuario logueado.
-- El anónimo lee su historial vía API service_role (no por anon key). [fix seg A1]
create policy sss_self_read on session_step_states for select to authenticated
  using (exists (select 1 from play_sessions ps
    where ps.id = session_step_states.session_id and ps.user_id = auth.uid()));
create policy msgs_self_read on session_messages for select to authenticated
  using (exists (select 1 from play_sessions ps
    where ps.id = session_messages.session_id and ps.user_id = auth.uid()));

-- support_flags: el cliente NO inserta directo (anti-spam/spoofing). Se crea por API
-- service_role tras rate-limit. El autor/dueño leen.  [fix seg A5 / integridad B6]
create policy support_self_read on support_flags for select to authenticated
  using (
    user_id = auth.uid()
    or (auth.jwt() ->> 'email' is not null and email = (auth.jwt() ->> 'email')::citext)
    or is_experience_author(experience_id)
  );

-- ============================================================================
-- VISTA de catálogo público (solo columnas de vidriera) — evita filtrar
-- stripe_price_id / generated_from / voice_override por anon key.  [fix seg M3]
-- ============================================================================
create or replace view experiences_public
with (security_invoker = true) as
  select id, slug, title, city, pitch, cover_path, language,
         expected_minutes, price_cents, currency, published_at,
         (select min(position) from steps s where s.experience_id = e.id and s.is_paywall) as paywall_position
  from experiences e
  where status = 'published';
grant select on experiences_public to anon, authenticated;

commit;

-- ============================================================================
-- STORAGE (fuera del DDL relacional — se aplica con las policies de storage.objects)
-- ============================================================================
-- bucket privado 'experience-media' (media de pasos): el autor sube bajo prefijo
--   experience_id/. El player recibe URLs FIRMADAS del backend, que invoca
--   can_read_step() antes de firmar (misma fuente de verdad del gate).
-- bucket público 'experience-covers' (cover_path): lectura pública.
--
-- insert/update/delete sobre experience-media:
--   storage.foldername(name)[1] = experience_id  AND  is_experience_author(experience_id::uuid)
-- select sobre experience-media: NINGUNA policy de cliente (solo signed URLs del backend).
