# Fase 1 — Identidad + sesiones server-side · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Prerrequisito: Fase 0 completada (usa `events`, `rate_limits`, track y el webhook endurecido). Leer el bloque **Contexto operativo** del plan de Fase 0 antes de empezar — aplica entero acá.

**Goal:** Que el usuario tenga identidad por email sin contraseña (OTP), que sus compras y su progreso sobrevivan cambio de dispositivo, y que el progreso real viva en el server (`play_sessions`) con costo por sesión medible.

**Architecture:** Supabase Auth (email OTP) para la identidad; `play_sessions` (tabla ya existente) como fuente de verdad de progreso, escrita fire-and-forget desde `/api/play`; claim/backfill que une lo anónimo con el usuario al momento del login. localStorage queda como caché de mensajes.

**Tech Stack:** @supabase/supabase-js (auth OTP ya disponible vía lib/supabase/client), pg para migraciones.

---

### Task 1: Descubrir el shape real de play_sessions (NO saltear)

**Files:** ninguno (solo lectura de DB)

- [ ] **Step 1: Enums y columnas**

Crear `scripts/tmp-shape.mjs`:
```js
import pg from "pg";
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
for (const e of ["tour_phase", "session_status", "interaction_mode"]) {
  const { rows } = await c.query(`select unnest(enum_range(null::${e}))::text as v`);
  console.log(e, "=", rows.map((r) => r.v).join(" | "));
}
const { rows: cols } = await c.query(`
  select table_name, column_name, data_type from information_schema.columns
  where table_name in ('play_sessions','session_messages') order by table_name, ordinal_position`);
console.log(cols.map((r) => `${r.table_name}.${r.column_name} (${r.data_type})`).join("\n"));
await c.end();
```
Run: `node --env-file=.env.local scripts/tmp-shape.mjs` y ANOTAR el output en un comentario del PR/commit. Borrar el script.
Expected: valores de los 3 enums + columnas. **Si `session_messages` no existe**, la migración del Task 2 la crea (por eso el `create table if not exists`). **Si los valores de enum difieren de los usados en Task 3** (`CAMINANDO`/`EN_PARADA`/`EN_PAUSA`, `active`/`completed`), adaptar el mapeo del Task 3 a los valores reales.

### Task 2: Migración 0010 — consent, country, session_messages

**Files:**
- Create: `supabase/migrations/0010_identidad.sql`

- [ ] **Step 1: Crear la migración**

```sql
-- 0010: identidad — consent de marketing, país en sesiones, mensajes por turno.

alter table purchases add column if not exists marketing_consent boolean;
alter table play_sessions add column if not exists country text;

create table if not exists session_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references play_sessions(id) on delete cascade,
  role text not null,               -- user | henry | nudge
  intent text,
  step_position int,
  phase text,
  prompt_tokens int,
  output_tokens int,
  created_at timestamptz not null default now()
);
create index if not exists session_messages_session_idx on session_messages (session_id, created_at);
alter table session_messages enable row level security;
-- sin policies: solo service role

-- una sesión ACTIVA por persona+experiencia (anon)
create unique index if not exists play_sessions_active_anon_uq
  on play_sessions (experience_id, anon_id)
  where anon_id is not null and status = 'active';

notify pgrst, 'reload schema';
```
⚠️ Si el Task 1 mostró que `session_status` no tiene el valor `'active'`, reemplazar `'active'` por el valor real de sesión abierta en el índice.

- [ ] **Step 2: Aplicar** — `node --env-file=.env.local scripts/db-run.mjs supabase/migrations/0010_identidad.sql` → `✓`.

- [ ] **Step 3: Types** — agregar a `lib/database.types.ts`: columna `marketing_consent` en purchases, `country` en play_sessions, y la tabla `session_messages` (formato compacto de una línea, orden alfabético de tablas).

- [ ] **Step 4: Commit** — `git add supabase/migrations/0010_identidad.sql lib/database.types.ts && git commit -m "Migración 0010: consent, country y session_messages ..."` (con el Co-Authored-By).

### Task 3: /api/play escribe la sesión (fire-and-forget)

**Files:**
- Create: `lib/db/sessions.ts`
- Modify: `app/api/play/route.ts`
- Modify: `lib/gemini.ts` (tourReply devuelve usage)

- [ ] **Step 1: tourReply expone tokens**

