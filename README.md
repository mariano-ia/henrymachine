# La Nueva York de Henry (by Resilentos)

Micro recorridos a pie por NYC guiados por chat. Henry (YouTuber peruano radicado
en New York, canal con tienda "Resilentos") te lleva parada por parada como un
amigo que te escribe por WhatsApp. Compra impulsiva: US$5–10 por experiencia, o
gratis. Cada experiencia arranca gratis y se corta en un paywall configurable.

**Estado: prototipo funcional completo** (catálogo → detalle → compra → chat
guiado con persona real). Última actualización: 2026-07-13.

## Stack

| Capa | Tecnología |
|---|---|
| Web | Next.js 15 (App Router) + React 19 + TS + Tailwind 3.4 |
| DB / Auth / Storage | Supabase — proyecto `henry-machine` (`cdklaxvxngmldpdiihgo`, sa-east-1) |
| LLM | Gemini `gemini-2.5-flash` (API directa, no Vertex) |
| Pagos | Stripe — ⚠️ **keys LIVE** (compartidas con StoryHunt): comprar es un cargo real |
| Deploy | Vercel `henry-demo` → https://henry-demo-zeta.vercel.app (deploy manual) |

Secrets en `.env.local` (nunca se commitea). No hay git remote: `main` es local.

## Mapa

```
app/
  page.tsx                  Catálogo (hero nocturno + HeroChat en loop + filtros + cards)
  e/[slug]/page.tsx         Detalle (cover img/video, tip manuscrito, itinerario, compra)
  e/[slug]/chat/page.tsx    El chat del recorrido (PlayerLoader → PlayerChat)
  admin/                    Constructor (login Supabase; ver Accesos)
  api/play                  Motor del tour: prompt + Gemini + intents
  api/experience            Datos client-safe del recorrido (gate del paywall acá)
  api/checkout | stripe/webhook   Compra → entitlement por anon_id
  api/admin/generate | ingest     Generador de borradores / ingesta YouTube (demo)
lib/
  engine/play-prompt.ts     EL prompt del motor (persona, pacing, resguardos)
  db/experiences.ts         getPlayableExperience (paywall server-side, media firmada)
  db/persona.ts             Dossier global de Henry (voice_profiles.is_global)
  themes.ts + ThemeBadge    Sistema de temas estilo líneas de subte
scripts/
  ingest-persona.mjs        YouTube → transcripción → Gemini destila {bio, voice} → DB
  seed-catalog.mjs          4 experiencias de ejemplo
supabase/migrations/        0001–0007 (todas aplicadas a la DB remota)
```

## Cómo funciona el motor

- **Server stateless**: el cliente manda `{stopIndex, phase, turnsInStop, history}`;
  el server arma el prompt, Gemini devuelve `{reply, intent}` y el cliente aplica
  la transición (`arrived | next | pause | resume | finish | chat | none`).
- **Persona**: `voice_profiles` (fila global) guarda `{bio, voice, sources}`
  destilados de los videos reales. Se inyecta en cada turno: lo personal se
  responde desde la bio (Megan, familia, ciudadanía...), el tono sale del perfil
  de voz ("querubines", "golazo", "choche").
- **Conversación abierta con resguardos**: charla libre en personaje; datos duros
  del recorrido (precios/horarios/direcciones, incluido "es gratis") SOLO del
  itinerario; datos personales que no están en la bio no se inventan ni se
  niegan; parser de rescate si el modelo devuelve JSON roto.
- **Pacing escalonado** (turnos en la parada): ≤2 relajado → 3–5 empujoncito
  ocasional → 6–8 gancho con la próxima parada en cada mensaje → 9+ cada
  respuesta cierra proponiendo avanzar. Nunca corta la charla.
- **Paywall**: pasos con `position > paywall` jamás salen del server sin
  entitlement. El precio de Stripe se crea ANTES de fijar el precio en DB
  (nunca divergen el precio mostrado y el cobrado).
- **Pausa y reanudar**: el progreso (posición + conversación) se guarda en
  localStorage por experiencia (ventana de 48 h); cerrar la pestaña y volver
  retoma con un saludo de Henry en personaje. El prompt le indica ofrecer la
  pausa si nota apuro/cansancio. Solo mismo navegador (cross-device requiere
  play_sessions/identidad — ver pendientes).
- **Presupuesto de conversación**: soft 240 turnos (Henry va cerrando) / hard
  300 (~US$0,75, despedida sin llamar al LLM). Failover a `GEMINI_API_KEY_FALLBACK`
  si la key primaria agota crédito.
- **Rate limit** (Fase 0): 20 msg/min y 400/día por anonId+IP en /api/play,
  10/h en /api/checkout (función `rl_hit` en Postgres, migración 0009). Tope de
  1200 chars/mensaje y 1000/turno de history.
- **Medición** (Fase 0): tabla `events` + `/api/track` (sendBeacon) con 5
  eventos de embudo (view_home, view_detail, open_chat, begin_checkout,
  finish_tour) + país por IP; UTM del aterrizaje viaja a `sales.utm_*`;
  Vercel Analytics. OG por experiencia (cover como preview) + sitemap + robots.
- **Monetización** (Fase 2): upsell por experiencia (al terminar, Henry ofrece
  la siguiente con cupón opcional — config en el admin, card en el chat);
  cupones sobre Stripe promotion codes (`/admin/cupones`, Stripe = fuente de
  verdad, cliente pineado a API 2024-06-20 porque dahlia rompe `coupon`);
  regalar un recorrido (entitlement al email del regalado, source 'grant');
  captura de leads (`/api/lead` + tabla `leads`). Migración 0011.
  ⚠️ El checkout usa `allow_promotion_codes` (NO `consent_collection.promotions`,
  que exige aceptar ToS en el dashboard y rompía todos los pagos).
