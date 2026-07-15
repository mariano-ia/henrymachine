import { createAdminClient } from "@/lib/supabase/admin";

export type PlayMedia = {
  kind: "video" | "image" | "audio";
  url: string;
  caption: string | null;
};

export type PlayableStop = {
  id: string;
  title: string;
  proposal: string;
  walkToNext: string | null;
  placeQuery: string | null;
  address: string | null;
  meta: unknown; // steps.meta (caché de Places, etc.) — server-only
  media: PlayMedia[];
  askReview: boolean; // al llegar acá, Henry pide una reseña inline
  reviewMessage: string | null;
};

export type UpsellOffer = {
  slug: string;
  title: string;
  priceCents: number;
  coverPath: string | null;
  message: string | null;
  promoCode: string | null;
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
  upsell: UpsellOffer | null; // qué ofrecer al terminar
  purchaseExpired: boolean; // compró pero no empezó y pasaron 90 días
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
    .select("id, slug, title, status, price_cents, upsell_experience_id, upsell_message, upsell_promo_code")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!exp) return null;

  // upsell: la siguiente experiencia a ofrecer al terminar (solo si está publicada)
  let upsell: UpsellOffer | null = null;
  if (exp.upsell_experience_id) {
    const { data: next } = await sb
      .from("experiences")
      .select("slug, title, price_cents, cover_path, status")
      .eq("id", exp.upsell_experience_id)
      .eq("status", "published")
      .maybeSingle();
    if (next) {
      upsell = {
        slug: next.slug,
        title: next.title,
        priceCents: next.price_cents,
        coverPath: next.cover_path,
        message: exp.upsell_message,
        promoCode: exp.upsell_promo_code,
      };
    }
  }

  let hasAccess = exp.price_cents === 0;
  let purchaseExpired = false;
  if (!hasAccess && anonId) {
    const { data: ent } = await sb
      .from("entitlements")
      .select("id, purchase_id, created_at")
      .eq("experience_id", exp.id)
      .eq("anon_id", anonId)
      .is("revoked_at", null)
      .maybeSingle();
    if (ent) {
      // ¿empezó? si sí, es para siempre. si no, vence a los 90 días de pagar.
      const { data: started } = await sb.rpc("entitlement_started", {
        p_experience_id: exp.id,
        p_anon_id: anonId,
        p_user_id: null,
        p_grant_email: null,
      });
      let paidAt: string | null = ent.created_at;
      if (ent.purchase_id) {
        const { data: pur } = await sb
          .from("purchases")
          .select("paid_at")
          .eq("id", ent.purchase_id)
          .maybeSingle();
        paidAt = pur?.paid_at ?? ent.created_at;
      }
      const ageDays = paidAt ? (Date.now() - new Date(paidAt).getTime()) / 86400000 : 0;
      if (started === true || ageDays <= 90) {
        hasAccess = true;
      } else {
        purchaseExpired = true; // no empezó y venció
      }
    }
  }

  const { data: allSteps } = await sb
    .from("steps")
    .select("id, type, title, body, proposal, walk_to_next, place_query, address, position, is_paywall, paywall_message, meta, ask_review, review_message")
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
      // 24 h: cubre sesiones largas o con pausas (la de 2 h se rompía en tours largos)
      const { data: signed } = await sb.storage
        .from("experience-media")
        .createSignedUrl(m.storage_path, 86400);
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
      id: a.id,
      title: a.title ?? "",
      proposal: a.proposal ?? a.body ?? "",
      walkToNext: a.walk_to_next,
      placeQuery: a.place_query,
      address: a.address,
      meta: a.meta,
      media: mediaByStep[a.id] ?? [],
      askReview: !!a.ask_review,
      reviewMessage: a.review_message ?? null,
    })),
    // server-only; NO se manda al cliente. Además, si el viewer NO compró, el
    // grounding (relato completo, incluye las paradas pagas) NO entra al prompt:
    // sin esto, pedirle a Henry "adelántame el resto" filtraba el contenido pago.
    grounding: hasAccess ? source?.inline_text ?? "" : "",
    locked: exp.price_cents > 0 && !hasAccess,
    purchaseExpired,
    priceCents: exp.price_cents,
    paywallMessage: paywallStep?.paywall_message ?? null,
    upsell,
  };
}
