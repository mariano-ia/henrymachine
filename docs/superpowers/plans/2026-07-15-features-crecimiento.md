# Features de crecimiento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) o superpowers:executing-plans para ejecutar task por task. Los pasos usan checkbox (`- [ ]`).

**Goal:** Compartir al terminar (con imagen OG de los pasos), captura de email en dos momentos (arranque + paywall) que habilita volver desde el correo, y un botón para compartir el ranking — más ventana de progreso a 7 días y vencimiento de compra no empezada a 90 días, con empty states.

**Architecture:** Next.js 15 App Router. La captura de email reusa `leads` + `/api/lead`. La atribución reusa el `?ref` que `track.ts` ya captura. El vencimiento de 90 días es *lazy* (se evalúa al leer el acceso en `getPlayableExperience`); "empezado" se deriva de `play_sessions`. Los correos usan Resend (`lib/email.ts`). El recontacto con cupón (Fase F) usa un Vercel Cron.

**Tech Stack:** TypeScript, Next 15, Tailwind, `@supabase/supabase-js` (service_role server-side), Stripe, Resend, `next/og` (`ImageResponse`).

---

## Contexto operativo (leer ANTES de tocar nada)

- **Dev:** `pkill -f "next dev"; sleep 1; rm -f dev.log && nohup npm run dev > dev.log 2>&1 &` (el pkill primero SIEMPRE).
- **Migraciones:** `node --env-file=.env.local scripts/db-run.mjs supabase/migrations/00XX_nombre.sql` (transaccional). Versionar siempre en `supabase/migrations/`.
- **Typecheck:** `npx tsc --noEmit` (si aparecen `.next/types/* 2.ts`, borrar con `find .next -name "* 2.*" -delete`).
- **Smoke:** `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/<ruta>`.
- **⚠️ Stripe LIVE:** jamás completar una compra real. Probar el flujo gratis con `domingo-williamsburg`. Crear un product/price nuevo NO es un cargo.
- **⚠️ NO deployar** (el dueño lo pide explícito). No imprimir valores de `.env.local`. No tocar otros proyectos Supabase.
- **Voz:** copy del chat/correos en PERUANO (tú/tienes, "querubín", "choche"; nunca voseo). Copy de UI del sitio, seguir lo existente.
- **Commits:** en español, cuerpo corto, terminar con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Un commit por task.
- **Sin framework de tests:** la verificación es `tsc` + smoke con curl + una nota de verificación manual en el navegador. No hay pytest/jest.
- **Spec:** `docs/superpowers/specs/2026-07-15-features-crecimiento-design.md`.

## File Structure (qué toca cada cosa)

- `supabase/migrations/0019_crecimiento.sql` — ventana de progreso 7d + helper `entitlement_started`.
- `lib/db/experiences.ts` — vencimiento 90d lazy (`purchaseExpired`), grounding ya gateado.
- `lib/db/sessions.ts` / `app/api/experience/route.ts` — exponer `purchaseExpired`, ventana 7d server.
- `lib/share.ts` (nuevo) — helper `shareOrCopy(text, url)`.
- `lib/email-capture.ts` (nuevo, client) — `getCapturedEmail`/`setCapturedEmail` (localStorage `henry_email`).
- `components/EmailCaptureCard.tsx` (nuevo) — tarjeta reutilizable de captura.
- `components/ShareButton.tsx` (nuevo) — botón Web Share + fallback copiar.
- `app/e/[slug]/opengraph-image.tsx` (nuevo) — imagen OG dinámica.
- `components/PlayerChat.tsx` — share al terminar, captura momento 1 y 2, ventana 7d, resume parada 1, tarjeta de pausa, empty state progreso.
- `components/PlayerLoader.tsx` — empty state compra vencida.
- `components/Leaderboard.tsx` + `components/LeaderboardShare.tsx` (nuevo) — botón compartir.
- `app/api/lead/route.ts` — correo con el link al capturar en el arranque.
- `app/api/checkout/route.ts` — `customer_email` (prefill).
- `lib/email.ts` — copy "no vence" + `sendTourLinkEmail`.
- `components/GiftSentBanner.tsx`, `app/terminos/page.tsx` — copy dos relojes.
- `app/api/cron/expiry/route.ts` (nuevo, Fase F) + `vercel.json` (cron).

---

## FASE A — Datos y ventanas (base, sin UI nueva)

### Task A1: Migración 0019 — ventana 7d + helper "empezado"

**Files:**
- Create: `supabase/migrations/0019_crecimiento.sql`
- Modify: `lib/database.types.ts` (registrar la función nueva)

- [ ] **Step 1: Escribir la migración**

