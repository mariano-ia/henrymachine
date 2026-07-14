# Plan de ejecución — Identidad, monetización y comunidad

Acordado 2026-07-14 (post charla Mariano+Henry). Decisiones del dueño incorporadas:
la cuenta de Stripe actual NO es la definitiva (no invertir ahí), las reseñas mock
QUEDAN hasta que exista el ABM real, el dominio llega más adelante (no bloquea:
esto aún no sale a prod real), transparencia de IA = sinceridad total.

## Fase 0 — Endurecimiento pre-lanzamiento ✅ COMPLETADA 2026-07-14

Ejecutada por subagentes (plan en docs/superpowers/plans/2026-07-14-fase0-endurecimiento.md).
Build de producción OK (17 páginas), smoke completo. Todo en main local, sin deployar.
Migración 0009 aplicada (events + rate_limits + rl_hit atómico).

- [x] **0.1 Webhook Stripe robusto**: chequear error de CADA write y responder 500
      (Stripe reintenta solo); idempotencia reprocesable (`stripe_events` con
      `processed_at null` = reintentar, no "duplicate"); guard server-side en
      /api/checkout ("ya lo tenés"); UI post-pago "confirmando tu pago…" en vez
      de re-ofrecer compra si el poll expira.
- [x] **0.2 Rate limit**: /api/play y /api/checkout por anonId+IP (contador simple
      en Supabase, ~20 msg/min + techo diario para no-compradores); tope de chars
      por turno de history (600/1000); ya existe tope de mensaje (1200) y
      presupuesto de turnos (240/300). ⚠️ Requiere confirmar tier de Gemini (ver
      "Necesito de Mariano").
- [x] **0.3 Transparencia IA**: eliminar la instrucción "nunca digas que sos IA"
      de lib/persona.ts (ruta /demo vieja); nota chica y sincera en home y
      detalle: "Henry virtual · IA entrenada con los videos reales de Henry".
      El motor ya lo admite con onda si le preguntan (se conserva).
- [x] **0.4 Previews + SEO**: metadataBase + openGraph en layout; generateMetadata
      en /e/[slug] (og:image = cover del bucket, título, precio); sitemap.ts +
      robots.ts desde experiencias publicadas.
- [x] **0.5 Medición mínima** (el pico del lanzamiento es irrepetible):
      @vercel/analytics; tabla `events` + /api/track (sendBeacon); 5 eventos:
      view_home, view_detail, open_chat, begin_checkout, finish_tour; captura de
      utm_*/referrer al aterrizar (localStorage junto al anonId) → metadata del
      checkout → escribir sales.utm_* (las columnas ya existen vacías).
- [x] **0.6 País gratis**: guardar `x-vercel-ip-country` en events (y luego en
      play_sessions al cablearse) — cubre a los del tour gratis, no solo tarjeta.

Migración **0009**: tabla `events` (+ índices) — la corre Mariano en el SQL editor.

## Fase 1 — Identidad + sesiones server ✅ COMPLETADA 2026-07-14

Build OK (19 páginas). Migración 0010 aplicada. Rutas nuevas /cuenta y /mis-recorridos.

- [x] **1.1 Email de compra persistido**: webhook guarda `customer_details.email`
      en purchases + entitlements.grant_email; `consent_collection: promotions`
      en el checkout y persistir el opt-in (transaccional ≠ marketing desde día 1).
- [x] **1.2 Login sin contraseña**: OTP de 6 dígitos por email (Supabase Auth);
      botón "Mis recorridos" en el nav de la home; página /mis-recorridos:
      pendientes / terminadas / pasos totales.
- [x] **1.3 Merge de identidad (regla única)**: al verificar OTP → backfill de
      user_id donde anon_id = dispositivo actual + claim de compras cross-device
      por grant_email. Persona = user_id si existe, si no anon_id.
- [x] **1.4 play_sessions server-side**: upsert por turno desde /api/play
      (posición, fase, paywall_passed, total_turns, country, wind_down) +
      session_messages por turno (fire-and-forget) con tokens de usageMetadata
      (costo real por sesión consultable). Resume cross-device: server como
      fuente de posición; localStorage queda como caché de mensajes.
- [x] **1.5 Límite de turnos server-side** (desde play_sessions; deja de confiar
      en el contador del cliente).

## Fase 2 — Plata ✅ COMPLETADA 2026-07-14

Build OK (20 páginas). Migración 0011 aplicada. Plan: docs/superpowers/plans/2026-07-14-fase2-plata.md
FIX crítico incluido: consent_collection rompía TODOS los checkouts (exigía ToS en el dashboard); reemplazado por allow_promotion_codes.

- [x] **2.1 Upsell por experiencia**: columnas upsell_experience_id +
      upsell_message + upsell_coupon (migración 0010) + sección "Al terminar"
      en el admin.