- **Identidad** (Fase 1): login sin contraseña por OTP de email (`/cuenta`,
  Supabase Auth), página `/mis-recorridos` (terminados/en curso), merge
  anon↔user vía `/api/claim` (por anon_id del dispositivo + grant_email
  cross-device). El progreso vive en `play_sessions` (fuente de verdad
  server-side: posición, fase, total_turns, país, tokens por turno en
  `session_messages`); el chat reanuda cross-device desde ahí. Enums de la
  DB en español: `session_status` = NO_INICIADO|EN_CURSO|TERMINADO|EXPIRADO.

## Reglas de negocio en la DB (migraciones clave)

- `0005`: **edición en vivo** — las publicadas se editan siempre; un constraint
  trigger DIFERIDO re-valida los invariantes al commit de cualquier cambio de
  pasos (no quedar sin pasos, paga con paywall, paradas con lugar).
- `0006`: paywall acotado a `[1, n-1]` (no se puede regalar el contenido),
  `stripe_price_id` obligatorio con precio pago, validación de origen Y destino
  al mover pasos entre experiencias.
- `0007`: `experiences.henry_tip` (frase manuscrita del detalle).

## Admin (constructor) — `/admin`

- Meta editable completa: título, pitch, ciudad, barrio, tema, duración (min),
  caminata (km), tip de Henry, portada del hero (imagen o video → bucket público
  `experience-covers`). Paradas se calcula solo desde los pasos.
- ABM de pasos: "+ Parada/Mensaje debajo", borrar con ×, renumeración automática.
- Monetización en unidades de PARADAS ("Paradas gratis") + botón "poner paywall
  después de esta" en cada parada. **Un solo botón Guardar aplica todo**; solo
  toca Stripe si el precio/paywall cambió.
- Media por paso (video/imagen/audio, bucket privado `experience-media`, signed
  URLs). La media del paso de apertura suena al arrancar el chat (audio de
  bienvenida). Los pasos *Mensaje* del medio hoy NO se narran (solo apertura y
  cierre).

## Operaciones

```bash
npm run dev                                   # localhost:3000
node --env-file=.env.local scripts/ingest-persona.mjs <links...>   # re-generar dossier
                                              # (pasar la lista COMPLETA: pisa el anterior)
npx vercel@latest deploy --prod --yes         # deploy (pedir confirmación explícita)
```

Costos LLM medidos: ingesta del dossier ~US$0,02; experiencia jugada
~US$0,08–0,35 según lo charleta del usuario (techo de diseño: US$0,30).

## Accesos

- Admin: `marianonoceti@gmail.com` (rol admin+henry en `authors`).
- Existe `henry@henry-machine.app` (dueña del contenido seed) sin contraseña seteada.

## ⚠️ Cuidados

- **Stripe LIVE**: comprar una experiencia paga cobra de verdad. Probar flujo con
  `domingo-williamsburg` (gratis). "Guardar" con precio nuevo crea un
  product+price real (no es un cargo).
- Nunca tocar los proyectos Supabase de Argo (`luutdozbhinfiogugjbv`) ni
  escuadra (`ehvsfintmkoclqehqwdv`).
- Gotcha Tailwind+Next: cambiar colores en `tailwind.config.ts` requiere
  `rm -rf .next` + reiniciar el dev server (no hot-reloadea).
- El dossier de Henry es la fuente de verdad sobre una persona real: Henry
  debería revisarlo (los `sources` quedan guardados en `voice_profiles.profile`).

## Pendientes conocidos

- Campo de imagen CUADRADA propia para la card de la home (`card_image_path`,
  migración 0008 + campo en admin). Hoy la card reusa el cover del detalle;
  las fotos actuales son placeholders de Wikimedia Commons hasta tener las de Henry.
- Editor del dossier en el admin (hoy se regenera por script).
- Flag "paso oculto" para redactar paradas en publicadas sin que se vean al instante.
- Pasos *Mensaje* intermedios no se narran en el player.
- Reusar el product de Stripe por experiencia (hoy cada cambio de precio crea uno nuevo).
- Guardado de pasos no atómico (si falla a mitad, queda parcial).
- ~~Nombre del producto~~: definido 2026-07-14 → "La Nueva York de Henry, by Resilentos".
- Vertex RAG (fase 2, si hace falta profundidad fáctica sobre todo el canal):
  columnas `rag_provider`/`rag_corpus_ref` ya previstas.
- Reanudar cross-device / analytics de abandono: cablear `play_sessions`
  (tabla ya existe) + `resume_window_hours` como expiración server-side.
- ~~Horarios reales (Google Places)~~: HECHO 2026-07-14 — `lib/places.ts`
  resuelve place_id + horarios de la PARADA ACTUAL con caché de 12 h en
  `steps.meta.places` y lo inyecta al prompt ("ahora está CERRADO · hoy:
  Tuesday: Closed"); detecta CLOSED_PERMANENTLY y avisa. Env:
  `GOOGLE_MAPS_API_KEY` (Places API New, proyecto GCP "henry"). Sin key,
  el motor sigue igual. Pendiente menor: mismo dato en la página de detalle.
- "Utility intents": base de conocimiento GLOBAL editable en el admin
  (baños públicos, wifi, tarjetas de metro, emergencias, agua) que se inyecta
  en el prompt de TODAS las experiencias; opcionalmente también como página
  pública. Necesita tabla nueva o content_source global (migración).
