# Insights V2 — Aplicar y verificar · Diseño

Acordado 2026-07-16. El V1 (en prod) detecta insights y linkea a dónde arreglarlos.
El V2 cierra el loop: **aplicar** el fix de un clic y **verificar** con números si funcionó.

## Objetivo

Que la memoria deje de ser "un informe que leés" y pase a "un sistema que mejora el
producto y te confirma que el cambio funcionó".

## Decisiones (tomadas)

- **Aplicar de un clic: solo Guía útil** (agregar baño/wifi/agua). Editar pasos sigue
  como link al editor (V1).
- **Formulario pre-cargado + confirmar** (un humano revisa lo que va al prompt de Henry).
- **Verificación con DOS métricas**: la estructural (abandono/conversión, de los datos)
  y el volumen de la pregunta (mensajes que matchean palabras clave).

## Arquitectura

### 1. El LLM da más contexto por insight
Se extiende `InsightItem` (lib/insights.ts) con campos opcionales:
- `step?: number` — a qué parada se refiere (para la métrica estructural).
- `keywords?: string[]` — palabras del tema recurrente (para el volumen).
- `utility?: { category, name, neighborhood, henry_note }` — pre-carga del form de Guía
  útil, solo en insights `guia_util`.
El SYSTEM prompt se actualiza para pedir estos campos; la validación en `analyze()` los
arrastra (keywords acotadas, utility solo si target=guia_util).

### 2. Aplicar (Guía útil)
En `/admin/insights`, cada item `guia_util` con `utility` sugerida muestra un botón
**"Agregar a la Guía útil"** → abre un form modal **pre-cargado** con la sugerencia
(editable) → al confirmar, una server action:
1. Crea la `utility` (reusa `addUtility`).
2. Calcula y snapshotea las **métricas base** (el "antes").
3. Inserta una fila en `insight_actions`.
Reusa toda la infra de utilities que ya existe.

### 3. Registro (tabla `insight_actions`)
`supabase/migrations/0021_insight_actions.sql`:
- `insight_actions`: id, created_at, insight_id uuid, item_index int, kind text
  ('add_utility'), utility_id uuid null, metric_slug text null, metric_step int null,
  keywords jsonb default '[]', baseline jsonb (snapshot del "antes"). RLS on; solo
  service_role. Índice por insight_id.

### 4. Métricas (lib/insight-metrics.ts, nuevo)
Definiciones (best-effort, computables, sin inventar):
- **Abandono en un paso** `abandonAtStep(slug, step, from, to)`: de `play_sessions` de esa
  experiencia en la ventana, `EXPIRADO con current_step_position = step` / `iniciadas`.
- **Conversión** `conversion(slug, from, to)`: `TERMINADO` / `iniciadas` (fallback si el
  insight no tiene step).
- **Volumen de pregunta** `questionVolume(keywords, from, to)`: mensajes `role='user'`
  que matchean alguna keyword (ILIKE) por semana, normalizado.
- `computeImpact(action)`: **antes** = del snapshot `baseline`; **después** = la métrica
  sobre `[applied_at, now]`. Devuelve `{ structural?: {before, after, metric}, volume?: {before, after} }`.

### 5. Verificar (inline en el insight)
En el item aplicado, un bloque **"Impacto"**:
- *"abandono en la parada 3: 40% → 15%"* y/o *"preguntas sobre baños: 12/sem → 3/sem"*.
- Si el "después" todavía no tiene datos suficientes (umbral: ≥30 sesiones de esa
  experiencia post-aplicación, o ≥7 días): *"midiendo… (faltan jugadas)"*.
- El cálculo corre al abrir `/admin/insights` (on-demand) para las acciones aplicadas.

## Archivos (qué toca)
- Migración `0021_insight_actions.sql` + tipo en `database.types.ts`.
- `lib/insights.ts` — extender InsightItem + prompt + mapping.
- `lib/insight-metrics.ts` (nuevo) — métricas + computeImpact + captura de baseline.
- `app/admin/(app)/insights/actions.ts` (nuevo) — `applyUtilityFromInsight` (server action, admin).
- `components/admin/InsightApplyButton.tsx` (nuevo) — botón + form pre-cargado (modal).
- `app/admin/(app)/insights/page.tsx` — mostrar botón aplicar + bloque Impacto por item.

## Criterios de éxito
- Un insight `guia_util` se aplica en 2 clics (abrir form + confirmar) y crea la utility.
- Queda registrado en `insight_actions` con el snapshot base.
- Un insight aplicado muestra el antes/después (o "midiendo…") de ≥1 métrica.
- El abandono/volumen salen de datos reales; nada inventado.

## Fuera de alcance (v3+)
- Editar pasos de un clic.
- Matching por significado (embeddings) para el volumen.
- Mini-experimentos A/B; alertas por email; panel de tendencias.