```sql
-- 0019: ventana de progreso a 7 días + helper para saber si un entitlement fue "empezado".

-- Progreso: la ventana de reanudación pasa de 24h a 7 días (168h). Aplica a
-- experiencias existentes y nuevas.
alter table experiences alter column resume_window_hours set default 168;
update experiences set resume_window_hours = 168 where resume_window_hours = 24;

-- "Empezado" = existe una play_session con progreso real (EN_CURSO o TERMINADO)
-- para ese dueño (anon o user) y experiencia. Se usa para el vencimiento de 90
-- días de compras NO empezadas y para el job recordatorio.
create or replace function entitlement_started(
  p_experience_id uuid, p_anon_id text, p_user_id uuid, p_grant_email text
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from play_sessions s
    where s.experience_id = p_experience_id
      and s.status in ('EN_CURSO','TERMINADO')
      and (
        (p_anon_id is not null and s.anon_id = p_anon_id)
        or (p_user_id is not null and s.user_id = p_user_id)
      )
  );
$$;

-- Índice para el job recordatorio: entitlements de compra sin revocar por fecha.
create index if not exists entitlements_created_active_idx
  on entitlements (created_at) where revoked_at is null and source = 'purchase';
```

- [ ] **Step 2: Correr la migración**

Run: `node --env-file=.env.local scripts/db-run.mjs supabase/migrations/0019_crecimiento.sql`
Expected: `OK` sin errores (DDL transaccional).

- [ ] **Step 3: Verificar**

Run: `node --env-file=.env.local scripts/db-run.mjs <(echo "select resume_window_hours from experiences limit 3; select entitlement_started('00000000-0000-0000-0000-000000000000','x',null,null);")`
Expected: `resume_window_hours = 168` y la función devuelve `false` (no rompe).

- [ ] **Step 4: Registrar la función en los tipos** (sin esto, `sb.rpc("entitlement_started")` de A2 rompe `tsc`: las RPC se validan contra `Database["public"]["Functions"]`)

En `lib/database.types.ts`, dentro de `Functions: { ... }` (junto a `is_admin`, ~línea 179), agregar:
```ts
      entitlement_started: { Args: { p_experience_id: string; p_anon_id: string | null; p_user_id: string | null; p_grant_email: string | null }; Returns: boolean }
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0019_crecimiento.sql lib/database.types.ts
git commit -m "Migración 0019: ventana de progreso 7d + helper entitlement_started"
```

### Task A2: Vencimiento 90d lazy en getPlayableExperience

**Files:**
- Modify: `lib/db/experiences.ts` (bloque de `hasAccess`, ~líneas 87-97; tipo `PlayableExperience`, ~línea 40)

Regla: un entitlement `purchase` **no empezado** cuya compra (`purchases.paid_at`) tiene más de 90 días → NO da acceso, y se marca `purchaseExpired`. Un entitlement empezado no vence.

- [ ] **Step 1: Agregar `purchaseExpired` al tipo `PlayableExperience`**

```ts
  purchaseExpired: boolean; // compró pero no empezó y pasaron 90 días
```

- [ ] **Step 2: Reemplazar el cómputo de acceso** (el bloque `let hasAccess = ...` actual)

```ts
  let hasAccess = exp.price_cents === 0;
  let purchaseExpired = false;
  if (!hasAccess && anonId) {
    const { data: ent } = await sb
      .from("entitlements")
      .select("id, purchase_id, created_at")
      .eq("experience_id", exp.id)
      .eq("anon_id", anonId)
      .is("revoked_at", null)
      .maybeSingle();
    if (ent) {
      // ¿empezó? si sí, es para siempre. si no, vence a los 90 días de pagar.
      const { data: started } = await sb.rpc("entitlement_started", {
        p_experience_id: exp.id,
        p_anon_id: anonId,
        p_user_id: null,
        p_grant_email: null,
      });
      let paidAt: string | null = ent.created_at;
      if (ent.purchase_id) {
        const { data: pur } = await sb
          .from("purchases")
          .select("paid_at")
          .eq("id", ent.purchase_id)
          .maybeSingle();
        paidAt = pur?.paid_at ?? ent.created_at;
      }
      const ageDays = paidAt ? (Date.now() - new Date(paidAt).getTime()) / 86400000 : 0;
      if (started === true || ageDays <= 90) {
        hasAccess = true;
      } else {
        purchaseExpired = true; // no empezó y venció
      }
    }
  }
```

- [ ] **Step 3: Devolver `purchaseExpired`** en el objeto retornado (junto a `locked`)

```ts
    locked: exp.price_cents > 0 && !hasAccess,
    purchaseExpired,
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: exit 0. (Si algún consumidor de `getPlayableExperience` rompe por el campo nuevo, es aditivo — no debería.)

- [ ] **Step 5: Commit**

```bash
git add lib/db/experiences.ts
git commit -m "Vencimiento 90d de compra no empezada (lazy) + flag purchaseExpired"
```

### Task A3: Ventana de progreso 7d + resume desde parada 1

**Files:**
- Modify: `components/PlayerChat.tsx:48` (`RESUME_WINDOW_MS`), `:178-188` (`serverResume`)

- [ ] **Step 1: Ventana local a 7 días**

En `components/PlayerChat.tsx`, línea ~48:
```ts
const RESUME_WINDOW_MS = 7 * 24 * 3600 * 1000; // 7 días para retomar
```

- [ ] **Step 2: Permitir resume server-side desde la parada 1**

En el `useState<State | null>` de `serverResume` (~línea 181), cambiar la guarda que exige `stopIndex <= 0`:
```ts
    // antes: if (stopIndex <= 0 || stopIndex >= stops.length) return null;
    if (stopIndex < 0 || stopIndex >= stops.length) return null;