En `lib/gemini.ts`, `tourReply`: después de obtener `res`, capturar
```ts
  const usage = {
    prompt: res.usageMetadata?.promptTokenCount ?? null,
    output: res.usageMetadata?.candidatesTokenCount ?? null,
  };
```
y agregar `usage` al objeto de retorno en TODOS los returns de la función (`{ reply, intent, usage }`). Actualizar el tipo de retorno a `Promise<{ reply: string; intent: string; usage: { prompt: number | null; output: number | null } }>`.

- [ ] **Step 2: `lib/db/sessions.ts`**

```ts
import { createAdminClient } from "@/lib/supabase/admin";

/** Upsert de la sesión activa + log del turno. Fire-and-forget: nunca bloquea la respuesta. */
export async function recordTurn(opts: {
  experienceId: string;
  anonId: string | null;
  stopIndex: number;   // 0-based del cliente
  phase: string;       // CAMINANDO | EN_PARADA | EN_PAUSA
  intent: string;
  finished: boolean;
  country: string | null;
  promptTokens: number | null;
  outputTokens: number | null;
}): Promise<void> {
  if (!opts.anonId) return;
  try {
    const sb = createAdminClient();
    const { data: existing } = await sb
      .from("play_sessions")
      .select("id, total_turns")
      .eq("experience_id", opts.experienceId)
      .eq("anon_id", opts.anonId)
      .eq("status", "active")
      .maybeSingle();

    let sessionId = existing?.id ?? null;
    if (!sessionId) {
      const { data: created } = await sb
        .from("play_sessions")
        .insert({
          experience_id: opts.experienceId,
          anon_id: opts.anonId,
          status: "active",
          phase: opts.phase,
          current_step_position: opts.stopIndex + 1,
          country: opts.country,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      sessionId = created?.id ?? null;
    } else {
      await sb
        .from("play_sessions")
        .update({
          phase: opts.phase,
          current_step_position: opts.stopIndex + 1,
          total_turns: (existing?.total_turns ?? 0) + 1,
          last_active_at: new Date().toISOString(),
          ...(opts.finished ? { status: "completed" } : {}),
          ...(opts.country ? { country: opts.country } : {}),
        })
        .eq("id", sessionId);
    }
    if (sessionId) {
      await sb.from("session_messages").insert({
        session_id: sessionId,
        role: "henry",
        intent: opts.intent,
        step_position: opts.stopIndex + 1,
        phase: opts.phase,
        prompt_tokens: opts.promptTokens,
        output_tokens: opts.outputTokens,
      });
    }
  } catch {
    /* nunca romper el chat por telemetría */
  }
}
```
⚠️ Ajustar `phase`/`status` a los valores reales de los enums descubiertos en Task 1 (si `tour_phase` es un enum en la DB con esos mismos literales, pasa directo; si difieren, mapear).

- [ ] **Step 3: llamarlo desde /api/play**

En `app/api/play/route.ts`, después de obtener `result` de `tourReply` y ANTES del return, agregar (sin await bloqueante — pero en serverless conviene esperar: usar `await` igualmente, tarda <100ms):
```ts
    await recordTurn({
      experienceId: exp.id,
      anonId: typeof body.anonId === "string" ? body.anonId : null,
      stopIndex,
      phase,
      intent: result.intent,
      finished: result.intent === "finish",
      country: req.headers.get("x-vercel-ip-country"),
      promptTokens: result.usage?.prompt ?? null,
      outputTokens: result.usage?.output ?? null,
    });
```
Import: `import { recordTurn } from "@/lib/db/sessions";`

- [ ] **Step 4: límite duro server-side**

En el mismo route, reemplazar la línea `const totalTurns = Math.max(0, Number(body.totalTurns ?? 0));` por:
```ts
    let totalTurns = Math.max(0, Number(body.totalTurns ?? 0));
    if (typeof body.anonId === "string") {
      const { data: sess } = await createAdminClient()
        .from("play_sessions")
        .select("total_turns")
        .eq("experience_id", exp.id)   // ⚠️ mover este bloque DESPUÉS de cargar exp
        .eq("anon_id", body.anonId)
        .eq("status", "active")
        .maybeSingle();
      totalTurns = Math.max(totalTurns, sess?.total_turns ?? 0);
    }
```
Nota de orden: el check de HARD_TURN_LIMIT hoy corre antes de cargar `exp`; moverlo a después del `Promise.all` que carga `exp` (el guard barato del cliente puede quedarse arriba además). Import de `createAdminClient` ya que el route no lo tiene.

- [ ] **Step 5: Verificar**

