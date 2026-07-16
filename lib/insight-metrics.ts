import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type MetricSpec = { slug?: string | null; step?: number | null; keywords: string[] };

export type Baseline = {
  from: string;
  to: string;
  // "resolved" = sesiones cerradas (terminadas o vencidas), para no contar las que
  // todavía están en vuelo. `before` puede ser null (sin datos previos, ≠ 0%).
  structural: { metric: "abandono" | "conversion"; rate: number; resolved: number } | null;
  volume: { total: number; days: number } | null;
};

export type Impact = {
  status: "midiendo" | "listo";
  structural: { metric: "abandono" | "conversion"; before: number | null; after: number } | null;
  volume: { before: number | null; after: number } | null; // por semana
};

const RESOLVED_MIN = 30; // sesiones cerradas mínimas para dar el "después" estructural
const VOLUME_MIN_DAYS = 7; // no medir volumen antes de una semana

async function expIdBySlug(slug: string): Promise<string | null> {
  const { data } = await createAdminClient().from("experiences").select("id").eq("slug", slug).maybeSingle();
  return data?.id ?? null;
}

/**
 * Universo RESUELTO de una experiencia en [from,to): terminadas + vencidas sin
 * terminar (expires_at < ahora). Excluye sesiones todavía vivas — nadie escribe
 * el estado EXPIRADO, así que el abandono se deriva del vencimiento.
 */
async function resolvedCounts(expId: string, from: string, to: string, step?: number | null) {
  const sb = createAdminClient();
  const now = new Date().toISOString();
  const { count: finished } = await sb
    .from("play_sessions")
    .select("*", { count: "exact", head: true })
    .eq("experience_id", expId)
    .eq("status", "TERMINADO")
    .gte("created_at", from)
    .lt("created_at", to);
  const { count: abandonedAll } = await sb
    .from("play_sessions")
    .select("*", { count: "exact", head: true })
    .eq("experience_id", expId)
    .neq("status", "TERMINADO")
    .lt("expires_at", now)
    .gte("created_at", from)
    .lt("created_at", to);
  let abandonedStep = 0;
  if (step != null) {
    const { count } = await sb
      .from("play_sessions")
      .select("*", { count: "exact", head: true })
      .eq("experience_id", expId)
      .neq("status", "TERMINADO")
      .lt("expires_at", now)
      .eq("current_step_position", step)
      .gte("created_at", from)
      .lt("created_at", to);
    abandonedStep = count ?? 0;
  }
  return {
    finished: finished ?? 0,
    abandonedStep,
    resolved: (finished ?? 0) + (abandonedAll ?? 0),
  };
}

export async function abandonAtStep(slug: string, step: number, from: string, to: string) {
  const expId = await expIdBySlug(slug);
  if (!expId) return null;
  const c = await resolvedCounts(expId, from, to, step);
  if (c.resolved === 0) return null;
  return { rate: c.abandonedStep / c.resolved, resolved: c.resolved };
}

export async function conversion(slug: string, from: string, to: string) {
  const expId = await expIdBySlug(slug);
  if (!expId) return null;
  const c = await resolvedCounts(expId, from, to);
  if (c.resolved === 0) return null;
  return { rate: c.finished / c.resolved, resolved: c.resolved };
}

/** Mensajes del usuario que matchean alguna keyword, en la ventana. */
export async function questionVolume(keywords: string[], from: string, to: string) {
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
  const days = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
  return { total: count ?? 0, days };
}

/** El "antes": métricas sobre los 30 días previos a aplicar. */
export async function captureBaseline(spec: MetricSpec): Promise<Baseline> {
  const to = new Date().toISOString();
  const from = new Date(Date.now() - 30 * 86400000).toISOString();
  let structural: Baseline["structural"] = null;
  if (spec.slug && spec.step != null) {
    const r = await abandonAtStep(spec.slug, spec.step, from, to);
    if (r) structural = { metric: "abandono", rate: r.rate, resolved: r.resolved };
  } else if (spec.slug) {
    const r = await conversion(spec.slug, from, to);
    if (r) structural = { metric: "conversion", rate: r.rate, resolved: r.resolved };
  }
  const v = spec.keywords.length ? await questionVolume(spec.keywords, from, to) : null;
  return { from, to, structural, volume: v };
}

/** El "después": desde que se aplicó vs el baseline. Conservador: solo marca
 *  "listo" cuando hay señal medible de verdad. */
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
  const afterDays = (Date.now() - new Date(from).getTime()) / 86400000;

  let structural: Impact["structural"] = null;
  let structuralReady = false;
  if (action.metric_slug && action.metric_step != null) {
    const after = await abandonAtStep(action.metric_slug, action.metric_step, from, to);
    if (after) {
      structural = { metric: "abandono", before: base.structural?.rate ?? null, after: after.rate };
      structuralReady = after.resolved >= RESOLVED_MIN;
    }
  } else if (action.metric_slug) {
    const after = await conversion(action.metric_slug, from, to);
    if (after) {
      structural = { metric: "conversion", before: base.structural?.rate ?? null, after: after.rate };
      structuralReady = after.resolved >= RESOLVED_MIN;
    }
  }

  let volume: Impact["volume"] = null;
  if (action.keywords.length && afterDays >= VOLUME_MIN_DAYS) {
    const after = await questionVolume(action.keywords, from, to);
    if (after && after.days > 0) {
      const afterPerWeek = after.total / (after.days / 7);
      const beforePerWeek = base.volume && base.volume.days > 0 ? base.volume.total / (base.volume.days / 7) : null;
      volume = { before: beforePerWeek, after: afterPerWeek };
    }
  }

  const status: Impact["status"] = structuralReady || volume ? "listo" : "midiendo";
  return { status, structural: structuralReady ? structural : null, volume };
}