```
Nota: el resto de la lógica (fase, totalTurns) queda igual. Con esto "Mis recorridos" reanuda aunque hayas dejado en la parada 1.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` → exit 0.
Verificación manual: en el navegador, jugar `domingo-williamsburg`, avanzar a la parada 1, cerrar y reabrir → retoma. (El server-side real se prueba logueado; ver Fase E para la comunicación al usuario.)

- [ ] **Step 4: Commit**

```bash
git add components/PlayerChat.tsx
git commit -m "Progreso: ventana 7 días + reanudar desde la parada 1"
```

### Task A4: Ventana de progreso 7d **server-side** (real)

Hoy `lib/db/sessions.ts` escribe `expires_at` con 48h hardcodeado y `/api/experience` lee la sesión EN_CURSO sin filtrar por vencimiento — así que la ventana server no está acotada. Esta task la entrega de verdad.

**Files:**
- Modify: `lib/db/sessions.ts` (cálculo de `expires_at`, ~línea 31, usado en insert ~55 y update ~68), `app/api/experience/route.ts` (lectura de `serverProgress`, ~líneas 19-25)

- [ ] **Step 1: 7 días en `sessions.ts`** — donde hoy calcula `Date.now() + 48 * 3600 * 1000`, cambiar a 168h:

```ts
  const expiresAt = new Date(Date.now() + 168 * 3600 * 1000).toISOString(); // 7 días
```
Usar `expiresAt` en el `expires_at` del insert y del update de la sesión (reemplaza el valor de 48h).

- [ ] **Step 2: No reanudar sesiones vencidas** — en `app/api/experience/route.ts`, la query de la sesión EN_CURSO (serverProgress) filtra solo por status; agregar el filtro de no-vencida:

```ts
    .eq("status", "EN_CURSO")
    .gt("expires_at", new Date().toISOString())
```

- [ ] **Step 3: Verificar** — `npx tsc --noEmit` → 0. Smoke `/api/experience` (POST con slug+anonId) → 200.

- [ ] **Step 4: Commit**

```bash
git add lib/db/sessions.ts app/api/experience/route.ts
git commit -m "Progreso: ventana de 7 días también server-side (expires_at a 168h + filtro al leer)"
```

---

## FASE B — Compartir al terminar + imagen OG

### Task B1: Helper de compartir + botón reutilizable

**Files:**
- Create: `lib/share.ts`, `components/ShareButton.tsx`

- [ ] **Step 1: `lib/share.ts`**

```ts
"use client";

/** Comparte con el share nativo del cel; en desktop cae a copiar el link. */
export async function shareOrCopy(text: string, url: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ text, url });
      return "shared";
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "copied";
  } catch {
    return "failed";
  }
}
```

- [ ] **Step 2: `components/ShareButton.tsx`**

```tsx
"use client";

import { useState } from "react";
import { shareOrCopy } from "@/lib/share";

export default function ShareButton({
  text, url, label, className,
}: { text: string; url: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        const r = await shareOrCopy(text, url);
        if (r === "copied") { setCopied(true); setTimeout(() => setCopied(false), 2000); }
      }}
      className={className}
    >
      {copied ? "¡Link copiado!" : label}
    </button>
  );
}
```

- [ ] **Step 3: Verificar** — `npx tsc --noEmit` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add lib/share.ts components/ShareButton.tsx
git commit -m "Helper y botón de compartir (Web Share + fallback copiar)"
```

### Task B2: Imagen OG dinámica del detalle

**Files:**
- Create: `app/e/[slug]/opengraph-image.tsx`
- Modify: `app/e/[slug]/page.tsx` (quitar el `images` manual del `openGraph` en `generateMetadata` para que gane la imagen dinámica)

- [ ] **Step 1: Crear `app/e/[slug]/opengraph-image.tsx`**

```tsx
import { ImageResponse } from "next/og";
import { getExperienceDetail } from "@/lib/db/detail";
import { metersToSteps } from "@/lib/steps";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exp = await getExperienceDetail(slug);
  const steps = metersToSteps(exp?.distanceM ?? null);
  const barrio = exp?.neighborhood ?? exp?.city ?? "Nueva York";
  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", background: "#14161b", color: "#fff", padding: 80 }}>
        <div style={{ fontSize: 30, opacity: 0.7 }}>La Nueva York de Henry · by Resilentos</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {steps && <div style={{ fontSize: 96, fontWeight: 800, color: "#FCCC0A" }}>{steps.toLocaleString("es-PE")} pasos</div>}
          <div style={{ fontSize: 56, fontWeight: 700 }}>por {barrio}, con Henry</div>
        </div>
        <div style={{ fontSize: 30, opacity: 0.7 }}>caminaconhenry.com</div>
      </div>
    ),
    { ...size }
  );
}
```

- [ ] **Step 2: Quitar el `images` manual del detalle** en `app/e/[slug]/page.tsx` (`generateMetadata`), para que Next use la imagen dinámica del archivo:

```ts
    // en el openGraph de generateMetadata, borrar la línea:
    //   images: cover ? [cover] : ["/hero_background.jpg"],
    // (Next toma automáticamente app/e/[slug]/opengraph-image.tsx)
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` → exit 0.
Smoke: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/e/domingo-williamsburg/opengraph-image` → 200 (image/png).

