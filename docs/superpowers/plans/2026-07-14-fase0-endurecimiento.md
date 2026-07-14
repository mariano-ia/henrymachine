# Fase 0 — Endurecimiento pre-lanzamiento · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el sitio aguante el primer pico de tráfico real sin quemar plata (rate limit), sin links muertos al compartir (OG), y midiendo el embudo (events + UTM + país).

**Architecture:** Next.js 15 App Router + Supabase (service role para todo lo server-side) + Gemini. El rate limit vive en Postgres (función atómica `rl_hit`), los eventos en una tabla `events` escrita solo por el server, y los UTM viajan localStorage → checkout metadata → webhook → `sales.utm_*` (columnas ya existentes).

**Tech Stack:** TypeScript, Tailwind (no tocar), @supabase/supabase-js, @vercel/analytics (nuevo), pg (dev, ya instalado).

---

## Contexto operativo (leer ANTES de tocar nada)

- **Correr dev**: `pkill -f "next dev"; sleep 1; rm -f dev.log && nohup npm run dev > dev.log 2>&1 &` — SIEMPRE el pkill primero: si queda un proceso viejo reteniendo :3000, el nuevo se va a :3001 en silencio y ves 500s fantasma.
- **Migraciones**: se corren con `node --env-file=.env.local scripts/db-run.mjs supabase/migrations/00XX_nombre.sql` (transaccional; DDL verificado). El archivo SIEMPRE se versiona en `supabase/migrations/`.
- **Typecheck**: `npx tsc --noEmit` (si aparecen errores en `.next/types/* 2.ts`, son basura: `find .next -name "* 2.*" -delete`).
- **Smoke**: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/<ruta>` — rutas clave: `/`, `/e/pizzas-brooklyn`, `/e/domingo-williamsburg/chat`, `/admin/login`.
- **Probar el motor**: `curl -s -X POST http://localhost:3000/api/play -H "Content-Type: application/json" -d '{"slug":"domingo-williamsburg","stopIndex":0,"phase":"EN_PARADA","turnsInStop":1,"totalTurns":1,"message":"hola","history":[]}'` → JSON `{reply, intent}`. Cada llamada cuesta ~medio centavo de Gemini: probar lo justo.
- **⚠️ Stripe está en LIVE**: JAMÁS completar una compra de prueba. `domingo-williamsburg` es gratis, usar esa.
- **⚠️ NUNCA** tocar otros proyectos Supabase (`luutdozbhinfiogugjbv`, `ehvsfintmkoclqehqwdv`). No imprimir valores de `.env.local`. No deployar a Vercel (el dueño lo pide explícitamente).
- **Voz**: la voz de Henry (chat/prompts/notas manuscritas) es PERUANA: tú/tienes, "mira", "querubín", "golazo", "choche" — nunca voseo. El copy de UI del sitio (botones, títulos) sí usa voseo rioplatense ("Caminá", "Elegí") y no se cambia.
- **Commits**: mensaje en español, cuerpo corto, terminar con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Commit por task.
- No hay framework de tests: la verificación es curl/node contra el dev server + queries con `scripts/db-run.mjs` o scripts node efímeros en `scripts/tmp-*.mjs` (borrarlos después).

---

### Task 1: Migración 0009 — tablas `events` y `rate_limits`

**Files:**
- Create: `supabase/migrations/0009_events_ratelimit.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
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
```

- [ ] **Step 2: Aplicarla**

Run: `node --env-file=.env.local scripts/db-run.mjs supabase/migrations/0009_events_ratelimit.sql`
Expected: `✓ supabase/migrations/0009_events_ratelimit.sql`

- [ ] **Step 3: Verificar la función**

Crear `scripts/tmp-rl.mjs`:
```js
import pg from "pg";
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
for (let i = 1; i <= 4; i++) {
  const { rows } = await c.query("select rl_hit('test:x', 60, 3) as ok");
  console.log(i, rows[0].ok);
}
await c.query("delete from rate_limits where key = 'test:x'");
await c.end();
```
Run: `node --env-file=.env.local scripts/tmp-rl.mjs && rm scripts/tmp-rl.mjs`
Expected: `1 true / 2 true / 3 true / 4 false`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0009_events_ratelimit.sql
git commit -m "Migración 0009: tabla events + rate_limits con rl_hit atómico

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 2: Rate limit en /api/play y /api/checkout

**Files:**
- Create: `lib/rate-limit.ts`
- Modify: `app/api/play/route.ts` (después de validar `message`, antes de tocar Gemini)
- Modify: `app/api/checkout/route.ts` (después de validar body)

- [ ] **Step 1: Crear `lib/rate-limit.ts`**

