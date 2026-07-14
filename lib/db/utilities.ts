import { createAdminClient } from "@/lib/supabase/admin";

export type Utility = {
  id: string;
  category: string;
  name: string;
  neighborhood: string | null;
  address: string | null;
  place_query: string | null;
  hours: string | null;
  is_free: boolean;
  henry_note: string | null;
  active: boolean;
  position: number;
};

export const UTILITY_CATEGORIES = [
  "Baños",
  "Agua",
  "Transporte",
  "WiFi y carga",
  "Plata",
  "Emergencias",
  "Consejos",
] as const;

/**
 * Bloque de texto compacto de la Guía útil para inyectar en el prompt del
 * motor (todas las experiencias). Devuelve null si la tabla no existe aún
 * (migración 0008 sin aplicar) o si no hay entradas activas.
 */
export async function getUtilitiesBlock(): Promise<string | null> {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("utilities")
      .select("category, name, neighborhood, address, place_query, hours, is_free, henry_note")
      .eq("active", true)
      .order("category")
      .order("position");
    if (error || !data || data.length === 0) return null;

    return data
      .map((u) => {
        const bits = [
          `(${u.category}) ${u.name}`,
          u.neighborhood ? `zona: ${u.neighborhood}` : "vale en toda la ciudad",
          u.address ?? null,
          u.hours ? `horario: ${u.hours}` : null,
          u.is_free ? null : "es pago",
          u.henry_note ? `tu consejo: "${u.henry_note}"` : null,
        ].filter(Boolean);
        return `- ${bits.join(" · ")}`;
      })
      .join("\n");
  } catch {
    return null;
  }
}