- [ ] **Step 4: Commit**

```bash
git add app/e/[slug]/opengraph-image.tsx app/e/[slug]/page.tsx
git commit -m "Imagen OG dinámica del recorrido (pasos + barrio) para compartir"
```

### Task B3: Plomería de pasos/barrio + botón "Compartir mi recorrido"

El texto de compartir necesita los pasos y el barrio REALES. Hoy NO llegan al player: la ruta de chat renderiza solo `<PlayerLoader slug=.../>`, que se nutre de `POST /api/experience` → `getPlayableExperience`, cuyo SELECT (experiences.ts:60) no trae `distance_m` ni `neighborhood`. Hay que plumbearlos por toda la cadena (el detalle sí los tiene, pero es OTRA ruta).

**Files:**
- Modify: `lib/db/experiences.ts` (SELECT + tipo `PlayableExperience` + return), `app/api/experience/route.ts` (exponer client-safe), `components/PlayerLoader.tsx` (tipo `Data`), `components/PlayerChat.tsx` (props + botón)

- [ ] **Step 1: `lib/db/experiences.ts`** — agregar `distance_m, neighborhood` al SELECT de `experiences` (~línea 60), al tipo `PlayableExperience` (~línea 40) y al return (~línea 160):

```ts
  // SELECT (agregar al string): ..., distance_m, neighborhood
  // tipo PlayableExperience (agregar): distanceM: number | null; neighborhood: string | null;
  // return (agregar): distanceM: exp.distance_m, neighborhood: exp.neighborhood,
```

- [ ] **Step 2: `app/api/experience/route.ts`** — sumar `distanceM` y `neighborhood` al objeto client-safe que se devuelve.

- [ ] **Step 3: `components/PlayerLoader.tsx`** — agregar al tipo `Data` (que ya hace `{...data}` hacia `PlayerChat`, así se propaga solo con tiparlo):

```ts
  distanceM: number | null;
  neighborhood: string | null;
```

- [ ] **Step 4: `components/PlayerChat.tsx`** — agregar a las props `distanceM: number | null; neighborhood: string | null;`, importar `ShareButton` y `metersToSteps` (de `@/lib/steps`), y calcular:

```ts
  const pasosNum = metersToSteps(distanceM);
  const sharePasos = pasosNum ? `${pasosNum.toLocaleString("es-PE")} pasos` : "un buen tramo";
  const shareTexto = `Caminé ${sharePasos} por ${neighborhood ?? "Nueva York"} con Henry`;
```

- [ ] **Step 5: Insertar el botón** dentro del bloque `tour.status === "TERMINADO"`, antes de `{!reviewed && <ReviewPrompt .../>}`:

```tsx
          <ShareButton
            label="Compartir mi recorrido 🗽"
            text={shareTexto}
            url={`https://caminaconhenry.com/e/${slug}?ref=compartir`}
            className="mx-auto mt-3 block rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-white transition hover:opacity-90"
          />
