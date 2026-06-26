import { createAdminClient } from "@/lib/supabase/admin";

/** Una parada (arrival) lista para jugar. */
export type PlayableStop = {
  title: string;
  proposal: string; // qué transmite Henry en la parada
  walkToNext: string | null;
  placeQuery: string | null; // para el deep-link a Maps
  address: string | null;
};

/** Experiencia aplanada para el motor (parsea los pasos de la DB). */
export type PlayableExperience = {
  id: string;
  slug: string;
  title: string;
  openingMessage: string;
  closingMessage: string | null;
  stops: PlayableStop[];
  grounding: string; // content_sources.inline_text
};

/**
 * Carga una experiencia PUBLICADA lista para jugar, desde Supabase (service_role).
 * v1 (físico): asume estructura mensaje(apertura) + arrivals + mensaje(cierre).
 * El grounding es privado (content_sources) → se lee server-side con service_role.
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
    .select("type, title, body, proposal, walk_to_next, place_query, address, position")
    .eq("experience_id", exp.id)
    .order("position");

  const { data: source } = await sb
    .from("content_sources")
    .select("inline_text")
    .eq("experience_id", exp.id)
    .maybeSingle();

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
    })),
    grounding: source?.inline_text ?? "",
  };
}
