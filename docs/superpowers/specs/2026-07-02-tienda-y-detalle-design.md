# Tienda (catálogo + detalle) — diseño e implementación

Fecha: 2026-07-02

Rediseño del **front de consumo** de Henry (chat‑guided walking tours de NYC) y
alta de la **página de detalle por experiencia**. Continúa
`2026-06-26-henry-machine-fase1-cimientos.md` y la Fase 3/4 (catálogo + pagos).

> Estado: todo funcionando en local (`npm run dev`). **No desplegado** en esta
> iteración (se verificó por localhost). **Cambios sin commitear** en `main`.

---

## 1. Look & feel (decisiones finales)

Se descartaron dos direcciones antes de llegar a la actual:
- Un skyline animado en el hero (varias vueltas, formas geométricas) → **descartado**.
- Un look "aventura/atardecer" cálido tipo travel‑booking → **descartado** por
  leerse genérico/playa. El norte es **"aventura EN NYC", ciudad, neutro**, y se
  le suma carga NYC de a poco.

Sistema visual resultante:

- **Fondo BLANCO** (`paper #FFFFFF`). Tinta cálida `ink #1C1B18`.
- **Acento ladrillo contenido** `brand #CC4E2A` (+ `brand-dark #A93E20`). Se usa
  poco: CTA, chips activos, "Henry" del titular, puntitos.
- **Hero oscuro** (`bg-ink`) que contrasta con el blanco de abajo.
- **Tipografía: TODO Inter**, jerarquía por PESOS (titulares Medium 500, cuerpo
  Regular, labels Medium/Semibold en mayúscula con `tracking-label = 0.18em`).
  La **cursiva (Fraunces) quedó PARKED**: sigue cargada en `layout.tsx` pero no
  se usa; se define después dónde entra (probablemente solo el nombre "Henry" o
  una cita corta de él). Oswald también sigue cargada como `--font-condensed`
  solo para `/demo` (`components/Hero.tsx`).
- **Escala "delicada"**: tamaños chicos y aire. Los chips de **tema** y **barrio**
  de las cards son muy chicos (~8px) con interletrado amplio.
- **Color por tema** (color‑coding sutil, se va sumando hacia NYy): Comida
  `#B8492E`, Vistas `#3A6B97`, Vida local `#3C7A55`, Clásicos `#A87C2E`. El mapa
  vive duplicado en `CatalogGrid.tsx` y en `app/e/[slug]/page.tsx`.

---

## 2. Rutas y flujo

Flujo nuevo: **catálogo → detalle → (Comenzar | Comprar) → chat**.

| Ruta | Qué es |
|---|---|
| `/` | Catálogo. Hero oscuro + card de filtros flotante + grilla 4 col. |
| `/e/[slug]` | **Detalle** (página de producto). Las cards del catálogo linkean acá. |
| `/e/[slug]/chat` | El **chat** (player). Se **movió** desde `/e/[slug]`. |
| `/demo`, `/nyc12horas` | Prototipos viejos (oscuros), intactos. |

- Checkout: `app/api/checkout/route.ts` → `success_url` ahora es
  `/e/[slug]/chat?purchased=1` (después de pagar cae directo en el chat y se
  desbloquea solo); `cancel_url` = `/e/[slug]` (detalle).

---

## 3. Componentes nuevos

- **`components/CatalogGrid.tsx`** (client): filtros (Tema / Zona / Precio,
  filtrado client‑side instantáneo) + grilla `lg:grid-cols-4`. Cada card: cover
  neutro (degradé gris + glyph tenue del tema) con tag de tema en color, precio,
  barrio, y stats (duración · caminata · paradas con íconos). En **hover** aparece
  un scrim + pill **"Más info →"**.
- **`components/HeroChat.tsx`** (client): ventanita de chat en el hero. Burbujas
  en **loop CONTINUO** (stream que nunca se vacía ni "arranca de cero"; las viejas
  se van por arriba), con **"escribiendo…"** e **"en línea"**. El guion es de un
  **recorrido EN CURSO** (sin saludo inicial) para que loopee con sentido; las
  **respuestas del usuario van con TEXTO** (no solo emoji). Ritmo lento (~1.7s
  typing, ~2.5s entre mensajes). **Solo desktop** (`hidden lg:flex`). La ventana
  usa bg gris suave `#F1EFE9` para que los globitos blancos de Henry resalten
  (si fuese blanca, desaparecían).