```

- [ ] **Step 6: Verificar** — `npx tsc --noEmit` → 0. Manual: terminar un tour; el botón muestra los pasos reales; en desktop copia el link.

- [ ] **Step 7: Commit**

```bash
git add lib/db/experiences.ts app/api/experience/route.ts components/PlayerLoader.tsx components/PlayerChat.tsx
git commit -m "Compartir al terminar: plomería de pasos/barrio + botón (share nativo + ?ref)"
```

---

## FASE C — Captura de email (2 momentos) + prefill Stripe

### Task C1: Utilidad de email capturado + tarjeta reutilizable

**Files:**
- Create: `lib/email-capture.ts`, `components/EmailCaptureCard.tsx`

- [ ] **Step 1: `lib/email-capture.ts`** (dedupe: sabemos si ya tenemos el email)

```ts
"use client";
const KEY = "henry_email";
export function getCapturedEmail(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function setCapturedEmail(email: string) {
  try { localStorage.setItem(KEY, email); } catch { /* storage bloqueado */ }
}
```

- [ ] **Step 2: `components/EmailCaptureCard.tsx`** (usada en los dos momentos; el copy y el `source` los pasa el llamador)

```tsx
"use client";

import { useState } from "react";
import { setCapturedEmail } from "@/lib/email-capture";

export default function EmailCaptureCard({
  title, source, slug, onDone, onSkip,
}: {
  title: string; source: string; slug?: string;
  onDone: () => void; onSkip?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return;
    setBusy(true);
    setCapturedEmail(v);
    try {
      await fetch("/api/lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: v, source, slug }),
      });
    } catch { /* no romper la UX */ }
    setBusy(false);
    onDone();
  }
  return (
    <form onSubmit={submit} className="rounded-2xl border border-ink/10 bg-white p-3 shadow-bubble">
      <p className="text-[14px] leading-snug text-ink">{title}</p>
      <div className="mt-2 flex gap-2">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
          placeholder="tu@email.com" aria-label="Tu email"
          className="min-w-0 flex-1 rounded-full border border-ink/15 px-3.5 py-2 text-[16px] text-ink outline-none focus:border-ink/40" />
        <button type="submit" disabled={busy}
          className="shrink-0 rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60">
          {busy ? "…" : "Guardar"}
        </button>
      </div>
      {onSkip && (
        <button type="button" onClick={onSkip} className="mt-1.5 text-[12px] text-ink/45 underline underline-offset-2">
          Ahora no
        </button>
      )}
    </form>
  );
}
```

- [ ] **Step 3: Verificar** — `npx tsc --noEmit` → 0.

- [ ] **Step 4: Commit**

```bash
git add lib/email-capture.ts components/EmailCaptureCard.tsx
git commit -m "Captura de email: util de dedupe + tarjeta reutilizable"
```

### Task C2: Momento 1 — captura al arrancar (salteable)

**Files:**
- Modify: `components/PlayerChat.tsx`

- [ ] **Step 1: Estado** — importar `EmailCaptureCard` y `getCapturedEmail` en `PlayerChat.tsx`. La captura aparece en juego gratis o con preview pago, y NUNCA a quien ya tiene el recorrido. "Ya lo tiene" = experiencia paga y no bloqueada (`priceCents > 0 && !locked`). Una sola condición:
```tsx
  const ownsIt = priceCents > 0 && !locked; // ya compró o se lo regalaron
  const [askEmail, setAskEmail] = useState<boolean>(
    () => !getCapturedEmail() && !ownsIt && stops.length > 0 && tour.status === "EN_CURSO"
  );
```

- [ ] **Step 2: Render** — insertar la tarjeta como primer mensaje del chat (después del saludo de apertura), condicionada a `askEmail`:

```tsx
      {askEmail && (
        <div className="px-3 pb-1">
          <EmailCaptureCard
            title="¿Te guardo el link por si se te corta la señal? Te lo mando al correo y lo retomas cuando quieras."
            source="player_start"
            slug={slug}
            onDone={() => setAskEmail(false)}
            onSkip={() => setAskEmail(false)}
          />
        </div>
      )}
```

- [ ] **Step 3: Verificar** — `npx tsc --noEmit` → 0. Manual: arrancar `domingo-williamsburg`, ver la tarjeta; "Ahora no" la cierra; dejar email la cierra y no reaparece al recargar (localStorage).

- [ ] **Step 4: Commit**

```bash
git add components/PlayerChat.tsx
git commit -m "Captura de email momento 1: al arrancar, salteable y deduplicada"
```

### Task C3: Momento 2 — captura en el paywall (secundaria)

**Files:**
- Modify: `components/PlayerChat.tsx` (bloque `PAYWALL`, debajo del botón de compra y la línea de confianza)

- [ ] **Step 1: Estado** — `const [askEmailPaywall, setAskEmailPaywall] = useState(false);` y `const showPaywallEmail = !getCapturedEmail();` (dedupe).

- [ ] **Step 2: Render** — dentro del bloque `tour.status === "PAYWALL"`, DESPUÉS del botón, la línea de confianza y el error, como opción secundaria:

```tsx
          {showPaywallEmail && !askEmailPaywall && (
            <button onClick={() => setAskEmailPaywall(true)}
              className="mt-3 block w-full text-center text-[12px] font-medium text-ink/50 underline underline-offset-2">
              ¿Todavía no? Déjame tu correo y te aviso de nuevos recorridos y descuentos
            </button>
          )}
          {showPaywallEmail && askEmailPaywall && (
            <div className="mt-3">
              <EmailCaptureCard
                title="Te aviso de nuevos recorridos y descuentos, ¿va?"
                source="paywall"
                slug={slug}
                onDone={() => setAskEmailPaywall(false)}
              />
            </div>
          )}