2 POSTs a /api/play (gratis, mensajes cortos) y consultar con script efímero:
`select s.status, s.total_turns, s.current_step_position, s.country, (select count(*) from session_messages m where m.session_id = s.id) as msgs from play_sessions s order by s.created_at desc limit 1;`
Expected: 1 sesión active con total_turns≥1 y msgs≥2, tokens no nulos en session_messages.

- [ ] **Step 6: Commit** — `git add lib/db/sessions.ts lib/gemini.ts app/api/play/route.ts && git commit ...`

### Task 4: Checkout con consent de marketing

**Files:**
- Modify: `app/api/checkout/route.ts`
- Modify: `app/api/stripe/webhook/route.ts`

- [ ] **Step 1**: en `checkout.sessions.create` agregar `consent_collection: { promotions: "auto" },`.
- [ ] **Step 2**: en el webhook, dentro de `checkout.session.completed`, al update de `purchases` agregar `marketing_consent: s.consent?.promotions === "opt_in",`.
- [ ] **Step 3**: `npx tsc --noEmit` limpio (si el type de Stripe no conoce `consent`, castear `s as Stripe.Checkout.Session & { consent?: { promotions?: string } }`).
- [ ] **Step 4**: Commit.

### Task 5: Login OTP + claim

**Files:**
- Create: `app/cuenta/page.tsx` (client: pedir email → OTP → verificar)
- Create: `app/api/claim/route.ts`
- Modify: `app/page.tsx` (botón "Mis recorridos" en el nav, al lado de las redes)

- [ ] **Step 1: página /cuenta**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CuentaPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code" | "done">("email");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sb = createClient();

  async function sendCode() {
    setBusy(true); setErr(null);
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setErr("No pudimos mandarte el código. Revisá el email.");
    else setStage("code");
  }

  async function verify() {
    setBusy(true); setErr(null);
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    if (error) { setErr("Código incorrecto o vencido."); setBusy(false); return; }
    // unir lo anónimo de este dispositivo + compras por email
    const anonId = localStorage.getItem("henry_anon");
    await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId }),
    });
    setBusy(false);
    router.push("/mis-recorridos");
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-paper px-6 text-ink">
      <div className="w-full max-w-sm">
        <h1 className="font-condensed text-[26px] font-bold uppercase tracking-[-0.015em]">Tus recorridos</h1>
        <p className="mt-1 text-sm text-ink/60">
          Poné el email con el que compraste y te mandamos un código. Sin contraseñas.
        </p>
        {stage === "email" && (
          <div className="mt-6 space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com"
              className="w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-[16px] outline-none focus:border-ink/40" />
            <button onClick={sendCode} disabled={busy || !email.includes("@")}
              className="w-full rounded-full bg-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-50">
              {busy ? "Enviando…" : "Mandame el código"}
            </button>
          </div>
        )}
        {stage === "code" && (
          <div className="mt-6 space-y-3">
            <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código de 6 dígitos"
              className="w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-center text-[20px] tracking-[0.3em] outline-none focus:border-ink/40" />
            <button onClick={verify} disabled={busy || code.trim().length < 6}
              className="w-full rounded-full bg-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-50">
              {busy ? "Verificando…" : "Entrar"}
            </button>
          </div>
        )}
        {err && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{err}</p>}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: /api/claim (el merge, UNA regla)**

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Sin sesión." }, { status: 401 });

  const { anonId } = (await req.json().catch(() => ({}))) as { anonId?: string };
  const admin = createAdminClient();
  const email = user.email;

  // 1) lo comprado desde ESTE dispositivo → user_id
  if (typeof anonId === "string" && anonId.length >= 24) {
    await admin.from("entitlements").update({ user_id: user.id }).eq("anon_id", anonId).is("user_id", null);
    await admin.from("play_sessions").update({ user_id: user.id }).eq("anon_id", anonId).is("user_id", null);
  }
  // 2) lo comprado con este email desde CUALQUIER dispositivo → user_id
  await admin.from("entitlements").update({ user_id: user.id }).eq("grant_email", email).is("user_id", null);

  return NextResponse.json({ ok: true });
}
```
⚠️ El update de `entitlements` puede chocar con `entitlements_user_uq` (única por experiencia+user) si la misma persona compró la misma experiencia como anon Y por email: ante error 23505 en el segundo update, ignorarlo (ya tiene el acceso).

- [ ] **Step 3: botón en la home** — en el nav de `app/page.tsx`, después del bloque de redes:
```tsx
              <Link href="/cuenta" className="ml-2 rounded-full border border-white/25 px-3.5 py-1.5 text-[12px] font-semibold text-white/85 transition hover:bg-white/10">
                Mis recorridos
              </Link>