```ts
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** true = permitido. Ante error de DB deja pasar (fail-open: nunca romper el chat por el limiter). */
export async function rateLimit(
  req: NextRequest,
  bucket: string,
  anonId: string | null,
  windowSecs: number,
  max: number
): Promise<boolean> {
  try {
    const ip =
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "noip";
    const key = `${bucket}:${anonId ?? "anon"}:${ip}`;
    const { data, error } = await createAdminClient().rpc("rl_hit", {
      p_key: key,
      p_window_secs: windowSecs,
      p_max: max,
    });
    if (error) return true;
    return data === true;
  } catch {
    return true;
  }
}
```

Nota: `rl_hit` no está en `lib/database.types.ts` — agregarlo en `Functions`:
```ts
      rl_hit: {
        Args: { p_key: string; p_window_secs: number; p_max: number }
        Returns: boolean
      }
```
(el bloque `Functions` está ordenado alfabéticamente; va entre `paywall_position` y `set_experience_pricing`… respetar el orden real del archivo).

- [ ] **Step 2: Aplicar en /api/play**

En `app/api/play/route.ts`, importar `rateLimit` y agregar después del check de `message` vacío y ANTES del check de límite de turnos:

```ts
    // rate limit: 20 msg/min y 400/día por anonId+IP
    const anonIdForRl = typeof body.anonId === "string" ? body.anonId : null;
    const okMin = await rateLimit(req, "play-m", anonIdForRl, 60, 20);
    const okDay = await rateLimit(req, "play-d", anonIdForRl, 86400, 400);
    if (!okMin || !okDay) {
      return NextResponse.json(
        { reply: "Uy, me están llegando mensajes muy rápido 😅 dame un minutito y seguimos, ¿ya?", intent: "none" },
        { status: 429 }
      );
    }
```

- [ ] **Step 3: Aplicar en /api/checkout**

Después de validar `slug`/`anonId`:
```ts
    const okCheckout = await rateLimit(req, "checkout", anonId, 3600, 10);
    if (!okCheckout) {
      return NextResponse.json({ error: "Demasiados intentos. Probá en un rato." }, { status: 429 });
    }
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` → sin errores.
Run (21 requests seguidos):
```bash
for i in $(seq 1 21); do curl -s -o /dev/null -w "%{http_code} " -X POST http://localhost:3000/api/play -H "Content-Type: application/json" -d '{"slug":"domingo-williamsburg","stopIndex":0,"phase":"CAMINANDO","turnsInStop":0,"totalTurns":299,"message":"hola","history":[]}'; done; echo
```
Expected: los primeros `200` y los últimos `429`. (Nota: `totalTurns:299` mantiene la respuesta barata pero NO 300, porque el corte de límite duro respondería antes que el limiter en algunos casos; lo que importa es ver 429 al final.)
Después: `node --env-file=.env.local scripts/db-run.mjs` con un SQL efímero `delete from rate_limits where key like 'play-%';` para limpiar.

- [ ] **Step 5: Commit**

```bash
git add lib/rate-limit.ts app/api/play/route.ts app/api/checkout/route.ts lib/database.types.ts
git commit -m "Fase 0.2: rate limit por anonId+IP en /api/play (20/min, 400/día) y /api/checkout

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 3: Tope de tamaño en history

**Files:**
- Modify: `app/api/play/route.ts` (donde se arma `history` para `tourReply`)

- [ ] **Step 1: Recortar cada turno del historial**

Buscar la línea `history: Array.isArray(body.history) ? body.history.slice(-12) : [],` y reemplazar por:

```ts
      history: Array.isArray(body.history)
        ? body.history.slice(-12).map((t) => ({
            role: t?.role === "henry" ? ("henry" as const) : ("user" as const),
            text: String(t?.text ?? "").slice(0, 1000),
          }))
        : [],
```

- [ ] **Step 2: Verificar** — `npx tsc --noEmit` sin errores; un POST a /api/play con un history de 50.000 chars en un turno responde 200 y rápido.

- [ ] **Step 3: Commit**

```bash
git add app/api/play/route.ts
git commit -m "Fase 0.2b: tope de 1000 chars por turno de history (anti token-bomb)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 4: OG / metadata / sitemap / robots

**Files:**
- Modify: `app/layout.tsx` (metadata)
- Modify: `app/e/[slug]/page.tsx` (agregar `generateMetadata`)
- Create: `app/sitemap.ts`
- Create: `app/robots.ts`

- [ ] **Step 1: layout.tsx — metadataBase + OG default**

Reemplazar el `export const metadata` por:

```ts
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://henry-demo-zeta.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "La Nueva York de Henry — by Resilentos",
  description:
    "Micro-recorridos a pie por Nueva York guiados por chat. Henry te lleva parada por parada, como un amigo local.",
  openGraph: {
    title: "La Nueva York de Henry — by Resilentos",
    description: "Micro-recorridos a pie por Nueva York guiados por chat.",
    images: ["/hero_background.jpg"],
    locale: "es",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};
```

