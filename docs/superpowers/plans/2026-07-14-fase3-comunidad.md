# Fase 3 — Comunidad (pasos · top10 países · reviews) · Implementation Plan

> Ejecutada por Opus, verificación por task. Leer el bloque **Contexto operativo**
> del plan de Fase 0 (dev con pkill, migraciones con scripts/db-run.mjs, tsc,
> Stripe LIVE, voz peruana en chat / voseo en UI, commits Co-Authored-By, no deploy).

**Goal:** Comunidad y prueba social real: mostrar pasos en vez de km, un top10 de
países que más caminaron, y reviews reales pedidas en el chat (con moderación),
que reemplazan las reseñas mock.

**Architecture:** Los pasos son presentación (metros × 1,3). El leaderboard agrega
`play_sessions` TERMINADAS por país × pasos de la experiencia. Las reviews viven
en una tabla nueva con estado (moderación) y se piden en el chat al terminar.

## Estado real (2026-07-14)

- Sin tabla `reviews`. `experiences.distance_m` existe; `card_image_path` existe (0008).
- `play_sessions`: enum `session_status` = NO_INICIADO|EN_CURSO|TERMINADO|EXPIRADO;
  tiene `country` (0010). 0 sesiones TERMINADAS aún → leaderboard vacío al inicio
  (manejar estado vacío).
- El detalle (`app/e/[slug]/page.tsx`) tiene REVIEWS/RATING/RATING_COUNT mock
  hardcodeados — se borran recién en el Task de reviews (decisión del dueño).
- País: `x-vercel-ip-country` (ISO-2, ej. PE/AR) — mapear a bandera emoji.

---

### Task 1: Migración 0012 — reviews

`supabase/migrations/0012_reviews.sql`:
```sql
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
create policy "reviews_public_read" on reviews for select to anon, authenticated using (status in ('approved','featured'));
create trigger trg_reviews_updated before update on reviews for each row execute function set_updated_at();
notify pgrst, 'reload schema';
```
Verificar; types.

### Task 2: Pasos en vez de km + card_image en el admin

**Files:** `lib/steps.ts` (helper `metersToSteps`), `components/CatalogGrid.tsx`,
`app/e/[slug]/page.tsx`, `lib/db/detail.ts` (ya expone distanceM), `app/page.tsx`
(select card_image_path), admin `CoverSection`-like o campo en `ExperienceEditor`.

- Helper: `metersToSteps(m) = Math.round(m*1.3/100)*100` → "~3.600 pasos".
- Cards y stats del detalle: mostrar pasos como métrica principal, km chico al lado.
- Card de la home usa `card_image_path` (cuadrada) si existe, si no el cover.
- Admin: agregar subida de imagen cuadrada de card (reusar patrón de CoverSection
  con bucket `experience-covers`, columna `card_image_path`).

### Task 3: Pedir la review en el chat + API

**Files:** `app/api/review/route.ts`, `components/PlayerChat.tsx` (form al TERMINADO),
`app/api/experience/route.ts` (pasar si ya dejó review / anonId).

- Al TERMINADO, Henry pide la reseña: estrellas (1-5) + texto + nombre. Submit →
  POST /api/review {slug, anonId, rating, body, authorName}. Se crea 'pending' con
  verified_purchase = (tiene entitlement) y country (de la sesión / IP).
- Dedup: índice único por (experience_id, anon_id).

### Task 4: Moderación en el admin

**Files:** `app/admin/(app)/resenas/page.tsx`, `actions.ts`, `components/admin/ReviewsEditor.tsx`, link en nav.
- Lista de reviews por estado; aprobar / destacar / rechazar / borrar.

### Task 5: Detalle con reviews reales + banderas

**Files:** `lib/db/detail.ts` (traer reviews approved/featured + rating promedio +
count), `app/e/[slug]/page.tsx` (reemplazar las mock), `lib/country.ts` (ISO-2 → bandera).
- Borrar REVIEWS/RATING/RATING_COUNT mock. Mostrar reales con bandera + "compra
  verificada". Si no hay reviews, ocultar la sección (o "sé el primero").

### Task 6: Top10 países

**Files:** `lib/db/leaderboard.ts` (agregación), `components/Leaderboard.tsx`,
`app/page.tsx` (sección en la home).
- Suma de pasos de experiencias TERMINADAS por país (`play_sessions` TERMINADO ×
  `experiences.distance_m`). Top 10 con bandera. Estado vacío elegante.

## Fuera de esta fase
- 3.4 "Mis recorridos suma posición de tu país": se puede sumar al leaderboard
  resaltando el país del usuario — opcional, si queda tiempo.
