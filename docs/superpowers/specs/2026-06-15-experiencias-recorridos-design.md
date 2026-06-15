# Experiencias / Recorridos vendibles de Henry — Diseño (modelo de datos + arquitectura)

- **Fecha:** 2026-06-15
- **Estado:** Diseño en progreso — **PAUSADO** a la espera de confirmar varias cosas con Henry (ver §11).
- **Alcance de este doc:** capturar TODO lo conversado para poder retomar sin perder contexto. No es todavía un spec de implementación cerrado.
- **Relacionados:** demo actual (este repo, `app/`, `lib/`), catálogo funcional [`2026-06-15-casos-de-uso-recorrido.md`](./../2026-06-15-casos-de-uso-recorrido.md), diseño del demo [`2026-06-15-henry-guia-chat-demo-design.md`](./2026-06-15-henry-guia-chat-demo-design.md).

---

## 1. Contexto y punto de partida

Ya existe y está EN VIVO un **demo** (`henry-demo-zeta.vercel.app`): chat estilo WhatsApp donde "Henry" (YouTuber peruano) responde **groundeado estrictamente** en transcripciones de sus videos (hoy: 2 de Tokio, en contexto, sin Vertex Search). Stack: Next.js + `@google/genai` (Gemini 2.5-flash). Tono peruano natural, "escribiendo…" con retardo humano, sin clips.

Este documento diseña la **evolución a producto**: vender **micro-recorridos físicos** (~1.5h) que el usuario vive caminando por la ciudad, guiado por Henry vía chat. Ej: *"las mejores pizzerías de Brooklyn según Henry"*.

## 2. Visión del producto

Tres superficies (productos) distintas:

1. **Web de consumo (vidriera + player):** catálogo donde el usuario elige un recorrido, lo compra y lo vive. El "player" es el chat que ya tenemos, ahora manejado por la máquina de estados del recorrido.
2. **ABM de experiencias (backoffice):** crear, editar, verificar y publicar recorridos. No-técnico (lo usa Mariano o Henry).
3. **Generador:** relato en lenguaje natural + fuente de contenido → experiencia estructurada (borrador). Es el "paso 1" de la creación.

**Orden de construcción recomendado:** la *cocina* primero (modelo de datos → generador → ABM) y la *vidriera* (web de consumo) después — sin experiencias creadas no hay nada que vender.

## 3. Filosofía de interacción (decidida)

- **Las paradas son PROPUESTAS, no peajes.** Henry nunca obliga a responder para avanzar.
- **Si el usuario se va por las ramas, Henry lo sigue** (va hacia donde va el usuario) y reencauza con onda — **nunca un muro**.
- **El costo NO es el límite** (<$1 por experiencia aunque charle 1.5h). No se acota por tokens.
- **El límite real es un FINAL humano de Henry**, en personaje ("me tengo que ir, un abrazo"), cuando se agotan las paradas o si se estiró demasiado.
- **Grounding estricto:** si algo no está en la fuente de contenido, no inventa; lo dice en personaje.
- **Henry ADMITE que es IA**, pero sin salirse del tono ("soy Henry en versión chat 🤙").
- **Seguridad y bienestar del usuario por encima de completar el recorrido.**
- **La plata nunca pasa por el personaje** (reembolsos/quejas → soporte).

(El detalle por situación está en el catálogo funcional, §13 / doc aparte: ~100 casos + 13 reglas transversales.)

## 4. Decisiones tomadas (locked)

| # | Decisión | Valor |
|---|---|---|
| 1 | Formato | Físico, in-situ (el usuario camina de verdad) |
| 2 | Enfoque de recorrido | Mezcla **A+B suave**: estructura de paradas (A) + propuesta/reto por parada (B), sin forzar |
| 3 | Avance entre paradas | Conversacional + botón **"llegué"**. GPS/mapa = **fase 2** |
| 4 | Henry admite que es IA | Sí, en tono |
| 5 | Reanudación | Sí, **ventana de 24h** desde que arranca (t0). Pausar/retomar libre dentro de la ventana |
| 6 | Repetición | **Uso único**: `TERMINADO` y `EXPIRADO` son finales, no se reinician |
| 7 | Reembolsos | Solo por **error** (no por "no me gustó"). Políticas a definir. Henry no maneja plata |
| 8 | Idioma | **Solo español** por ahora |
| 9 | Saltear / reordenar paradas | Permitido |
| 10 | Fuente de conocimiento | **Una fuente multimodal por experiencia** (link/PDF/etc.), ingerida a **Vertex** |
| 11 | Metadata operativa | El generador la **sugiere**, un humano la **verifica** |
| 12 | Creación | **Lenguaje natural → genera borrador → se edita por parada → se publica** |

## 5. Máquina de estados (el corazón del runtime)