- [ ] **Step 2: generateMetadata en el detalle**

En `app/e/[slug]/page.tsx` (es un server component; `getExperienceDetail` ya existe y está importado), agregar antes del componente:

```ts
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exp = await getExperienceDetail(slug);
  if (!exp) return {};
  const price = exp.priceCents > 0 ? `US$${(exp.priceCents / 100).toFixed(0)}` : "Gratis";
  const cover = coverUrl(exp.coverPath); // helper ya existente en este archivo
  return {
    title: `${exp.title} · ${price} — La Nueva York de Henry`,
    description: exp.pitch ?? "Un recorrido a pie por Nueva York, guiado por chat por Henry.",
    openGraph: {
      title: `${exp.title} · ${price}`,
      description: exp.pitch ?? "",
      images: cover ? [cover] : ["/hero_background.jpg"],
    },
  };
}
```

- [ ] **Step 3: sitemap y robots**

`app/sitemap.ts`:
```ts
import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://henry-demo-zeta.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data } = await createAdminClient()
    .from("experiences_public")
    .select("slug, published_at");
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...(data ?? []).map((e) => ({
      url: `${SITE_URL}/e/${e.slug}`,
      lastModified: e.published_at ?? undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
```

`app/robots.ts`:
```ts
import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://henry-demo-zeta.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
```

- [ ] **Step 4: Verificar**

```bash
curl -s http://localhost:3000/e/pizzas-brooklyn | grep -o '<meta property="og:image"[^>]*>' | head -1
curl -s http://localhost:3000/sitemap.xml | grep -c "<url>"
curl -s http://localhost:3000/robots.txt
```
Expected: og:image apunta al cover del bucket (`experience-covers`); sitemap con 6 urls (home + 5); robots con Disallow /admin.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx "app/e/[slug]/page.tsx" app/sitemap.ts app/robots.ts
git commit -m "Fase 0.4: OG por experiencia (cover como og:image) + sitemap + robots

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 5: Eventos + Vercel Analytics + país

**Files:**
- Create: `lib/track.ts`
- Create: `app/api/track/route.ts`
- Create: `components/TrackView.tsx`
- Modify: `app/layout.tsx` (Analytics)
- Modify: `app/page.tsx`, `app/e/[slug]/page.tsx` (TrackView)
- Modify: `components/PlayerLoader.tsx` (open_chat), `components/BuyBar.tsx` y `components/PlayerChat.tsx` (begin_checkout), `components/PlayerChat.tsx` (finish_tour)

- [ ] **Step 1: instalar analytics**

Run: `npm install @vercel/analytics`
En `app/layout.tsx`: `import { Analytics } from "@vercel/analytics/react";` y agregar `<Analytics />` dentro de `<body>` después de `{children}`.

- [ ] **Step 2: `lib/track.ts` (client)**

```ts
"use client";

// Captura UTM/referrer del primer aterrizaje y manda eventos por beacon.
const UTM_KEY = "henry_utm";

export function captureUtm() {
  try {
    if (localStorage.getItem(UTM_KEY)) return;
    const p = new URLSearchParams(location.search);
    const utm: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "ref"]) {
      const v = p.get(k);
      if (v) utm[k] = v.slice(0, 100);
    }
    if (document.referrer) utm.referrer = document.referrer.slice(0, 200);
    if (Object.keys(utm).length) localStorage.setItem(UTM_KEY, JSON.stringify(utm));
  } catch {}
}

export function getUtm(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(UTM_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function track(name: string, slug?: string, props?: Record<string, unknown>) {
  try {
    const anonId = localStorage.getItem("henry_anon");
    const body = JSON.stringify({ name, slug, anonId, props: { ...getUtm(), ...props } });
    navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" })) ||
      fetch("/api/track", { method: "POST", body, keepalive: true });
  } catch {}
}
```

- [ ] **Step 3: `app/api/track/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const ALLOWED = new Set(["view_home", "view_detail", "open_chat", "begin_checkout", "finish_tour"]);

export async function POST(req: NextRequest) {
  try {
    const b = (await req.json()) as { name?: string; slug?: string; anonId?: string; props?: unknown };
    if (!b.name || !ALLOWED.has(b.name)) return NextResponse.json({ ok: false }, { status: 400 });
    await createAdminClient().from("events").insert({
      name: b.name,
      slug: typeof b.slug === "string" ? b.slug.slice(0, 80) : null,
      anon_id: typeof b.anonId === "string" ? b.anonId.slice(0, 80) : null,
      country: req.headers.get("x-vercel-ip-country"),
      props: (b.props && typeof b.props === "object" ? b.props : {}) as Record<string, unknown>,
    });
  } catch {}
  return NextResponse.json({ ok: true });
}
```