```

- [ ] **Step 4: Verificar** — el OTP manda email real vía Supabase (limitado a ~3-4/hora por email en el plan free de emails): probar UNA vez con el email del dueño o verificar por código: `npx tsc --noEmit` + páginas 200 (`/cuenta`).
- [ ] **Step 5: Commit.**

### Task 6: Página /mis-recorridos

**Files:**
- Create: `app/mis-recorridos/page.tsx` (server component)

- [ ] **Step 1: página**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function MisRecorridosPage() {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) redirect("/cuenta");

  const admin = createAdminClient();
  const { data: ents } = await admin
    .from("entitlements")
    .select("experience_id, created_at")
    .eq("user_id", user.id)
    .is("revoked_at", null);
  const ids = (ents ?? []).map((e) => e.experience_id);
  const { data: exps } = ids.length
    ? await admin.from("experiences").select("id, slug, title, theme, expected_minutes, distance_m").in("id", ids)
    : { data: [] as never[] };
  const { data: sessions } = await admin
    .from("play_sessions")
    .select("experience_id, status, current_step_position")
    .eq("user_id", user.id);

  const stateOf = (id: string) => sessions?.find((s) => s.experience_id === id);
  const pasos = (m: number | null) => (m ? `~${Math.round((m * 1.3) / 100) * 100} pasos` : "");

  return (
    <main className="min-h-[100dvh] bg-paper px-5 py-10 text-ink">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-condensed text-[28px] font-bold uppercase tracking-[-0.015em]">Mis recorridos</h1>
        <p className="mt-1 text-sm text-ink/55">{user.email}</p>
        <ul className="mt-8 space-y-3">
          {(exps ?? []).map((e) => {
            const s = stateOf(e.id);
            const done = s?.status === "completed";
            return (
              <li key={e.id} className="flex items-center justify-between rounded-2xl border border-ink/10 bg-card p-4">
                <div>
                  <p className="text-[15px] font-semibold">{e.title}</p>
                  <p className="text-[12px] text-ink/50">
                    {done ? `Terminado · ${pasos(e.distance_m)}` : s ? `En curso · parada ${s.current_step_position}` : "Sin empezar"}
                  </p>
                </div>
                <Link href={`/e/${e.slug}/chat`} className="rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-white">
                  {done ? "Revivir" : s ? "Seguir" : "Empezar"}
                </Link>
              </li>
            );
          })}
          {(exps ?? []).length === 0 && (
            <p className="rounded-2xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
              Todavía no hay recorridos con este email. Si compraste con otro, entrá con ese.
            </p>
          )}
        </ul>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verificar** — `/mis-recorridos` sin sesión redirige a `/cuenta` (302 en curl con `-I`); tsc limpio.
- [ ] **Step 3: Commit.**

### Task 7: Resume cross-device en el chat

**Files:**
- Modify: `app/api/experience/route.ts` (devolver `serverProgress`)
- Modify: `components/PlayerLoader.tsx` y `components/PlayerChat.tsx`

- [ ] **Step 1**: en `/api/experience`, tras cargar `exp`, si vino `anonId` buscar sesión activa (`play_sessions` por experience+anon, `status='active'`) y agregar al JSON: `serverProgress: sess ? { stopIndex: Math.max(0, sess.current_step_position - 1), phase: sess.phase, totalTurns: sess.total_turns } : null`.
- [ ] **Step 2**: en `PlayerChat`, al inicializar: si NO hay guardado local (`saved === null`) pero llega `serverProgress` con `stopIndex > 0`, inicializar `tour` desde ahí y abrir con el saludo de reanudación existente (`resumeGreeting`) en lugar del opening. Prop nueva `serverProgress?: { stopIndex: number; phase: string; totalTurns: number } | null` pasada desde `PlayerLoader` (agregar al type `Data`).
- [ ] **Step 3**: Verificar manual: borrar localStorage del navegador (o curl: `/api/experience` con el anonId usado en Task 3 devuelve `serverProgress` no nulo). tsc limpio.
- [ ] **Step 4: Commit.**

---

## Self-check final de la fase

- [ ] tsc + build limpios; rutas 200 (incluye `/cuenta`, `/mis-recorridos`).
- [ ] `play_sessions` registra turnos con tokens; sesión pasa a `completed` al terminar.
- [ ] Login OTP end-to-end probado UNA vez con email real.
- [ ] `/api/claim` idempotente (correrlo dos veces no rompe).
- [ ] NO deployar sin pedido explícito del dueño.