- [x] **2.2 Cupones = cáscara sobre Stripe promotion codes**: ABM en admin
      (crear %-o-monto, vencimiento, límite de usos, desactivar); Stripe es la
      única fuente de verdad de redenciones.
- [x] **2.3 Checkout con descuento**: el link del upsell aplica el código;
      allow_promotion_codes activado.
- [x] **2.4 El momento post-final en el chat**: Henry pide la reseña (fase 3
      adelanta acá su gancho) y agradece con el cupón de la siguiente
      experiencia (card comprable en el hilo).
- [x] **2.5 Regalar recorrido**: checkout "es un regalo" → email del regalado →
      entitlement por grant_email (ya existe en schema) + la nota amarilla de
      Henry como "tarjeta de regalo" compartible.
- [x] **2.6 Leads no compradores**: "avisame del próximo recorrido" en home +
      paywall del gratis (tabla leads con consent, migración 0010).
- [ ] **2.7 Emails transaccionales** — BLOQUEADO por dominio. Diseño listo:
      remitente propio (Resend), voz de Henry, 3 emails: recibo+link de acceso,
      "compraste y no arrancaste" (día 7), post-tour (review + cupón upsell).

## Fase 3 — Comunidad ✅ COMPLETADA 2026-07-14

Build OK (21 páginas). Migraciones 0012/0013/0014. Plan: docs/superpowers/plans/2026-07-14-fase3-comunidad.md
Las reseñas mock del detalle FUERON ELIMINADAS (reemplazadas por reales con moderación).

- [x] **3.1 Pasos en vez de km**: pasos ≈ metros × 1,3 en cards y detalle
      ("~7.000 pasos", km chico al lado). Copy honesto: pasos estimados.
- [x] **3.2 Top10 países**: agregación de sesiones TERMINADAS server-side ×
      pasos de la experiencia; país de sesión (IP) con override de tarjeta;
      sección en la home ("¿Qué país camina más Nueva York?").
- [x] **3.3 Reviews reales**: migración 0011 (rating, texto, país, persona,
      experiencia, estado pending/approved/featured, verified_purchase);
      pedido dentro del chat al terminar; ABM de moderación en admin;
      **recién acá se borran las mock del detalle** (decisión del dueño).
- [x] **3.4 Detalle muestra reviews reales** con banderita de país + badge
      compra verificada; "Mis recorridos" suma posición de tu país.
- [x] **3.5 Campo card_image cuadrada en admin** (columna ya existe de 0008).

## Fuera del plan, esperando insumos

- Dominio propio → desbloquea emails (2.7) y es OBLIGATORIO antes del primer
  video público (anonId/progreso atados al origin: migrar después pierde
  compradores).
- Cuenta Stripe definitiva → recién ahí statement descriptor, y migrar precios.
- Acuerdo de imagen/persona con Henry + su sign-off del dossier (no es código;
  borrador disponible si lo piden).
- Términos + privacidad + asunción de riesgo (borradores los redacto yo;
  revisión legal liviana de ellos).
- ~~Reseñas mock~~: ELIMINADAS en 3.3 (reemplazadas por reales con moderación).

## Necesito de Mariano

1. ~~Tier de Gemini~~ RESUELTO: prepago Nivel 1 (pago) con ~USD 24 de crédito
   → tope duro natural, aguanta el pico. Recomendado: recarga automática ON +
   alerta de presupuesto (para que no muera). Failover a `GEMINI_API_KEY_FALLBACK`
   ya cableado en lib/gemini.ts.
2. ~~Correr migraciones~~ RESUELTO: hay acceso directo a Postgres
   (`SUPABASE_DB_URL` + `scripts/db-run.mjs`) — Claude aplica las migraciones solo.
3. ~~Disclaimer IA~~ RESUELTO: "Henry virtual · IA entrenada con la personalidad
   de Henry" en footer de home y detalle.
4. Más adelante: dominio, cuenta Stripe definitiva, charla del acuerdo con Henry.

## Estado de ejecución

- **Fase 0**: ✅ completa (commits `76e8da1`..`b33a2c6`, 2026-07-14).
- **Fase 1**: ✅ completa. Migración 0010.
- **Fase 2**: ✅ completa. Migración 0011. Pendiente 2.7 (emails, bloqueado por dominio).
- **Fase 3**: ✅ completa. Migraciones 0012/0013/0014. Reseñas mock eliminadas.

**Roadmap del plan COMPLETO (fases 0-3).** Quedan solo los ítems 'esperando insumos'
(dominio, cuenta Stripe definitiva, acuerdo con Henry, términos/privacidad, emails).
- Todo en `main` local, sin deployar (el dueño pide subir solo a pedido explícito).
