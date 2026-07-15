# Features de crecimiento — Diseño

Acordado 2026-07-15 (Mariano). Tres features para capitalizar el canal de
adquisición (la comunidad de YouTube de Henry), más dos cambios de retención que
salieron de la charla: ventana de pausa a 7 días y vencimiento de la compra no
empezada a 90 días. Producto ya en producción bajo `caminaconhenry.com`.

## Objetivo

Convertir el pico del lanzamiento en comunidad y en ventas recurrentes:
- que terminar un recorrido genere un link compartible (adquisición),
- que el que no compra deje su email y pueda volver (recuperación),
- que el ranking se pueda pegar en un video/posteo (loop comunitario),
- y que nadie pierda lo que pagó por un malentendido de "cuándo vence qué".

## Principios transversales

1. **Dos relojes, nunca confundidos.** En todo el copy se distinguen:
   - **El acceso** (lo que compraste y empezaste): **no vence nunca** (solo un
     reembolso lo revoca).
   - **El progreso** (dónde quedaste en un recorrido): se guarda **7 días** en el
     dispositivo; con el correo se retoma desde cualquier lado.
   - **La compra no empezada** (compraste para otro día y nunca arrancaste):
     **90 días** para empezarla; una vez que arrancás, es tuya para siempre.
   Mostrar "7 días" o "90 días" suelto, sin decir a qué reloj pertenece, está
   prohibido: asusta al comprador.
2. **Voz peruana** en todo el copy nuevo (tú/tienes, "querubín", "choche" con
   moderación; nunca voseo). La info dura (ventanas, "es gratis") la muestra la
   **UI determinística**, no el LLM, para que no se alucine un dato.
3. **Reusar la plomería que ya existe:** `leads` + `/api/lead` + `LeadCapture`
   (captura de email), `track.ts` (captura de `?ref` al aterrizar → checkout),
   `sendAccessEmail`/`Resend` (correos), `play_sessions` (progreso server-side).

---

## Feature 1 — Compartir al terminar el recorrido

**Qué:** en la pantalla de fin de tour (`PlayerChat`, estado `TERMINADO`), arriba
de la reseña y el upsell, un botón **"Compartir mi recorrido"**.

**Comportamiento:**
- Usa **Web Share API** (nativo del celular, que es el contexto de uso). Texto
  pre-armado en voz de Henry: *"Caminé {pasos} pasos por {barrio} con Henry 🗽"* +
  link `https://caminaconhenry.com/e/{slug}?ref=compartir`.
- En desktop (sin `navigator.share`), cae a **copiar el link** con confirmación
  ("¡Link copiado!").
- **Imagen generada (preview del link):** una ruta de Open Graph dinámica que
  renderiza una imagen con `{pasos} pasos · {barrio}`, la marca "La Nueva York de
  Henry" y la cara de Henry. Es la imagen que se **despliega** al pegar el link en
  WhatsApp/IG. Se implementa con `ImageResponse` de Next (`opengraph-image` en la
  ruta del detalle, parametrizable por experiencia).
- **Atribución:** el `?ref=compartir` ya lo captura `track.ts` al aterrizar y
  viaja al checkout; se mide sin trabajo extra. No hay sistema de recompensas por
  referido en v1 (ver Fuera de alcance).

**Datos que usa:** pasos totales del recorrido (`metersToSteps(distance_m)`),
barrio (`neighborhood`), slug. Todo ya disponible en el cliente del player.

**Fuera de alcance v1:** compartir la imagen como **archivo suelto**
(`navigator.share({files})`) para que se vea aunque el link no se despliegue. Se
evalúa en v2.

---

## Feature 2 — Captura de email + recuperación del recorrido

**Dos momentos de captura**, ambos **opcionales** y **deduplicados**: si ya
tenemos el email (por Stripe, por un momento anterior, o porque ya tiene el
recorrido), no se vuelve a pedir.

**Momento 1 — al arrancar la experiencia (gratis o paga-con-preview):**
- Al iniciar el chat, una tarjeta inline **salteable** (NO bloquea el arranque —
  proteger el arranque del recorrido, que es lo que alimenta los compartidos):
  *"¿Te guardo el link por si se te corta la señal? Te lo mando al correo y lo
  retomas cuando quieras."* Con "Guardar" y "Ahora no".
- No aparece en la paga **sin** preview (esa va derecho a Stripe, que ya pide el
  email) ni a quien ya tiene el recorrido.
- Si lo deja: se guarda en `leads` (source `player_start`) + local + se le manda el
  correo con el link. Y queda para **pre-completar Stripe** (`customer_email`) si
  más tarde compra — no re-tipear el email.

**Momento 2 — en el paywall, para el que NO dejó email antes:**
- Justo cuando el tramo gratis se corta, **secundario al botón de compra** (que
  sigue siendo el CTA dominante — NO canibalizar la venta): un ask suave, debajo,
  como salida del que no compra hoy. *"¿Quieres que te avisemos de nuevos
  recorridos y descuentos?"* + input.
- Si lo deja: `leads` (source `paywall`). Es el lead de **más alta intención**
  (jugó todo el tramo gratis y llegó a la pared).
- **La promesa de "descuentos" hay que cumplirla:** habilita recontactar con un
  cupón para volver (reusa los promotion codes de Stripe que ya existen). El envío
  automático del "vuelve con este descuento" es fast-follow (ver decisión
  pendiente). Si no se construye, el copy se suaviza a "novedades y nuevos
  recorridos" para no prometer de más.

**Recuperación (alimentada por ambos momentos):**
- **Aviso de autoguardado** discreto y permanente en el chat ("Se guarda solo").
- **Tarjeta de pausa (UI determinística, no Henry):** al pausar/volver dice las
  formas de volver y los relojes: *"Tu acceso no vence. Dónde quedaste se guarda 7
  días en este teléfono — o entra con tu correo y lo retomas desde cualquier lado,
  en Mis recorridos."*