```

- [ ] **Step 3: Verificar** — `npx tsc --noEmit` → 0. Manual: en un recorrido pago con preview (crear uno gratis→pago no aplica; usar uno pago existente de prueba SIN pagar), llegar al paywall y ver la opción secundaria; el botón de compra sigue siendo el dominante.

- [ ] **Step 4: Commit**

```bash
git add components/PlayerChat.tsx
git commit -m "Captura de email momento 2: paywall, secundaria al botón de compra"
```

### Task C4: Correo con el link al capturar en el arranque

**Files:**
- Modify: `app/api/lead/route.ts`, `lib/email.ts`

- [ ] **Step 1: `lib/email.ts` — `sendTourLinkEmail`** (hermano de `sendAccessEmail`, voz peruana)

```ts
export async function sendTourLinkEmail(to: string, slug: string): Promise<void> {
  const r = client();
  if (!r) { console.warn("[email] sin RESEND_API_KEY: no se envió el link del recorrido", { to }); return; }
  try {
    const url = `${SITE}/e/${slug}/chat`;
    const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;color:#1A1A1A">
  <p style="font-size:16px;line-height:1.5">¡Aquí te dejo tu recorrido, querubín! Retómalo cuando quieras — se guarda donde lo dejaste.</p>
  <p style="margin:22px 0"><a href="${url}" style="display:inline-block;background:#CC4E2A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:15px">Seguir caminando</a></p>
  <p style="font-size:14px;color:#888;line-height:1.5">Nos vemos en la esquina.<br>— Henry</p>
</div>`;
    await r.emails.send({ from: FROM, to, subject: "Tu recorrido te espera", html });
  } catch (e) {
    console.error("[email] falló el envío del link del recorrido", { to, error: e });
  }
}
```

- [ ] **Step 2: `app/api/lead/route.ts` — enviar el link cuando `source === "player_start"` y hay slug** (después del upsert exitoso a `leads`):

```ts
  // después del upsert:
  if (typeof body.source === "string" && body.source === "player_start" && typeof body.slug === "string" && body.slug) {
    const { sendTourLinkEmail } = await import("@/lib/email");
    await sendTourLinkEmail(email, body.slug.slice(0, 80));
  }
```

- [ ] **Step 3: Verificar** — `npx tsc --noEmit` → 0. Manual: `curl -s -X POST localhost:3000/api/lead -H "Content-Type: application/json" -d '{"email":"TU_MAIL_REAL","source":"player_start","slug":"domingo-williamsburg"}'` → `{"ok":true}` y llega el correo (si `RESEND_API_KEY` está seteada).

- [ ] **Step 4: Commit**

```bash
git add app/api/lead/route.ts lib/email.ts
git commit -m "Enviar el link del recorrido por correo al capturar el email al arrancar"
```

### Task C5: Prefill de email en Stripe

**Files:**
- Modify: `app/api/checkout/route.ts`, `components/PlayerChat.tsx` (`buy()`), `components/BuyBar.tsx` (`buy()`)

- [ ] **Step 1: `app/api/checkout/route.ts`** — aceptar `email` del body y pasarlo:
```ts
  // en el tipo del body: email?: string;
  const email = typeof body.email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email) ? body.email.toLowerCase() : undefined;
  // en checkout.sessions.create(...): agregar
  ...(email ? { customer_email: email } : {}),
```

- [ ] **Step 2: Cliente** — en `PlayerChat.buy()` y `BuyBar.buy()`, incluir el email capturado en el body:
```ts
  // import { getCapturedEmail } from "@/lib/email-capture";
  body: JSON.stringify({ slug, anonId, utm: getUtm(), promo, email: getCapturedEmail() ?? undefined }),
```

- [ ] **Step 3: Verificar** — `npx tsc --noEmit` → 0. (No completar checkout LIVE; basta con que compile y el body incluya `email` cuando existe.)

- [ ] **Step 4: Commit**

```bash
git add app/api/checkout/route.ts components/PlayerChat.tsx components/BuyBar.tsx
git commit -m "Prefill de email en Stripe (customer_email) cuando ya lo tenemos"
```

---

## FASE D — Leaderboard compartible

### Task D1: Botón compartir en el ranking de la home

**Files:**
- Create: `components/LeaderboardShare.tsx`
- Modify: `components/Leaderboard.tsx`

- [ ] **Step 1: `components/LeaderboardShare.tsx`** (client, reusa `ShareButton`)

```tsx
"use client";
import ShareButton from "@/components/ShareButton";
export default function LeaderboardShare() {
  return (
    <ShareButton
      label="Compartir el ranking 🌎"
      text="Mira qué países caminan más Nueva York con Henry"
      url="https://caminaconhenry.com/?ref=ranking#ranking"
      className="mt-3 w-full rounded-full border border-ink/15 py-2 text-[12px] font-semibold text-ink/70 transition hover:bg-ink/5"
    />
  );
}
```

- [ ] **Step 2: `components/Leaderboard.tsx`** — dar `id="ranking"` al contenedor raíz e insertar `<LeaderboardShare />` antes del `</div>` de cierre. Importar el componente.

- [ ] **Step 3: Verificar** — `npx tsc --noEmit` → 0. Smoke home 200. Manual: ver el botón en la sección del ranking (recordar: la sección se oculta si no hay datos reales; con `SAMPLE_LEADERBOARD` se ve).

- [ ] **Step 4: Commit**

```bash
git add components/LeaderboardShare.tsx components/Leaderboard.tsx
git commit -m "Botón de compartir el ranking de países en la home"
```

---

## FASE E — Copy de dos relojes + empty states + tarjeta de pausa

### Task E1: Tarjeta de pausa (formas de volver + relojes)

**Files:**
- Modify: `components/PlayerChat.tsx` (donde se aplica el intent `pause` / estado `EN_PAUSA`)

- [ ] **Step 1: Render** — cuando `tour.phase === "EN_PAUSA"`, mostrar una tarjeta determinística (no depende de Henry). Ubicarla arriba del input:

```tsx
      {tour.phase === "EN_PAUSA" && (
        <div className="mx-3 mb-1.5 rounded-xl border border-ink/10 bg-white px-3.5 py-2.5 text-[12.5px] leading-snug text-ink/70">
          <b className="text-ink">Se guarda solo.</b> Tu acceso no vence. Dónde quedaste se guarda 7 días en este teléfono — o entra con tu correo y lo retomas desde cualquier lado, en <a href="/mis-recorridos" className="font-semibold text-brand underline underline-offset-2">Mis recorridos</a>.
        </div>
      )}
```

- [ ] **Step 2: Aviso de autoguardado permanente** — el spec lo pide como elemento aparte (visible SIEMPRE, no solo al pausar). En el header del chat, reemplazar el `<p>` de estado ("en línea / escribiendo…") por:

```tsx
          <p className="text-[11px] leading-tight text-white/55">
            {sending ? "escribiendo…" : "en línea · se guarda solo"}
          </p>
```

- [ ] **Step 3: Verificar** — `npx tsc --noEmit` → 0. Manual: "se guarda solo" siempre visible en el header; al pausar aparece además la tarjeta.

- [ ] **Step 4: Commit**

```bash
git add components/PlayerChat.tsx
git commit -m "Tarjeta de pausa + aviso permanente de autoguardado (formas de volver, dos relojes)"
```

### Task E2: Empty state — progreso vencido (7 días)

**Files:**
- Modify: `components/PlayerChat.tsx`

`loadSaved` devuelve `null` cuando el guardado venció (no distingue "venció" de "nunca hubo"), y el efecto que persiste el estado pisa el guardado viejo apenas monta. Por eso la detección va en el **initializer de un `useState`** (se lee una vez, antes de que el efecto reescriba), no en un efecto.

- [ ] **Step 1: Detectar el vencimiento** — junto a los otros `useState` de `PlayerChat` (usa `saveKey`, `SAVE_VERSION`, `RESUME_WINDOW_MS`, tipo `SavedPlay`, ya definidos arriba en el archivo):

```tsx
  const [resumeExpired] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(saveKey(slug));
      if (!raw) return false;
      const s = JSON.parse(raw) as SavedPlay;
      return (
        s.v === SAVE_VERSION &&
        s.tour?.status !== "TERMINADO" &&
        Date.now() - s.savedAt > RESUME_WINDOW_MS
      );
    } catch {
      return false;
    }
  });
```

- [ ] **Step 2: Render del banner** — al principio del área de mensajes (primera pantalla):

```tsx
      {resumeExpired && (
        <div className="mx-3 mt-2 rounded-xl bg-[#F4F2EC] px-3.5 py-2.5 text-[13px] leading-snug text-ink/70">
          Pasó más de una semana y perdí el rastro de dónde quedamos 😅 pero tu recorrido sigue siendo tuyo — arrancamos de nuevo, ¿va?
        </div>
      )}
```

- [ ] **Step 3: Verificar** — `npx tsc --noEmit` → 0. Manual (opcional): en la consola del navegador, editar `henry_play_<slug>` poniendo un `savedAt` viejo y recargar → ver el banner.

- [ ] **Step 4: Commit**

```bash
git add components/PlayerChat.tsx
git commit -m "Empty state de progreso vencido (7 días): el acceso sigue, arranca de nuevo"
```

### Task E3: Empty state — compra vencida (90 días) + copy dos relojes

**Files:**
- Modify: `components/PlayerLoader.tsx` (usa `purchaseExpired` del payload de `/api/experience`), `app/api/experience/route.ts` (exponer `purchaseExpired`), `lib/email.ts`, `components/GiftSentBanner.tsx`, `app/terminos/page.tsx`

- [ ] **Step 1: `app/api/experience/route.ts`** — incluir `purchaseExpired` en la respuesta client-safe (ya viene de `getPlayableExperience`).

- [ ] **Step 2: `components/PlayerLoader.tsx`** — (a) agregar `purchaseExpired: boolean;` al tipo `Data` del loader (si no, `data.purchaseExpired` no compila); (b) si `data.purchaseExpired`, renderizar el empty state ANTES de `<PlayerChat>`, con CTA a volver a comprar:

```tsx
  // tipo Data (agregar): purchaseExpired: boolean;
  // en el render, antes de montar PlayerChat:
  //   if (data.purchaseExpired) return (
  //     <div className="...pantalla centrada...">
  //       <p>Este recorrido lo compraste hace más de 90 días y no llegaste a empezarlo, así que venció.</p>
  //       <button onClick={() => router.push(`/e/${slug}`)}>Volver a comprar</button>
  //     </div>
  //   );
```

- [ ] **Step 3: Copy "no vence"** — en `lib/email.ts` `sendAccessEmail`, cambiar "Entra cuando quieras" por *"Es tuyo para siempre, no vence. Entra cuando quieras con este email"*.

- [ ] **Step 4: `GiftSentBanner`** — sumar la nota de los 90 días: *"Tiene 90 días para empezarlo; una vez que arranca, es suyo para siempre."*

- [ ] **Step 5: `/terminos`** — reemplazar "sin límite de tiempo" por la explicación de los dos relojes (acceso empezado = para siempre; compra sin empezar = 90 días para arrancar; progreso = 7 días).

- [ ] **Step 6: Verificar** — `npx tsc --noEmit` → 0. Smoke `/terminos` 200.

- [ ] **Step 7: Commit**

```bash
git add components/PlayerLoader.tsx app/api/experience/route.ts lib/email.ts components/GiftSentBanner.tsx app/terminos/page.tsx
git commit -m "Empty state compra vencida (90d) + copy consistente de los dos relojes"
```

---

## FASE F — (SEPARABLE) Recontacto con descuento + recordatorio

> Esta fase se puede diferir. Si se difiere, en Task C3 suavizar el copy a "novedades y nuevos recorridos" (sacar "y descuentos") para no prometer lo que no se manda.

### Task F1: Cron de recordatorio (día ~83) y recontacto del abandonador

**Files:**
- Create: `app/api/cron/expiry/route.ts`
- Modify: `vercel.json` (crons), `lib/email.ts` (`sendExpiryReminderEmail`, `sendComebackDiscountEmail`)

- [ ] **Step 1: `vercel.json`** — agregar cron diario (mantener `regions`):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["gru1"],
  "crons": [{ "path": "/api/cron/expiry", "schedule": "0 14 * * *" }]
}
```

- [ ] **Step 2: `app/api/cron/expiry/route.ts`** — protegido por `CRON_SECRET` (header `Authorization: Bearer`), corre dos consultas con service_role:
  - **Recordatorio:** entitlements `source='purchase'`, sin revocar, con `entitlement_started(...) = false`, cuya compra tiene entre 83 y 84 días → `sendExpiryReminderEmail(grant_email, título)`.
  - **Recontacto (solo si Fase F activa):** leads `source='paywall'` de hace ~2 días sin compra posterior → `sendComebackDiscountEmail` con un promotion code (reusar `lib/stripe-coupons.ts`). Marcar el lead como contactado (columna nueva o tabla `lead_touch`) para no repetir. *Definir el detalle de dedupe al implementar.*

```ts
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("no", { status: 401 });
  }
  // ...consultas + envíos...
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Templates** en `lib/email.ts` (`sendExpiryReminderEmail`, `sendComebackDiscountEmail`), voz peruana, con `console.error` en el catch.

