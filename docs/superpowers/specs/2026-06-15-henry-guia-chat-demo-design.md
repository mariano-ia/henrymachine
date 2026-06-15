# Demo guía-chat de Henry — Diseño

- **Fecha:** 2026-06-15
- **Estado:** Aprobado (diseño). Pendiente: plan de implementación.
- **Autor:** Yacaré (Mariano) + Claude
- **Working dir:** `/Users/marianonoceti/Desktop/Antigravity/Henry`

---

## 1. Contexto y objetivo

Henry es un YouTuber latino que vive en New York y produce mucho contenido (videos + guías PDF que ya no se venden). La inspiración es **StoryHunt** (interno del estudio): una guía cerrada de NYC renderizada como chat, donde la IA es un "conector" hueco de 4–15 palabras que solo hace de puente entre pasos fijos y **nunca responde con sustancia**. Su "voz" es un único párrafo escrito a mano; **no ingiere contenido, no usa RAG ni Vertex**.

**El diferencial de Henry es lo opuesto:** la gente quiere que Henry **les conteste de verdad**, en su voz, con su data real. Eso se logra conectando un modelo a **su propio contenido**.

**Objetivo de este proyecto:** un **demo para enamorar a Henry** (prioridad: efecto "wow", no robustez). Que vea el potencial de convertir su contenido en una experiencia conversacional con su esencia.

**Qué prueba el demo, en concreto:** que con **un solo video** suyo podemos capturar (a) **su información** y (b) **su voz/tono**, y dejar que cualquiera **chatee libremente** con eso. Escenario canónico: Henry pega su video *"los mejores restaurantes de Brooklyn"* → **sin ninguna otra fuente**, el chat responde sobre esos restaurantes, en su voz. Es una **prueba de captura de info + voz**, no una experiencia guiada (eso es fase 2). El video no tiene que ser un recorrido: cualquier video con contenido rico (listas, recomendaciones) sirve.

## 2. Decisiones tomadas (locked)

1. **Objetivo:** demo para Henry (wow > robustez).
2. **Enfoque de build:** app nueva y enfocada en Next.js (camino "B"); robamos los **patrones** de StoryHunt (chat iMessage, disciplina de prompt) pero **no** forkeamos su repo ni arrastramos su maquinaria (pagos, OTAs, crons, anti-spoiler, conector hueco).
3. **Flujo del demo:** 2 pantallas → **(1)** pegás hasta **3 links** de videos de Henry → **(2)** **chat libre** (sin botones ni prompts predefinidos) con un Henry groundeado en esos videos.
4. **Arquitectura = "camino rápido":** transcripciones + **Gemini en Vertex** con las transcripciones **en contexto** (long-context) + context caching. **Sin** índice batch de Vertex AI Search, **sin** base vectorial, **sin** DB pesada.
5. **Conocimiento:** RAG ligero por contexto sobre el contenido de los videos pegados. **Voz = perfil auto-destilado por Gemini desde las transcripciones** + las propias palabras de Henry en contexto (no se escribe la persona a mano).
6. **Modalidad:** texto **+ clips de audio reales** vía embed de YouTube en el timestamp exacto (sin edición de media).
7. **Idioma:** español, registro latino de Henry.
8. **Fuera del demo (fase 2):** caminata guiada con pasos/escenas, motor automático video→experiencia persistente, ABM de experiencias, web pública, pagos, login, multi-creador.
9. **Grounding estricto = la prueba:** las respuestas salen **solo** de los videos pegados, no del conocimiento general del modelo. Si preguntan algo fuera de ese contenido, Henry lo dice en personaje. Eso es justamente lo que demuestra que capturamos *su* info.

## 3. Experiencia de usuario

Mobile-first, pantalla completa.

### Pantalla 1 — "Cargá a Henry"
- Input para pegar **hasta 3 URLs** de YouTube de Henry + botón **Generar**.
- Validación de URLs (formato YouTube, máximo 3).
- Al generar: loader corto y con carácter ("procesando los videos de Henry…") mientras se bajan las transcripciones.
- Estados de error claros (link inválido, sin subtítulos, etc.) con mensaje en tono.

### Pantalla 2 — Chat con Henry
- UI estilo iMessage: burbujas del narrador (con foto de Henry) y del usuario; indicador "escribiendo…".
- **Chat libre, sin botones ni prompts predefinidos:** solo un input de texto (placeholder tipo "Preguntale a Henry…"). El usuario conversa con Henry como en cualquier chat.
- Henry responde **con sustancia**, en su voz, **groundeado estrictamente en los videos pegados** (ver §7).
- Cuando la respuesta corresponde a un momento del video, aparece **🎧 "escuchá cómo lo cuenta"** → reproduce el fragmento real (embed de YouTube arrancando en ese segundo).