El demo actual es **stateless**; el producto necesita **estado persistente por sesión** (para reanudar a 24h y para que Henry sepa dónde está). El **servidor es la autoridad del estado**; el modelo solo **sugiere intención** (avanzar/pausar) y recibe una **instrucción distinta según el estado** (suave, sin bloquear).

### Capa 1 — Ciclo de vida del acceso/sesión
```
NO_INICIADO ──(arranca → t0)──▶ EN_CURSO ──(completa / cierra)──▶ TERMINADO  (final, no reinicia)
                                   │
                                   └──(24h desde t0 sin terminar)──▶ EXPIRADO  (consumido)
```

### Capa 2 — Posición dentro del recorrido (mientras `EN_CURSO`)
```
            "llegué"             "bancame"/silencio
CAMINANDO ───────────▶ EN_PARADA ───────────────────▶ EN_PAUSA
    ▲                      │  ▲                            │
    │   "siguiente"        │  └────── "ya volví" ──────────┘
    └──────────────────────┘
```
- `CAMINANDO` ≠ llegada. `EN_PARADA` = contenido activo. `EN_PAUSA` = stand-by, **avance silenciado, cero insistencia**.

### Capa 3 — Estado por parada (tolerante a desorden)
`pendiente → actual → (completada | salteada | vista)`, **reordenable**, se puede volver a una hecha.

### Overlays — modos de interacción (tiñen el tono, no son estados de progreso)
`normal · express (apurado) · solo_ver (lleno) · refugio (clima) · safety (emergencia → pausa todo)`

### Señal de cierre (`windDown`)
Se enciende cuando *(todas las paradas resueltas)* **o** *(se estiró: tiempo/turnos sobre un umbral suave)*. Cambia la instrucción de Henry a **tono de despedida** — no corta de golpe. (Umbral exacto: a definir, §11.)

## 6. Modelo de creación (autoría)

```
1. Autor escribe el RELATO en lenguaje natural
   ("Arrancamos en Di Fara, la clásica; Henry ama la square slice; después
    caminamos a L&B Spumoni Gardens...")
        │  + FUENTE DE CONTENIDO multimodal (links de videos, PDF, etc.)
        ▼
2. GENERADOR (Gemini) arma un BORRADOR estructurado:
   - paradas en orden
   - mensajes fijos por parada (arriveScript / proposal / payoff / walkToNext) en voz de Henry
   - knowledgeScope por parada (qué parte del corpus la groundea)
   - metadata operativa SUGERIDA (dirección, horarios, cash-only…) → a verificar
   - perfil de voz destilado de la fuente
        ▼  (en paralelo: la fuente se INGIERE a Vertex — lento, pero es autoría, no runtime)
3. Autor EDITA parada por parada en el ABM y VERIFICA la metadata
        ▼
4. PUBLICA → status 'published' → aparece en la web de consumo
```

**Principio clave — dos capas que no son lo mismo:**
- **Estructura** (paradas, orden, mensajes fijos) → se genera del **relato**.
- **Voz + conocimiento del chat en vivo** → sale de la **fuente de contenido** (Vertex).
- El relato da el esqueleto y los rieles; la fuente da el cerebro y la voz.

**El generado nunca sale en vivo solo:** siempre borrador → revisión humana → publicar. Es donde se cazan los casos espinosos (lugar cerrado, dato inventado, dirección).

## 7. Grounding con Vertex (por experiencia)

- **Una fuente multimodal por experiencia** (uno o varios items: YouTube, PDF, URL, texto, archivo de video).
- **Ingesta en tiempo de AUTORÍA** → un corpus/data store de Vertex por experiencia. La latencia de indexado (minutos) es aceptable porque ocurre al crear, no al jugar.
- **Runtime:** en cada turno, el servidor toma el `knowledgeScope` de la parada actual y hace **retrieval acotado** sobre el corpus (rápido) → arma el prompt de Henry con persona + contexto recuperado + instrucción según estado.
- **Acotar el contexto a la parada** sirve doble: anti-alucinación **y** anti-divague (sin material nuevo, Henry invita a avanzar). Es gratis porque ya recortamos para grounding.
- **Diferencia con el demo:** el demo mete transcripciones enteras en contexto (sin Vertex). El producto usa **retrieval por parada desde Vertex**. El demo puede quedar como está; el producto migra a este modelo.

## 8. MODELO DE DATOS

> Convención: `?` = opcional. Tiempos en ISO string salvo `*Ms` (epoch ms). IDs string.

### 8.1 Autoría (se crea/edita en el ABM)

