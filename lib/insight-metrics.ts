import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type MetricSpec = { slug?: string | null; step?: number | null; keywords: string[] };

export type Baseline = {
  from: string;
  to: string;
  structural: { metric: "abandono" | "conversion"; rate: number; started: number } | null;
  volume: { perWeek: number; total: number } | null;
};

export type Impact = {
  enoughData: boolean;
  structural: { metric: string; before: number; after: number; afterSessions: number } | null;
  volume: { before: number; after: number } | null;
};

async function expIdBySlug(slug: string): Promise<string | null> {
  const { data } = await createAdminClient().from("experiences").select("id").eq("slug", slug).maybeSingle();
  return data?.id ?? null;
}

/** Abandono en un paso: EXPIRADO en ese paso / iniciadas, para esa experiencia. */
export async function abandonAtStep(
  slug: string,
  step: number,
  from: string,
  to: string
): Promise<{ rate: number; started: number } | null> {
  const expId = await expIdBySlug(slug);
  if (!expId) return null;
  const sb = createAdminClient();
  const { count: started } = await sb
    .from("play_sessions")
    .select("*", { count: "exact", head: true })
    .eq("experience_id", expId)
    .gte("created_at", from)
    .lt("created_at", to);
  if (!started) return null;
  const { count: abandoned } = await sb
    .from("play_sessions")
    .select("*", { count: "exact", head: true })
    .eq("experience_id", expId)
    .eq("status", "EXPIRADO")
    .eq("current_step_position", step)
    .gte("created_at", from)
    .lt("created_at", to);
  return { rate: (abandoned ?? 0) / started, started };
}

/** Conversión del recorrido: TERMINADO / iniciadas. */
export async function conversion(
  slug: string,
  from: string,
  to: string
): Promise<{ rate: number; started: number } | null> {
  const expId = await expIdBySlug(slug);
  if (!expId) return null;
  const sb = createAdminClient();
  const { count: started } = await sb
    .from("play_sessions")
    .select("*", { count: "exact", head: true })
    .eq("experience_id", expId)
    .gte("created_at", from)
    .lt("created_at", to);
  if (!started) return null;
  const { count: finished } = await sb
    .from("play_sessions")
    .select("*", { count: "exact", head: true })
    .eq("experience_id", expId)
    .eq("status", "TERMINADO")
    .gte("created_at", from)
    .lt("created_at", to);
  return { rate: (finished ?? 0) / started, started };
}

/** Volumen de una pregunta: mensajes del usuario que matchean alguna keyword, por semana. */
export async function questionVolume(
  keywords: string[],
  from: string,
  to: string
): Promise<{ perWeek: number; total: number } | null> {
  const clean = keywords.map((k) => k.replace(/[^a-záéíóúñü0-9 ]/gi, "").trim()).filter(Boolean);
  if (!clean.length) return null;
  const sb = createAdminClient();
  const orFilter = clean.map((k) => `text.ilike.%${k}%`).join(",");
  const { count } = await sb
    .from("session_messages")
    .select("*", { count: "exact", head: true })
    .eq("role", "user")
    .or(orFilter)
    .gte("created_at", from)
    .lt("created_at", to);
  const weeks = Math.max(1, (new Date(to).getTime() - new Date(from).getTime()) / (7 * 86400000));
  return { perWeek: (count ?? 0) / weeks, total: count ?? 0 };
}

/** El "antes": métricas sobre los 30 días previos a aplicar. */
export async function captureBaseline(spec: MetricSpec): Promise<Baseline> {
  const to = new Date().toISOString();
  const from = new Date(Date.now() - 30 * 86400000).toISOString();
  let structural: Baseline["structural"] = null;
  if (spec.slug && spec.step != null) {
    const r = await abandonAtStep(spec.slug, spec.step, from, to);
    if (r) structural = { metric: "abandono", ...r };
  } else if (spec.slug) {
    const r = await conversion(spec.slug, from, to);
    if (r) structural = { metric: "conversion", ...r };
  }
  const volume = spec.keywords.length ? await questionVolume(spec.keywords, from, to) : null;
  return { from, to, structural, volume };
}

/** El "después": desde que se aplicó vs el baseline. */
export async function computeImpact(action: {
  created_at: string;
  metric_slug: string | null;
  metric_step: number | null;
  keywords: string[];
  baseline: Baseline;
}): Promise<Impact> {
  const from = action.created_at;
  const to = new Date().toISOString();
  const base = action.baseline ?? ({} as Baseline);

  let structural: Impact["structural"] = null;
  if (action.metric_slug && action.metric_step != null) {
    const after = await abandonAtStep(action.metric_slug, action.metric_step, from, to);
    if (after) structural = { metric: "abandono", before: base.structural?.rate ?? 0, after: after.rate, afterSessions: after.started };
  } else if (action.metric_slug) {
    const after = await conversion(action.metric_slug, from, to);
    if (after) structural = { metric: "conversion", before: base.structural?.rate ?? 0, after: after.rate, afterSessions: after.started };
  }

  let volume: Impact["volume"] = null;
  if (action.keywords.length && base.volume) {
    const after = await questionVolume(action.keywords, from, to);
    if (after) volume = { before: base.volume.perWeek, after: after.perWeek };
  }

  const daysSince = (Date.now() - new Date(from).getTime()) / 86400000;
  const enoughData = structural ? structural.afterSessions >= 20 : daysSince >= 7;
  return { enoughData, structural, volume };
}
