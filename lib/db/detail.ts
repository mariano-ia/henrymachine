import { createAdminClient } from "@/lib/supabase/admin";

export type DetailStop = { n: number; title: string; locked: boolean };

export type ExperienceDetail = {
  id: string;
  slug: string;
  title: string;
  theme: string | null;
  neighborhood: string | null;
  city: string | null;
  pitch: string | null;
  henryTip: string | null;
  expectedMinutes: number | null;
  distanceM: number | null;
  priceCents: number;
  stopsCount: number;
  freeStops: number;
  coverPath: string | null;
  coverKind: "image" | "video" | null;
  itinerary: DetailStop[];
};

/**
 * Datos PÚBLICOS para la página de detalle de una experiencia publicada.
 * Muestra los TÍTULOS de las paradas como itinerario; las paradas detrás del
 * paywall van marcadas como `locked` (no se revela su contenido ni el lugar).
 */
export async function getExperienceDetail(
  slug: string
): Promise<ExperienceDetail | null> {
  const sb = createAdminClient();

  // select * : tolera columnas nuevas aún no migradas (p. ej. henry_tip / 0007)
  const { data: exp } = await sb
    .from("experiences")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!exp) return null;

  const { data: steps } = await sb
    .from("steps")
    .select("type, title, position, is_paywall")
    .eq("experience_id", exp.id)
    .order("position");
  const all = steps ?? [];

  const paywall = all.find((s) => s.is_paywall);
  const paywallPos = paywall?.position ?? null;
  const arrivals = all.filter((s) => s.type === "arrival");

  const itinerary: DetailStop[] = arrivals.map((a, i) => ({
    n: i + 1,
    title: a.title ?? "",
    locked: paywallPos != null && a.position > paywallPos,
  }));

  return {
    id: exp.id,
    slug: exp.slug,
    title: exp.title,
    theme: exp.theme,
    neighborhood: exp.neighborhood,
    city: exp.city,
    pitch: exp.pitch,
    henryTip: exp.henry_tip ?? null,
    expectedMinutes: exp.expected_minutes,
    distanceM: exp.distance_m,
    priceCents: exp.price_cents,
    stopsCount: arrivals.length,
    freeStops: itinerary.filter((s) => !s.locked).length,
    coverPath: exp.cover_path,
    coverKind: exp.cover_path
      ? /\.(mp4|webm|mov|m4v)$/i.test(exp.cover_path)
        ? "video"
        : "image"
      : null,
    itinerary,
  };
}
