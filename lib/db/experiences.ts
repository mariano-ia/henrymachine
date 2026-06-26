import { createAdminClient } from "@/lib/supabase/admin";

export type PlayMedia = {
  kind: "video" | "image" | "audio";
  url: string;
  caption: string | null;
};

/** Una parada (arrival) lista para jugar. */
export type PlayableStop = {
  title: string;
  proposal: string;
  walkToNext: string | null;
  placeQuery: string | null;
  address: string | null;
  media: PlayMedia[];
};

/** Experiencia aplanada para el motor (parsea los pasos de la DB). */
export type PlayableExperience = {
  id: string;
  slug: string;
  title: string;
  openingMessage: string;
  closingMessage: string | null;
  stops: PlayableStop[];
  grounding: string;
};

/**
 * Carga una experiencia PUBLICADA lista para jugar, desde Supabase (service_role).
 * v1 (físico): estructura mensaje(apertura) + arrivals + mensaje(cierre).
 * Grounding y media privados → se leen server-side; media con signed URLs.
 */
export async function getPlayableExperience(
  slug: string
): Promise<PlayableExperience | null> {
  const sb = createAdminClient();

  const { data: exp } = await sb
    .from("experiences")
    .select("id, slug, title, status")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!exp) return null;

  const { data: steps } = await sb
    .from("steps")
    .select("id, type, title, body, proposal, walk_to_next, place_query, address, position")
    .eq("experience_id", exp.id)
    .order("position");

  const { data: source } = await sb
    .from("content_sources")
    .select("inline_text")
    .eq("experience_id", exp.id)
    .maybeSingle();

  const { data: media } = await sb
    .from("step_media")
    .select("step_id, kind, storage_path, external_url, caption, position")
    .eq("experience_id", exp.id)
    .order("position");

  const mediaByStep: Record<string, PlayMedia[]> = {};
  for (const m of media ?? []) {
    let url: string | null = m.external_url ?? null;
    if (!url && m.storage_path) {
      const { data: signed } = await sb.storage
        .from("experience-media")
        .createSignedUrl(m.storage_path, 7200);
      url = signed?.signedUrl ?? null;
    }
    if (url) (mediaByStep[m.step_id] ??= []).push({ kind: m.kind, url, caption: m.caption });
  }

  const list = steps ?? [];
  const messages = list.filter((s) => s.type === "message");
  const arrivals = list.filter((s) => s.type === "arrival");

  return {
    id: exp.id,
    slug: exp.slug,
    title: exp.title,
    openingMessage: messages[0]?.body ?? "",
    closingMessage: messages.length > 1 ? messages[messages.length - 1].body : null,
    stops: arrivals.map((a) => ({
      title: a.title ?? "",
      proposal: a.proposal ?? a.body ?? "",
      walkToNext: a.walk_to_next,
      placeQuery: a.place_query,
      address: a.address,
      media: mediaByStep[a.id] ?? [],
    })),
    grounding: source?.inline_text ?? "",
  };
}
