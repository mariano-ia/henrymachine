import { createAdminClient } from "@/lib/supabase/admin";

export type PlayMedia = {
  kind: "video" | "image" | "audio";
  url: string;
  caption: string | null;
};

export type PlayableStop = {
  title: string;
  proposal: string;
  walkToNext: string | null;
  placeQuery: string | null;
  address: string | null;
  media: PlayMedia[];
};

export type PlayableExperience = {
  id: string;
  slug: string;
  title: string;
  openingMessage: string;
  openingMedia: PlayMedia[]; // media del paso de apertura (ej. audio de bienvenida)
  closingMessage: string | null;
  stops: PlayableStop[];
  grounding: string;
  // monetización
  locked: boolean; // paga y el viewer (anon) no compró → hay pasos detrás del paywall
  priceCents: number;
  paywallMessage: string | null;
};

/**
 * Carga una experiencia PUBLICADA lista para jugar, desde Supabase (service_role).
 * El gate del paywall se evalúa acá con el anonId (entitlement). El contenido
 * pago NUNCA se incluye si el viewer no compró.
 */
export async function getPlayableExperience(
  slug: string,
  anonId?: string
): Promise<PlayableExperience | null> {
  const sb = createAdminClient();

  const { data: exp } = await sb
    .from("experiences")
    .select("id, slug, title, status, price_cents")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!exp) return null;

  let hasAccess = exp.price_cents === 0;
  if (!hasAccess && anonId) {
    const { data: ent } = await sb
      .from("entitlements")
      .select("id")
      .eq("experience_id", exp.id)
      .eq("anon_id", anonId)
      .is("revoked_at", null)
      .maybeSingle();
    hasAccess = !!ent;
  }

  const { data: allSteps } = await sb
    .from("steps")
    .select("id, type, title, body, proposal, walk_to_next, place_query, address, position, is_paywall, paywall_message")
    .eq("experience_id", exp.id)
    .order("position");
  const steps = allSteps ?? [];

  const { data: source } = await sb
    .from("content_sources")
    .select("inline_text")
    .eq("experience_id", exp.id)
    .maybeSingle();

  const paywallStep = steps.find((s) => s.is_paywall);
  const paywallPos = paywallStep?.position ?? null;
  const visible =
    hasAccess || paywallPos == null ? steps : steps.filter((s) => s.position <= paywallPos);

  // media (privada → signed URLs) solo de pasos visibles
  const visibleIds = new Set(visible.map((s) => s.id));
  const { data: media } = await sb
    .from("step_media")
    .select("step_id, kind, storage_path, external_url, caption, position")
    .eq("experience_id", exp.id)
    .order("position");
  const mediaByStep: Record<string, PlayMedia[]> = {};
  for (const m of media ?? []) {
    if (!visibleIds.has(m.step_id)) continue;
    let url: string | null = m.external_url ?? null;
    if (!url && m.storage_path) {
      const { data: signed } = await sb.storage
        .from("experience-media")
        .createSignedUrl(m.storage_path, 7200);
      url = signed?.signedUrl ?? null;
    }
    if (url) (mediaByStep[m.step_id] ??= []).push({ kind: m.kind, url, caption: m.caption });
  }

  const messages = visible.filter((s) => s.type === "message");
  const arrivals = visible.filter((s) => s.type === "arrival");

  return {
    id: exp.id,
    slug: exp.slug,
    title: exp.title,
    openingMessage: messages[0]?.body ?? "",
    openingMedia: messages[0] ? mediaByStep[messages[0].id] ?? [] : [],
    closingMessage: messages.length > 1 ? messages[messages.length - 1].body : null,
    stops: arrivals.map((a) => ({
      title: a.title ?? "",
      proposal: a.proposal ?? a.body ?? "",
      walkToNext: a.walk_to_next,
      placeQuery: a.place_query,
      address: a.address,
      media: mediaByStep[a.id] ?? [],
    })),
    grounding: source?.inline_text ?? "", // server-only; NO se manda al cliente
    locked: exp.price_cents > 0 && !hasAccess,
    priceCents: exp.price_cents,
    paywallMessage: paywallStep?.paywall_message ?? null,
  };
}