```ts
type ExperienceStatus = 'draft' | 'published' | 'archived';

interface Experience {
  id: string;
  slug: string;                 // URL pública
  title: string;                // "Las mejores pizzerías de Brooklyn según Henry"
  city: string;                 // "Brooklyn, NYC"
  pitch: string;                // descripción vendedora (vidriera)
  coverImage?: string;
  language: 'es';               // por ahora solo español
  status: ExperienceStatus;
  expectedMinutes: number;      // ~90
  resumeWindowHours: number;    // 24
  accessPolicy: 'single_use';   // uso único
  price?: number;               // USD (comercial, fase posterior)
  contentSourceId: string;      // fuente de conocimiento (Vertex)
  voiceProfile: string;         // perfil de voz de Henry (destilado, editable)
  stopIds: string[];            // orden sugerido (reordenable en runtime)
  createdBy: string;
  createdAt: string; updatedAt: string; publishedAt?: string;
}

type ContentSourceType = 'youtube' | 'pdf' | 'url' | 'text' | 'video_file';
type IngestStatus = 'pending' | 'ingesting' | 'ready' | 'error';

interface ContentSource {       // fuente multimodal por experiencia → Vertex
  id: string;
  experienceId: string;
  items: Array<{ type: ContentSourceType; uri: string; label?: string }>;
  vertexCorpusId?: string;      // id del data store / RAG corpus en Vertex
  ingestStatus: IngestStatus;
  ingestError?: string;
  ingestedAt?: string;
}

interface Stop {
  id: string;
  experienceId: string;
  index: number;                // orden sugerido
  name: string;                 // "Di Fara Pizza"

  // mensajes fijos (generados como borrador, editables) — en voz de Henry
  arriveScript: string;         // qué dice Henry al llegar a la parada
  proposal?: string;            // la "propuesta/reto" suave (opcional)
  payoff?: string;              // remate cuando se cumple / cierra la charla
  walkToNext?: string;          // instrucción de caminata a la próxima

  // grounding: scope de conocimiento de esta parada dentro del corpus
  knowledgeScope: {
    query?: string;             // consulta/filtro para retrieval acotado
    sourceRefs?: string[];      // refs a secciones/segmentos del corpus
    clipRange?: { sourceUri: string; startSec: number; endSec: number }; // si es video
  };

  meta: StopMeta;               // metadata operativa (sugerida → verificada)
  geo?: { lat: number; lng: number; radiusM: number }; // opcional, fase 2 (GPS)
  pacing?: { softCap?: number; hardCap?: number };      // opcional, suave (default ~2/3)
}

interface StopMeta {
  address?: string;
  mapsUrl?: string;             // deep-link a Maps
  hours?: string;
  paymentNotes?: string;        // ej "cash-only"
  accessibility?: string;
  restroom?: boolean;
  orientationHints?: string;    // "toldo verde en la esquina"
  verified: boolean;            // ✅ verificado por humano
  source: 'suggested' | 'manual';
}
```

### 8.2 Generación (el "paso 1")

```ts
interface GenerationRequest {
  story: string;                            // relato en lenguaje natural
  contentSource: ContentSource['items'];    // videos/PDFs/links linkeados
  language: 'es';
}
// → produce: Experience(draft) + Stop[](draft) + voiceProfile + meta sugerida.
// La ingesta a Vertex del contentSource se dispara en paralelo (async).
```

### 8.3 Runtime (una corrida del recorrido por un usuario)

```ts
type SessionStatus = 'NO_INICIADO' | 'EN_CURSO' | 'TERMINADO' | 'EXPIRADO';
type TourPhase = 'CAMINANDO' | 'EN_PARADA' | 'EN_PAUSA';
type StopRuntimeStatus = 'pendiente' | 'actual' | 'completada' | 'salteada' | 'vista';
type InteractionMode = 'normal' | 'express' | 'solo_ver' | 'refugio' | 'safety';

interface TourSession {
  id: string;
  experienceId: string;
  accessToken: string;          // uso único
  user?: { id?: string; email?: string }; // anónimo permitido
  status: SessionStatus;
  startedAt?: string;           // t0 — arranca la ventana de 24h
  expiresAt?: string;           // t0 + 24h
  current: {
    stopIndex: number;
    phase: TourPhase;
    mode: InteractionMode;
    turnsInStop: number;        // turnos en la parada actual (para el cap suave)
  };
  stopStates: Record<string, StopRuntimeStatus>; // por stopId
  windDown: boolean;            // señal "ir cerrando"
  counters: { totalTurns: number; startedAtMs?: number };
  lastActiveAt: string;
}

interface SessionMessage {      // log para reanudar dentro de la ventana de 24h
  id: string; sessionId: string;
  role: 'user' | 'henry';
  text: string; at: string;
}

interface SupportFlag {         // reembolso/queja → soporte humano (Henry no toca plata)
  id: string; sessionId: string;
  reason: string; createdAt: string; resolved: boolean;
}
```

