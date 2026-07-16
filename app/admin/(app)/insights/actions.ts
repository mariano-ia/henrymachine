"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/admin";
import { captureBaseline } from "@/lib/insight-metrics";

const CATS = new Set(["Baños", "Agua", "Transporte", "WiFi y carga", "Plata", "Emergencias", "Consejos"]);
const clip = (s: string | null | undefined, n: number) => ((s ?? "").trim().slice(0, n) || null);

/**
 * Aplica un insight de Guía útil: crea la entrada (utility) con lo confirmado en el
 * form, snapshotea las métricas "antes" y registra la acción para medir el impacto.
 * Idempotente y con rollback: nunca deja una utility huérfana ni duplicada.
 */
export async function applyUtilityFromInsight(input: {
  insightId: string;
  itemIndex: number;
  utility: {
    category: string;
    name: string;
    neighborhood?: string | null;
    address?: string | null;
    place_query?: string | null;
    hours?: string | null;
    henry_note?: string | null;
  };
  metricSlug?: string | null;
  metricStep?: number | null;
  keywords?: string[];
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "No autorizado." };

  const name = (input.utility.name ?? "").trim().slice(0, 120);
  const category = input.utility.category;
  if (!name || !CATS.has(category)) return { ok: false, error: "Categoría o nombre inválidos." };

  const sb = createAdminClient();

  // idempotencia: no aplicar dos veces el mismo insight+item (el índice único de
  // 0021 es el backstop; este pre-check da un mensaje claro)
  const { data: existing } = await sb
    .from("insight_actions")
    .select("id")
    .eq("insight_id", input.insightId)
    .eq("item_index", input.itemIndex)
    .maybeSingle();
  if (existing) return { ok: false, error: "Este insight ya fue aplicado." };

  // baseline PRIMERO (solo lectura): si falla, no dejamos una utility huérfana
  const keywords = input.keywords ?? [];
  let baseline;
  try {
    baseline = await captureBaseline({ slug: input.metricSlug ?? null, step: input.metricStep ?? null, keywords });
  } catch {
    return { ok: false, error: "No se pudo calcular la métrica base. Reintentá." };
  }

  // crear la entrada en la Guía útil
  const { data: util, error: uErr } = await sb
    .from("utilities")
    .insert({
      category,
      name,
      neighborhood: clip(input.utility.neighborhood, 120),
      address: clip(input.utility.address, 200),
      place_query: clip(input.utility.place_query, 200),
      hours: clip(input.utility.hours, 120),
      henry_note: clip(input.utility.henry_note, 600),
    })
    .select("id")
    .single();
  if (uErr || !util) return { ok: false, error: "No se pudo crear la entrada de la Guía útil." };

  // registrar la acción; si falla, REVERTIR la utility (nada huérfano ni duplicado)
  const { error: aErr } = await sb.from("insight_actions").insert({
    insight_id: input.insightId,
    item_index: input.itemIndex,
    kind: "add_utility",
    utility_id: util.id,
    metric_slug: input.metricSlug ?? null,
    metric_step: input.metricStep ?? null,
    keywords,
    baseline,
  });
  if (aErr) {
    await sb.from("utilities").delete().eq("id", util.id);
    return { ok: false, error: "No se pudo registrar la acción. Reintentá." };
  }

  revalidatePath("/admin/insights");
  revalidatePath("/admin/utilidades");
  return { ok: true };
}