Nota: `events` tampoco está en los types — agregar la tabla a `lib/database.types.ts` (Row/Insert/Update con las columnas de la migración, mismo formato compacto de una línea que el resto).

- [ ] **Step 4: `components/TrackView.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { captureUtm, track } from "@/lib/track";

export default function TrackView({ name, slug }: { name: string; slug?: string }) {
  useEffect(() => {
    captureUtm();
    track(name, slug);
  }, [name, slug]);
  return null;
}
```

Colocar: `<TrackView name="view_home" />` dentro del `<main>` de `app/page.tsx`; `<TrackView name="view_detail" slug={exp.slug} />` en el detalle.

- [ ] **Step 5: eventos de flujo**

- `components/PlayerLoader.tsx`: en el `useEffect` inicial (después de setear anonId), `track("open_chat", slug)` (importar de `@/lib/track`).
- `components/BuyBar.tsx` función `buy()`: primera línea `track("begin_checkout", slug)`.
- `components/PlayerChat.tsx` función `buy()`: ídem con `track("begin_checkout", slug)`.
- `components/PlayerChat.tsx`: donde `next.status === "TERMINADO"` dentro de `send()` (justo antes de `setTour(next)`), agregar:
  ```ts
  if (next.status === "TERMINADO" && tour.status !== "TERMINADO") track("finish_tour", slug);
  ```

- [ ] **Step 6: Verificar**

Abrir home y detalle con curl no dispara los eventos (son client); verificar con: `curl -s -X POST http://localhost:3000/api/track -H "Content-Type: application/json" -d '{"name":"view_home","anonId":"test123"}'` → `{"ok":true}` y después consultar con script efímero `select name, anon_id, country from events order by created_at desc limit 3;` → aparece la fila (country null en local: el header lo pone Vercel).
`npx tsc --noEmit` limpio.

- [ ] **Step 7: Commit**

```bash
git add lib/track.ts app/api/track/route.ts components/TrackView.tsx app/layout.tsx app/page.tsx "app/e/[slug]/page.tsx" components/PlayerLoader.tsx components/BuyBar.tsx components/PlayerChat.tsx lib/database.types.ts package.json package-lock.json
git commit -m "Fase 0.5/0.6: eventos de embudo + Vercel Analytics + UTM + país por IP

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 6: UTM hasta la venta (sales.utm_*)

**Files:**
- Modify: `components/BuyBar.tsx` y `components/PlayerChat.tsx` (mandar utm en el body del checkout)
- Modify: `app/api/checkout/route.ts` (metadata a Stripe)
- Modify: `app/api/stripe/webhook/route.ts` (escribir sales.utm_*)

- [ ] **Step 1: los clientes mandan utm**

En ambos `buy()`: `body: JSON.stringify({ slug, anonId, utm: getUtm() })` (importar `getUtm` de `@/lib/track`).

- [ ] **Step 2: checkout → metadata**

En `app/api/checkout/route.ts`: leer `const utm = (body as { utm?: Record<string, string> }).utm ?? {};` y en `metadata` de la sesión agregar:
```ts
        utm_source: (utm.utm_source ?? "").slice(0, 100),
        utm_medium: (utm.utm_medium ?? "").slice(0, 100),
        utm_campaign: (utm.utm_campaign ?? "").slice(0, 100),
```

- [ ] **Step 3: webhook → sales**

En el insert de `sales` agregar:
```ts
        utm_source: s.metadata?.utm_source || null,
        utm_medium: s.metadata?.utm_medium || null,
        utm_campaign: s.metadata?.utm_campaign || null,
```
(las columnas ya existen en la tabla `sales` — verificar nombres exactos con `grep utm lib/database.types.ts`).

- [ ] **Step 4: Verificar** — `npx tsc --noEmit` limpio; smoke de rutas 200. (El flujo completo con Stripe NO se prueba: LIVE.)

- [ ] **Step 5: Commit**

```bash
git add components/BuyBar.tsx components/PlayerChat.tsx app/api/checkout/route.ts app/api/stripe/webhook/route.ts
git commit -m "Fase 0.5b: UTM de aterrizaje viaja al checkout y queda en sales.utm_*

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-check final de la fase

- [ ] `npx tsc --noEmit` limpio y `npm run build` exitoso (después del build: relanzar dev con el pkill).
- [ ] Rutas 200: `/`, `/e/pizzas-brooklyn`, `/e/domingo-williamsburg/chat`, `/admin/login`, `/sitemap.xml`, `/robots.txt`.
- [ ] `rl_hit` devuelve false al exceder y la tabla `rate_limits` se puede limpiar sin drama.
- [ ] NO deployar: el dueño lo pide explícitamente.