## 4. Arquitectura (camino rápido)

```
[Pantalla 1: pegar links]
        │  POST /api/ingest { links[] }
        ▼
[Server] transcript-fetcher  ──(paralelo, ≤3)──>  transcripción + timestamps por video
        │   (fallback si no hay subtítulos: Gemini sobre la URL / STT)
        ▼
[Vertex] destilar "perfil de voz" de Henry desde las transcripciones (1 call)
        ▼
[Vertex] crear context cache con [scaffold persona + perfil de voz + transcripciones] → cacheId
        │  → devuelve { cacheId, videos:[{videoId,url,title}] }   (server NO guarda estado)
        ▼
[Pantalla 2: chat]  (el cliente tiene cacheId + metadata liviana de videos)
        │  POST /api/chat { cacheId, videos, message, history }
        ▼
[Server] llama Vertex (Gemini) referenciando el cacheId + [historial] + [mensaje]
        ▼
{ reply, clip?: { videoId, startSec, label } }  → render en el chat
```

Notas:
- **Vercel** para el front + API routes (serverless). **El server es stateless:** no hay sesión en memoria de proceso (en serverless la memoria no se comparte entre invocaciones). El "estado" de la sesión es el **context cache de Vertex** (vive en Vertex) + una metadata mínima de videos que sostiene el cliente.
- **Vertex AI (Gemini)** para la generación. El "estar conectado a Vertex" es real; lo único que evitamos es el indexado batch de Vertex AI Search (que tarda minutos).
- Para ≤3 videos, las transcripciones entran de sobra en la ventana de contexto de Gemini (≈20–40k tokens de 1M+). No hace falta retrieval vectorial.
- **Fallback de caching:** si el corpus queda por debajo del mínimo de tokens para crear un context cache, se manda inline (transcripciones en cada request, sostenidas por el cliente). Mismo resultado, sin el ahorro de caching.

## 5. Componentes / unidades

Cada unidad con un propósito claro e interfaz definida:

| Unidad | Tipo | Qué hace | Depende de |
|---|---|---|---|
| `IngestScreen` | UI | Pegar ≤3 links, validar, disparar Generar, mostrar loader/errores | `/api/ingest` |
| `ChatScreen` | UI | Render chat iMessage, input libre, envío de mensajes, mostrar clips | `/api/chat`, `ClipPlayer` |
| `ClipPlayer` | UI | Embed de YouTube que arranca en `startSec` | — |
| `transcript-fetcher` | lib server | URL YouTube → `{ videoId, segments:[{text, startSec}] }`; fallback sin captions | librería de transcript / Gemini |
| `vertex-client` | lib server | Llamadas a Gemini en Vertex; crear/usar context cache; reintentos/timeout | SDK Vertex AI |
| `henry-persona` | config + gen | Scaffold fijo del system prompt (rol, reglas de grounding, quedarse en personaje) **+** perfil de voz auto-destilado desde las transcripciones en el ingest | `vertex-client` |
| `/api/ingest` | route | Recibe links → fetcher en paralelo → destila perfil de voz → crea context cache → devuelve `{cacheId, videos}` | `transcript-fetcher`, `vertex-client`, `henry-persona` |
| `/api/chat` | route | Recibe `{cacheId, videos, message, history}` → llama vertex-client → `{reply, clip?}` | `vertex-client`, `henry-persona` |

## 6. Modelo de datos (mínimo, en memoria)

No hay base de datos para el demo. El estado de sesión vive en el **context cache de Vertex** + metadata mínima que sostiene el cliente:

```ts
type TranscriptSegment = { text: string; startSec: number };
type VideoTranscript = { videoId: string; url: string; title?: string; segments: TranscriptSegment[] };
type VoiceProfile = string; // perfil de voz auto-destilado por Gemini desde las transcripciones (va al system prompt / cache)

// Lo que el cliente recibe del ingest y reenvía en cada chat:
type VideoMeta = { videoId: string; url: string; title?: string };
type SessionHandle = { cacheId: string; videos: VideoMeta[] };

type ChatTurn = { role: 'user' | 'henry'; text: string };
type ChatResponse = {
  reply: string;
  clip?: { videoId: string; startSec: number; label: string };
};
```

(Opcional: cache simple por `videoId` en disco/KV para que un "pegado en vivo" de un video ya conocido — y su transcripción — responda al toque, evitando re-fetch.)

## 7. La voz de Henry (persona)

