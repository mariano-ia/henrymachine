# Henry Machine — Fase 1: Cimientos (modelo de datos + Supabase)

- **Fecha:** 2026-06-26
- **Estado:** Fundación de datos APLICADA en Supabase `henry-machine` (`cdklaxvxngmldpdiihgo`). Falta migrar el motor para correr desde la DB (1b).
- **Construido de forma autónoma** (Mariano autorizó avanzar todas las fases sin aprobación). Este doc es el trail de review.

## Qué es
Cimientos del producto definitivo: el **modelo de datos** completo (experiencias, pasos con multimedia + paywall, sesiones/progreso, compras/acceso, autores/auth) sobre **Supabase (Postgres + Auth + Storage)**, fresco. Generaliza el prototipo `/nyc12horas` para que el motor corra **cualquier** experiencia desde la DB.

## Cómo se diseñó
Panel de 10 agentes (workflow `henry-fase1-modelo-datos`): 3 diseñadores (lente "fiel a la visión", "StoryHunt", "pagos/auth/RLS") → síntesis → 5 críticos adversariales (integridad, RLS, pagos, producto, performance) → endurecido. DDL final aplicado en una transacción.

## Artefactos (en el repo)
- `supabase/migrations/0001_henry_machine.sql` — schema completo (16 tablas, 14 enums, RLS, helpers, RPC, triggers). **Fuente de verdad.**
- `supabase/migrations/0002_storage.sql` — buckets (`experience-media` privado, `experience-covers` público) + policies.
- `lib/database.types.ts` — tipos TS del schema.
- `lib/supabase/{client,server,admin}.ts` — clientes browser / SSR (auth por cookies) / service_role.

## Decisión nuclear (la más importante)
El **gate del paywall vive en Postgres, no en el front.** El contenido pago NUNCA sale de la DB para quien no compró. Mecánica:
- El **player** llama la RPC `player_steps(exp)` (`security definer`) que calcula el gate **una sola vez** y devuelve solo los pasos visibles (gratis hasta el paywall, o todos si hay acceso). Hot path eficiente.
- `can_read_step(step_id)` = **una sola fuente de verdad** del gate, reusada por la RLS de `steps` (autores) y por el backend antes de **firmar signed URLs** de media.
- El **runtime anónimo corre 100% por `service_role`** (la API decide qué servir). No se confía en headers spoofeables; no hay escritura de sesión por cliente.

## Modelo (resumen; detalle en el SQL)
- **`experiences`** (draft/published/archived, price_cents, voice_profile_id + voice_override, slug, cover). Publicar valida con `assert_publishable()` (paga ⇒ requiere paywall; gratis ⇒ sin paywall; arrival ⇒ con lugar). `published` es **inmutable** (editar = clonar a draft).
- **`steps`** (beats: message/arrival/media/interactive/paywall; invitación, no misión). `position` único `deferrable` (reordenar batch). Un solo paso `is_paywall` por experiencia. `arrival` requiere lugar.
- **`step_media`** 0..N por paso → Storage. FK compuesta `(step_id, experience_id)` (el gate denormalizado no puede mentir). `gated` para media paga en paso libre.
- **`content_sources`/`items`** (grounding agnóstico de Vertex: `rag_provider`/`rag_corpus_ref` + `inline_text`).
- **`voice_profiles`** (voz global de Henry; no viaja al cliente). Voz por experiencia = `experiences.voice_override`.
- **`generation_jobs`** (el generador async escribe acá).
- **Pagos:** `stripe_events` (idempotencia: `processed_at`), `purchases` (se crea `pending` al iniciar checkout, con `anon_id`), `entitlements` (fuente de verdad del acceso; única por purchase = idempotencia dura; refund → trigger revoca), `sales` (libro mayor).
- **Runtime:** `play_sessions` (status/phase/mode, `current_step_position` blando, t0 + `expires_at` 24h, único EN_CURSO por jugador+exp), `session_step_states`, `session_messages` (con phase/intent/media_id para reanudar), `support_flags`.

## Preguntas abiertas para Mariano (no bloquean la Fase 1)
1. **Recompra:** un `EXPIRADO` (no terminó en 24h) ¿se puede recomprar / re-jugar? (default actual: consumido.)
2. **Uso único por compra:** `play_sessions.entitlement_id` existe para atarlo si querés "una sesión por compra"; hoy no se fuerza.
3. **Reembolsos:** política exacta (solo error). El refund de Stripe revoca acceso automático vía trigger; falta definir flujo de soporte/atención.
4. **Precio:** ¿por persona o por experiencia/dispositivo? (afecta el grupo.)
5. **Voz global vs por experiencia:** confirmar que la destilada por experiencia (override) es lo que edita el constructor.

## Dependencias que necesito de vos
- **`SUPABASE_SERVICE_ROLE_KEY`** (dashboard → Project Settings → API): la necesito para el runtime anónimo, el generador y el webhook de Stripe. La dejé como placeholder en `.env.local`.
- **Stripe keys** (Fase 4).
- **Material real de Henry** (videos/imágenes/audios) para la multimedia.

## Próximo (Fase 1b → 2 → 3 → 4)
- **1b:** seed de `/nyc12horas` en la DB + capa de datos (`lib/db`) + migrar el motor (`/api/tour`) para leer la experiencia desde Supabase + ruta dinámica `/e/[slug]`. (Requiere el service_role key para escribir sesiones anónimas; mientras, se puede correr con RLS/anon en modo lectura.)
- **2:** constructor con login (Supabase Auth) + generador NL→borrador + editor visual de pasos + upload de multimedia + publicar.
- **3:** web de consumo (catálogo desde `experiences_public` + player + experiencias gratis).
- **4:** paywall por paso + Stripe checkout + control de acceso.

UI de alto nivel (sin look de IA) en todas las superficies — ver [[ui-no-look-de-ia]].