### 8.4 Contrato de la API de chat (runtime)
```
POST /api/tour/chat
  in:  { sessionId, message }
  out: { reply, session (estado actualizado), suggestedIntent?: 'advance'|'pause'|'wrap' }
```
El servidor: lee `TourSession` → resuelve `knowledgeScope` de la parada actual → retrieval en Vertex → arma prompt (persona + contexto + instrucción según `phase`/`mode`/`windDown`) → llama Gemini → actualiza estado (turnos, fase, stopStates) → persiste → responde. El modelo **sugiere** intent; el servidor **decide** el estado.

## 9. Arquitectura / superficies

- **Web de consumo (Next.js):** catálogo de `Experience` publicadas → compra → crea `TourSession` → player (chat con la máquina de estados).
- **ABM (Next.js, protegido):** lista de experiencias, generador (NL → borrador), editor por parada, verificación de metadata, publicar/despublicar.
- **Generador (server + Gemini):** `GenerationRequest` → borrador `Experience`+`Stop[]`. Dispara ingesta a Vertex.
- **Vertex:** un corpus por experiencia; ingesta en autoría, retrieval en runtime.
- **Persistencia:** necesaria (rompe el stateless del demo). Candidata: Firestore (como StoryHunt) o Postgres/Supabase. A definir.
- **Reutilizable del demo:** patrón de persona, UI/player estilo WhatsApp, cliente Gemini, conductas (grounding estricto, retardo humano de tipeo, admite IA).

## 10. Deuda técnica del demo a resolver (la cazó el análisis funcional)
- `app/api/chat/route.ts` hoy expone `String(error.message)` crudo al cliente → reemplazar por mensaje en tono + reintento, sin filtrar internals.
- Falta **cap de caracteres** por mensaje (un turno enorme revienta la ventana de contexto; hoy solo se recorta el history a 12 turnos).
- Falta **rate-limit / debounce** para flood (por UX, no por costo).

## 11. Preguntas abiertas — CONFIRMAR CON HENRY (antes de spec de implementación)

**Producto / experiencia**
- ¿Umbral del "final humano" por extensión: por tiempo, por turnos, o ambos? ¿Qué valores?
- ¿Cuántos "extras" groundeados de colchón por si agota las paradas antes de 1.5h?
- ¿`EXPIRADO` (no terminó en 24h) se puede recomprar o da otra chance? (default actual: consumido.)

**Contenido / autoría**
- ¿Quién autorea: Mariano, Henry, o ambos? ¿Henry da el material por experiencia?
- ¿Qué fuente concreta usa el primer recorrido real (qué videos/PDF de Henry)?
- ¿Henry puede nombrar "Google Maps" en su voz, o rompe la ilusión? ¿Deep-link a Maps por parada?
- Profundidad de la metadata curada por parada (horarios, cash-only, accesibilidad, baños, orientación).
- ¿Mecanismo para reportar paradas caídas/mudadas y actualizar el tour?

**Comercial / legal**
- Política de reembolso exacta (solo error → ¿total? ¿cómo se prueba el error?).
- ¿Precio por persona o por experiencia/dispositivo (recorrido en grupo)?
- ¿El precio incluye comida/entradas? (Aclarar antes de comprar; cash-only es real en NY.)
- Canal de soporte real con trazabilidad de la compra (para `SupportFlag`).
- ¿Función de regalar/compartir? ¿Cross-sell de otros tours (handles/URLs oficiales)?

**Safety**
- Confirmar que se autoriza romper el personaje ante crisis/autolesión y emergencia médica (derivar a ayuda / 911).
- ¿Botón de pausa/terminar y recurso de ayuda siempre visibles?

**Técnico**
- Persistencia: ¿Firestore, Supabase/Postgres, otro?
- Canal: ¿web propia o WhatsApp real? (Define si llegan audios/fotos a manejar.)
- Vertex: producto exacto (Vertex AI Search / RAG Engine) y multimodal real (PDF + video).

## 12. Punto de retome (cuando volvamos)

1. Confirmar con Henry las preguntas de §11 (sobre todo: contenido del primer recorrido, persistencia, comercial/legal, umbrales del final).
2. Elegir el **primer recorrido real** y su fuente de contenido.
3. Decidir el stack de **persistencia** y el **producto Vertex**.
4. Escribir el **spec de implementación de la "cocina"** (modelo de datos + generador + ABM) y, después, la **web de consumo**.
5. Resolver en el camino la **deuda técnica** del demo (§10).

## 13. Referencias
- Catálogo funcional completo (~100 casos, top 10 espinosos, 13 reglas transversales, estados): [`../2026-06-15-casos-de-uso-recorrido.md`](../2026-06-15-casos-de-uso-recorrido.md)
- Diseño del demo actual: [`./2026-06-15-henry-guia-chat-demo-design.md`](./2026-06-15-henry-guia-chat-demo-design.md)
- Workflows usados: `henry-tour-approaches` (panel de enfoques), `henry-tour-casos-uso` (catálogo funcional).
