# Memoria e insights (V1) — Diseño

Acordado 2026-07-16 (Mariano). Un LLM analiza las jugadas y devuelve, en el
admin, un resumen con accionables claros. Producto ya en prod (caminaconhenry.com).

## Objetivo

Aprender de cómo la gente usa los recorridos para mejorarlos: dónde se traban,
dónde abandonan, qué preguntan (baños, wifi, confusión), qué convierte, qué piden
que no existe — y que cada insight venga con una acción y un link a dónde aplicarla.

## Decisiones (tomadas)

- **Capturamos los mensajes del usuario** (habilita "preguntas recurrentes"). El
  esquema ya lo soporta (`session_messages.role` incluye `'user'`).
- **Trigger doble**: botón "Analizar ahora" en el admin + automático cada 100
  jugadas terminadas (vía cron que chequea el contador).
- **Accionables v1**: sugerencia + link directo a dónde arreglarlo (no aplicar-de-
  un-clic; eso es v2).

## Arquitectura

### 1. Captura de mensajes del usuario
Hoy `recordTurn` (lib/db/sessions.ts) guarda SOLO la respuesta de Henry en
`session_messages`. Se agrega, en el mismo turno, una fila `role='user'` con el
texto del usuario (que `/api/play` ya tiene en `message`), su `step_position` y
`phase`. Cambio mínimo, sin migración (el enum ya tiene `'user'`).

### 2. Datos del análisis
La función junta, desde el último análisis:
- **Estructural** (ya existe): turnos por paso (fricción), distribución del último
  paso de las sesiones NO terminadas (abandono), embudo desde `events`
  (view→chat→checkout→finish) y conversión por recorrido.
- **Mensajes**: muestra de mensajes `role='user'` recientes, para detectar temas
  recurrentes (baños, cómo llegar, confusión).
Se le pasa a Gemini la lista de slugs REALES de experiencias, para que los insights
que refieran a un recorrido usen un slug válido (no inventado).

### 3. Salida y almacenamiento (tabla `insights`, con histórico)
Una llamada a Gemini devuelve `{ summary, items[] }`. Cada item:
`{ tipo, hallazgo (1 frase), evidencia (números/ejemplos), accionable, target, slug? }`
donde `target ∈ {guia_util, experiencia, general}` define el link. Se guarda una
fila en `insights` (nunca se pisa; queda el histórico).

### 4. Disparo
- `POST /api/admin/insights/run` (guard `isAdmin`): corre el análisis ('manual').
  Lo llama el botón "Analizar ahora".
- `GET /api/cron/insights` (guard `CRON_SECRET`): si hay ≥100 jugadas TERMINADO
  desde el último `insights` → corre el análisis ('auto'). Vercel cron cada hora.
- Ambos usan la MISMA función `runInsights(kind)`.

### 5. Dónde se ve — `/admin/insights`
Página nueva en el admin: el último reporte + histórico. Cada item con su
`accionable` y un **link** según `target` (Guía útil → `/admin/utilidades`;
experiencia → `/admin/e/<id por slug>`; general → sin link). Botón "Analizar ahora".
Se suma al nav del admin.

### 6. Privacidad y retención
- Línea honesta en `/terminos`: guardamos la conversación para mejorar los
  recorridos.
- **Retención**: el cron borra mensajes `role='user'` con más de 90 días.

## Modelo de datos

`supabase/migrations/0020_insights.sql`:
- `insights`: id uuid pk, created_at, kind text ('auto'|'manual'), plays_analyzed
  int, window_from timestamptz, window_to timestamptz, summary text, items jsonb
  default '[]'. RLS on; lee admin, escribe service_role.
- Índice `insights (created_at desc)`.
- (El watermark del "desde el último análisis" se deriva de `max(window_to)`.)

## Tipos de insight del v1
Fricción por paso · abandono (dónde se caen) · preguntas recurrentes (de los
mensajes) · embudo y conversión por recorrido · señales de producto.

## Archivos (qué toca)
- Migración `0020_insights.sql` (tabla + RLS).
- `lib/db/sessions.ts` — insertar la fila `role='user'`; `app/api/play/route.ts` —
  pasar `message` a `recordTurn`.
- `lib/insights.ts` (nuevo) — gather + prompt + runInsights + parse.
- `app/api/admin/insights/run/route.ts` (nuevo, admin) + `app/api/cron/insights/route.ts`
  (nuevo, cron) + `vercel.json` (cron + retención).
- `app/admin/(app)/insights/page.tsx` + `actions.ts` (nuevo) + nav en el layout.
- `app/terminos/page.tsx` — línea de privacidad.

## Criterios de éxito
- Se guardan los mensajes del usuario.
- El botón "Analizar ahora" produce un reporte con ≥3 insights accionables y links
  válidos, en < ~30 s.
- El cron corre el análisis solo al cruzar 100 jugadas y borra mensajes > 90 días.
- Un insight tipo "piden baño cerca de X" linkea a la Guía útil.

## Fuera de alcance (v2+)
- Aplicar-de-un-clic los accionables (botón que edita la Guía útil/paso directo).
- Alertas por email/WhatsApp del reporte.
- Gráficos/dashboards (v1 es texto + links).
- Clustering avanzado / embeddings de mensajes (v1 usa el LLM sobre una muestra).