- **Perfil de voz auto-destilado por Gemini** a partir de las transcripciones (paso del ingest): quién es, cómo habla, tono, vocabulario, actitud, muletillas, ritmo. **No se escribe a mano** — sale de su propio contenido. (Opcional para el demo: un pulido humano rápido del perfil generado, como red.)
- Las **transcripciones** quedan además en contexto: aportan el contenido groundeado y refuerzan la voz de forma implícita (son sus palabras textuales = ejemplos de estilo).
- **Lo que el texto SÍ y NO captura:** las transcripciones capturan bien lo *verbal* (palabras, modismos, actitud) pero no la *entonación/energía* — eso lo cubren los **clips de audio reales**. Texto con su estilo + audio real = ilusión fuerte de "es él".
- **Reglas del system prompt:**
  - Responder **con sustancia** y en su registro (lo opuesto al conector de StoryHunt).
  - **Grounding estricto (es el núcleo de la prueba):** responder **solo** con lo que está en los videos pegados, **no** con conocimiento general del modelo. Si la pregunta cae fuera de ese contenido, decirlo en personaje ("eso no lo toqué en este video") en vez de inventar o tirar data genérica. Cero invención de lugares/precios/nombres.
  - Quedarse en personaje ante input raro/adversario.
  - Si conviene, citar el momento del video → habilita el clip (devolver `{videoId, startSec}`).
- Config: temperatura media-alta para naturalidad; tope de tokens razonable para respuestas conversacionales (más largas que los 4–15 de StoryHunt).

## 8. Clips de audio

- Las transcripciones traen **timestamps por segmento** y entran al contexto con sus `startSec`. **Decisión:** Gemini devuelve el `startSec` directamente (lo tiene en contexto) como parte de una salida estructurada `{ reply, clip? }`. **Fallback** si el timestamp viene poco confiable: matchear el texto citado por Gemini contra los segmentos de la transcripción para recuperar el `startSec`.
- El reproductor es un **embed de YouTube con `start=startSec`** → cero procesamiento de media, alineación perfecta.
- (Futuro: recortar audio puro si se quiere una experiencia sin marco de video.)

## 9. Stack e infra

- **Front/back:** Next.js (App Router) + TypeScript, deploy en **Vercel**.
- **IA:** **Vertex AI (Gemini)** vía service account.
- **Transcripciones:** librería de transcript de YouTube (con fallback a Gemini sobre la URL si faltan subtítulos).
- **Estilos:** Tailwind (consistente con StoryHunt).

### Dependencias de input para arrancar
- **GCP project con Vertex AI habilitado + service account (credenciales).**
- **Canal de Henry + 2–3 videos candidatos** con contenido rico para Q&A (listas/recomendaciones/recorridos — p.ej. *"mejores restaurantes de Brooklyn"*), con subtítulos, para afinar la persona y pre-cachear como red de seguridad.

## 10. Alcance / YAGNI

**Dentro del demo:**
- Pantalla de pegar ≤3 links.
- Ingest por transcripción (con fallback).
- **Chat libre** (sin botones predefinidos) groundeado **estrictamente** en los videos pegados, en la voz de Henry.
- Clips vía timestamp (embed YouTube).
- 1 persona, idioma español.
- 1–2 experiencias pre-cacheadas como red para la demo en vivo.

**Fuera (fase 2, si avanza):**
- Caminata guiada con pasos/escenas (modelo StoryHunt).
- Motor automático video→experiencia persistente.
- ABM de experiencias (alta/baja/modificación).
- Web pública, pagos, login, multi-creador.

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Video sin subtítulos | Elegir videos con captions; fallback a Gemini sobre la URL / STT; pre-cachear |
| Subtítulos automáticos sucios (sin puntuación, errores) degradan el perfil de voz | Pase de limpieza/normalización del texto antes de destilar; preferir videos con buenos captions; pulido humano del perfil como red |
| Fetch de transcript bloqueado desde Vercel (IP de cloud) | Pre-cachear transcripciones de los videos del demo; tener 1–2 experiencias pre-cargadas |
| Latencia de la 1ª respuesta | Loader con carácter + context caching de Gemini |
| Alucinación | Grounding estricto + instrucción "si no está en los videos, no inventes" |
| Falla en vivo frente a Henry | Llevar links ya probados + la red pre-cacheada |
| Costo de tokens (long-context) | Context caching; tope de 3 videos; respuestas acotadas |

## 12. Testing

- **Eval de voz:** set fijo de preguntas → verificar que las respuestas (a) están groundeadas en los videos y (b) suenan a Henry (revisión humana + checklist de muletillas/tono).
- **Smoke test:** pegar 3 links conocidos → chatear → confirmar que el clip abre en el segundo correcto.
- **Test de grounding:** preguntar algo que NO está en los videos → confirmar que Henry no inventa.

## 13. Roadmap (post-demo)

1. Caminata guiada con pasos/escenas (estructura StoryHunt) sobre el contenido ingerido.
2. Motor automático video→experiencia (persistente).
3. ABM de experiencias + web pública.
4. Multi-creador (potencial SaaS).