- [ ] **Step 4: Verificar** — `npx tsc --noEmit` → 0. Manual (sin deploy): `curl -s -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/expiry` → `{"ok":true}`; revisar que las consultas no exploten con datos vacíos.

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/expiry/route.ts vercel.json lib/email.ts
git commit -m "Cron de vencimiento: recordatorio a los ~83d + recontacto del abandonador con cupón"
```

---

## Self-Review (cobertura del spec)

- Compartir al terminar + imagen OG → Fase B (B3 incluye la plomería de pasos/barrio hasta el player) ✅
- Captura email momento 1 (arranque, salteable, dedupe, correo con link, prefill Stripe) → C1, C2, C4, C5 ✅
- Captura email momento 2 (paywall, secundaria, dedupe) → C3 ✅
- Leaderboard compartible → Fase D ✅
- Dos relojes: progreso 7d → A1 (local default), A3 (cliente), **A4 (server real)**, E1; acceso para siempre + compra 90d → A1, A2, E3; empty states → E2 (progreso), E3 (compra) ✅
- Tarjeta de pausa (formas de volver) + aviso de autoguardado → E1 ✅
- Resume desde parada 1 → A3 ✅
- Recontacto con descuento (separable) → Fase F ✅
- Copy consistente (email, GiftSentBanner, /terminos) → E3 ✅

**Correcciones aplicadas tras el review adversarial del plan (16 hallazgos → 8 reales):**
migración renumerada a **0019** (0018 ya existía); `entitlement_started` registrado en `database.types.ts` (si no, rompe `tsc`); **A4 nueva** entrega la ventana 7d server-side de verdad (antes ninguna task tocaba `sessions.ts`); plomería real de pasos/barrio hasta `PlayerChat` (B3); condición de captura unificada (`ownsIt`); detección de `resumeExpired` con código en el initializer; `purchaseExpired` agregado al tipo `Data`; aviso de autoguardado permanente.

**Orden recomendado de ejecución:** A → B → C → D → E → (F opcional). A es base (datos/ventanas); B, C, D son independientes entre sí; E cierra copy/empty states; F es diferible.
