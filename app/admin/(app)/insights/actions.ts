"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/admin";
import { captureBaseline } from "@/lib/insight-metrics";

/**
 * Aplica un insight de Guía útil: crea la entrada (utility) con lo confirmado en el
 * form, snapshotea las métricas "antes" y registra la acción para medir el impacto.
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
  if (!input.utility.category || !input.utility.name) {
    return { ok: false, error: "Faltan categoría o nombre." };
  }
  const sb = createAdminClient();

  // 1. crear la entrada en la Guía útil
  const { data: util, error: uErr } = await sb
    .from("utilities")
    .insert({
      category: input.utility.category,
      name: input.utility.name,
      neighborhood: input.utility.neighborhood ?? null,
      address: input.utility.address ?? null,
      place_query: input.utility.place_query ?? null,
      hours: input.utility.hours ?? null,
      henry_note: input.utility.henry_note ?? null,
    })
    .select("id")
    .single();
  if (uErr || !util) return { ok: false, error: "No se pudo crear la entrada de la Guía útil." };

  // 2. snapshot del "antes" + registrar la acción (para verificar el impacto)
  const keywords = input.keywords ?? [];
  const baseline = await captureBaseline({
    slug: input.metricSlug ?? null,
    step: input.metricStep ?? null,
    keywords,
  });
  await sb.from("insight_actions").insert({
    insight_id: input.insightId,
    item_index: input.itemIndex,
    kind: "add_utility",
    utility_id: util.id,
    metric_slug: input.metricSlug ?? null,
    metric_step: input.metricStep ?? null,
    keywords,
    baseline,
  });

  revalidatePath("/admin/insights");
  revalidatePath("/admin/utilidades");
  return { ok: true };
}