- **Fix técnico:** retomar server-side también desde la parada 1 (hoy solo si
  avanzaste más), para que "Mis recorridos" sirva aunque hayas dejado temprano.

**Ventana de progreso:** **7 días corridos** (antes 48 h), en `localStorage` y en
el server (`play_sessions`, `resume_window_hours`). La media firmada se regenera
fresca al reabrir (el player ya descarta las burbujas vencidas).

---

## Feature 3 — Leaderboard compartible (botón en la home)

**Qué:** un botón **"Compartir"** en la sección del ranking de la home
(`Leaderboard`).

**Comportamiento:**
- Web Share nativo (fallback a copiar link en desktop). Texto: *"Mira qué países
  caminan más Nueva York con Henry 🌎"* + link
  `https://caminaconhenry.com/?ref=ranking#ranking`.
- Sin página dedicada (decisión del dueño). El `#ranking` ancla a la sección; el
  preview es el OG de la home.

**Fuera de alcance v1:** página `/ranking` propia con OG dinámico del país líder.

---

## Vencimientos y empty states

### Reloj de progreso — pausa a 7 días
- `localStorage` y `play_sessions` expiran el punto de progreso a los 7 días.
- **Empty state (progreso vencido):** el acceso NO se toca. Mensaje cálido:
  *"Pasó más de una semana y perdí el rastro de dónde quedamos 😅 pero tu recorrido
  sigue siendo tuyo — arrancamos de nuevo, ¿va?"* Reinicia desde la parada 1 (si es
  pago y ya lo tenía, sigue desbloqueado; si era el tramo gratis, arranca gratis).

### Reloj de compra no empezada — 90 días
- **Regla:** un entitlement **nunca empezado** vence a los **90 días** de la
  compra. "Empezado" = existe al menos un turno registrado en `play_sessions` para
  ese dueño+experiencia. Un entitlement **empezado no vence nunca** (salvo
  reembolso).
- **Aviso previo:** ~7 días antes del vencimiento (día ~83), correo recordatorio:
  *"Tu recorrido {título} te espera — te quedan unos días para empezarlo."* Evita
  el "pagué y se venció sin avisar".
- **Empty state (compra vencida):** al intentar entrar a una experiencia cuyo
  único entitlement venció sin empezarse: *"Este recorrido lo compraste hace más de
  90 días y no llegaste a empezarlo, así que venció."* + CTA claro (volver a
  comprar). El texto de compra (GiftButton "para otro día") deja esto explícito
  ANTES de pagar: *"Tienes 90 días para empezarlo; una vez que arrancas, es tuyo
  para siempre."*
- **Mecanismo:** evaluación perezosa en el chequeo de acceso (comparar
  `purchased_at` + estado empezado/no empezado al leer), y un job programado solo
  para el correo recordatorio. El detalle (cron vs edge) se define en el plan.

---

## Cambios de copy existentes (consistencia de los dos relojes)

- **`lib/email.ts`** (correo de acceso/regalo): hacer explícito *"es tuyo para
  siempre, no vence"* (hoy dice "entra cuando quieras").
- **Línea de confianza del paywall** (`PlayerChat`): hoy *"Acceso para siempre con
  tu correo"* — sigue siendo cierta (quien está en el paywall está jugando). Sin
  cambios, salvo revisar que no choque con el mensaje de 90 días.
- **`GiftSentBanner` / GiftButton** ("comprar para otro día"): sumar la nota de los
  90 días para empezarlo + "una vez que arrancas es para siempre".
- **`/terminos`**: reemplazar "sin límite de tiempo" por la explicación de los dos
  relojes (acceso empezado = para siempre; compra sin empezar = 90 días; progreso
  = 7 días).

---

## Cambios de datos (resumen; el detalle va en el plan)

- `leads`: nuevos valores de `source` (`player_start`, `paywall`). Sin cambio de
  esquema.
- Checkout: pasar `customer_email` a Stripe cuando ya tenemos el email (prefill).
- `play_sessions`: usar y enforcar `resume_window_hours` = 7 días (server-side).
- `entitlements`: soporte de vencimiento de no-empezados a 90 días (campo de
  compra ya existe vía `purchases.paid_at`; "empezado" se deriva de
  `play_sessions`). Posible migración para el estado/expiración y el índice del
  job recordatorio.

## Criterios de éxito

- Terminar un recorrido ofrece compartir; el link pegado en WhatsApp muestra la
  imagen con los pasos.
- El que arranca el tour gratis puede dejar su email en un paso y le llega el link.
- Volver desde: mismo teléfono (7 días), correo, o "Mis recorridos" — los tres
  funcionan y están comunicados.
- El ranking de la home se puede compartir.
- Nadie ve "7 días"/"90 días" sin saber a qué reloj corresponde; ninguna compra
  empezada vence; toda compra no empezada avisa antes de vencer.

## Decisión pendiente

- **Envío automático del cupón de recontacto al abandonador del paywall.** El copy
  del Momento 2 promete "descuentos". Opciones: (a) construir ya un correo simple
  "vuelve con este descuento" reusando los promotion codes de Stripe, o (b)
  diferirlo y suavizar el copy a "novedades y nuevos recorridos". Recomendación:
  (a), porque cierra el loop abandono→conversión, pero es una pieza extra.

## Fuera de alcance (v2+)

- Imagen de compartir como archivo suelto (`navigator.share({files})`).
- Página `/ranking` dedicada con OG dinámico del país líder.
- Sistema de recompensas por referido (hoy solo se mide el `?ref`).
- Reactivación/gracia de una compra vencida (v1: volver a comprar).