- **`components/BuyBar.tsx`** (client): CTA del detalle. Genera `anonId`
  (localStorage `henry_anon`, mismo que `PlayerLoader`), consulta
  `/api/experience` para saber si ya tiene acceso, y muestra:
  Gratis/ya comprado → **"Comenzar recorrido"** (→ `/e/[slug]/chat`); paga sin
  comprar → **"Comprar por $X"** (→ `/api/checkout` → Stripe).
- **`app/e/[slug]/page.tsx`** (server): el DETALLE. Estructura: **portada (slot)**
  → título + rating → pitch → "Cómo funciona" (refuerza que es un chat con
  Henry) → **itinerario** (paradas; las que están detrás del paywall van
  **bloqueadas**, sin revelar el lugar) → **card de compra sticky** (precio,
  stats, `BuyBar`) → **reseñas** → pie.
- **`lib/db/detail.ts`** → `getExperienceDetail(slug)` (admin client,
  service_role). Devuelve metadata + itinerario con solo TÍTULOS; marca `locked`
  las paradas pagas (no manda su contenido ni el lugar).

---

## 4. Modelo de datos (migración `0004_catalog_meta`)

- `experiences` += `neighborhood` (text), `theme` (text), `distance_m` (int).
  `expected_minutes` (duración) ya existía.
- Vista `experiences_public` += `neighborhood`, `theme`, `distance_m`, y
  `stops_count` (count de steps `type='arrival'`, derivado por subconsulta).
  Se recreó con `create or replace` apendeando columnas al final (para no romper
  el orden existente).

---

## 5. Contenido PLACEHOLDER (a reemplazar por real)

- **`scripts/seed-catalog.mjs`**: crea 4 experiencias de ejemplo publicadas
  (`pizzas-brooklyn`, `cafes-village`, `miradores-manhattan`,
  `domingo-williamsburg`) con meta + paradas; para las **pagas** crea el precio
  en **Stripe** (constraint `paid_needs_stripe_price` lo exige) e inserta el paso
  paywall. También setea la meta de `nyc12horas`. **Son placeholders.**
- **Reseñas** del detalle: **MOCK** hardcodeado (`RATING 4.9 · 128`, 3 tarjetas).
- **Portada** del detalle: **SLOT** con placeholder (degradé + glyph del tema).
  Muestra la foto real cuando `experiences.cover_path` esté seteado (bucket
  público `experience-covers`, helper `coverUrl`). **No hay uploader de portada
  en `/admin` todavía** (sí hay uploader de media por paso).
- **Guion** del `HeroChat`: placeholder (recorrido de pizzas).

---

## 6. Gotchas / operativa

- **Tailwind + Next dev cachea la config de colores.** Cambiar/agregar colores en
  `tailwind.config.ts` **NO se toma en caliente** (ni con restart del dev server):
  hay que **`rm -rf .next` + reiniciar `npm run dev`**. Pasó 2 veces
  (agregar `brand`; cambiar `paper` a blanco). Síntoma: la utilidad no aparece en
  el CSS servido (grepear el color en `/_next/static/css/*.css` da vacío) y el
  color no pinta (texto/burbuja "invisible"). Los cambios de RAW CSS en
  `globals.css` sí recargan en caliente.
- **Verificación visual**: screenshots headless con Chrome
  (`--headless=new --screenshot`, `--force-device-scale-factor=2`), y
  `--virtual-time-budget=NNNN` para capturar las animaciones del `HeroChat` en un
  frame con burbujas.

---

## 7. Decisiones abiertas (pendientes con Mariano/Henry)

- **Nombre del producto.** "Henry · New York" es placeholder ("no dice nada").
  Direcciones propuestas:
  - **A) "Pata" / "A Pata"** — peruano: *pata* = amigo, y *a pata* = a pie. Captura
    la sensación (chatear con un pata local). **Recomendada.**
  - B) **"Cuadras" / "Doblá"** — urbano, referencia a cómo guía Henry por chat.
  - C) Basada en **"Resilentos"** (marca/canal de Henry) si tiene tirón.
  - **PENDIENTE**: qué es exactamente "Resilentos" y a qué público apunta el
    nombre (fans de Henry vs. gente nueva).
- **Copy del hero**: ya dice explícito "Chateá con Henry…" + "recorridos por chat".
- **Dónde entra la cursiva** (Fraunces).
- Uploader de **portada** en `/admin`; **fotos reales** de Henry; **reseñas
  reales**; **versión mobile** del `HeroChat` (hoy oculto en mobile).
