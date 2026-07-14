import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Horarios reales vía Google Places (New), con caché diario en steps.meta:
 *   meta.places = { placeId, name, openNow, todayLine, businessStatus, fetchedAt }
 * Presupuesto: 1 searchText por parada (una vez) + 1 details por parada por día.
 * Sin GOOGLE_MAPS_API_KEY todo devuelve null y el motor sigue como antes.
 */

const CACHE_TTL_MS = 12 * 3600 * 1000; // 12 h: cubre "hoy" sin gastar de más

type PlacesCache = {
  placeId: string;
  name: string;
  openNow: boolean | null;
  todayLine: string | null;
  businessStatus: string | null;
  fetchedAt: number;
};

function apiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY || null;
}

function todayInNY(): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/New_York" }).format(new Date());
}

function pickTodayLine(weekdayDescriptions: string[] | undefined): string | null {
  if (!weekdayDescriptions?.length) return null;
  const today = todayInNY();
  return weekdayDescriptions.find((l) => l.startsWith(today)) ?? null;
}

type GoogleHours = {
  openNow?: boolean;
  weekdayDescriptions?: string[];
};
type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  currentOpeningHours?: GoogleHours;
  regularOpeningHours?: GoogleHours;
  businessStatus?: string;
};

const FIELDS = "id,displayName,currentOpeningHours,regularOpeningHours,businessStatus";

async function searchPlace(query: string, key: string): Promise<GooglePlace | null> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELDS.split(",").map((f) => `places.${f}`).join(","),
    },
    body: JSON.stringify({ textQuery: `${query}, New York` }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { places?: GooglePlace[] };
  return data.places?.[0] ?? null;
}

async function placeDetails(placeId: string, key: string): Promise<GooglePlace | null> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as GooglePlace;
}

function toCache(p: GooglePlace): PlacesCache {
  const hours = p.currentOpeningHours ?? p.regularOpeningHours;
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "",
    openNow: hours?.openNow ?? null,
    todayLine: pickTodayLine(hours?.weekdayDescriptions),
    businessStatus: p.businessStatus ?? null,
    fetchedAt: Date.now(),
  };
}

/**
 * Línea de horarios para el prompt de la parada actual (o null si no hay
 * key/lugar/datos). Cachea en steps.meta y refresca cada 12 h.
 */
export async function getStopHoursLine(stop: {
  id: string;
  title: string;
  placeQuery: string | null;
  meta: unknown;
}): Promise<string | null> {
  const key = apiKey();
  if (!key || !stop.placeQuery) return null;

  try {
    const metaObj = (stop.meta ?? {}) as Record<string, unknown>;
    let cache = metaObj.places as PlacesCache | undefined;

    if (!cache?.placeId || Date.now() - (cache.fetchedAt ?? 0) > CACHE_TTL_MS) {
      const fresh = cache?.placeId
        ? await placeDetails(cache.placeId, key)
        : await searchPlace(stop.placeQuery, key);
      if (fresh?.id) {
        cache = toCache(fresh);
        const sb = createAdminClient();
        await sb
          .from("steps")
          .update({ meta: { ...metaObj, places: cache } })
          .eq("id", stop.id);
      }
    }

    if (!cache) return null;
    if (cache.businessStatus === "CLOSED_PERMANENTLY") {
      return `OJO: "${stop.title}" figura CERRADO PERMANENTEMENTE en Google — avisale al usuario y proponé seguir a la próxima parada.`;
    }
    const bits: string[] = [];
    if (cache.openNow != null) bits.push(cache.openNow ? "ahora está ABIERTO" : "ahora está CERRADO");
    if (cache.todayLine) bits.push(`horario de hoy: ${cache.todayLine}`);
    if (bits.length === 0) return null;
    return `Dato REAL de Google sobre "${stop.title}": ${bits.join(" · ")}.`;
  } catch {
    return null;
  }
}
