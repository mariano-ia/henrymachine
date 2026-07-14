import { createAdminClient } from "@/lib/supabase/admin";

export type DetailStop = { n: number; title: string; locked: boolean };

export type DetailReview = {
  rating: number;
  body: string | null;
  authorName: string | null;
  country: string | null;
  verified: boolean;
  featured: boolean;
};

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
  reviews: DetailReview[];
  ratingAvg: number | null;
  ratingCount: number;
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

  // reseñas reales aprobadas/destacadas (las destacadas primero)
  const { data: reviewRows } = await sb
    .from("reviews")
    .select("rating, body, author_name, country, verified_purchase, status")
    .eq("experience_id", exp.id)
    .in("status", ["approved", "featured"])
    .order("created_at", { ascending: false });
  const reviews: DetailReview[] = (reviewRows ?? [])
    .map((r) => ({
      rating: r.rating,
      body: r.body,
      authorName: r.author_name,
      country: r.country,
      verified: r.verified_purchase,
      featured: r.status === "featured",
    }))
    .sort((a, b) => Number(b.featured) - Number(a.featured));
  const ratingCount = reviews.length;
  const ratingAvg = ratingCount
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / ratingCount) * 10) / 10
    : null;

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
    reviews,
    ratingAvg,
    ratingCount,
  };
}
