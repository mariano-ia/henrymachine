import { createAdminClient } from "@/lib/supabase/admin";

export type LeaderRow = { country: string; steps: number; tours: number };

/**
 * Datos de ejemplo para mostrar el diseño del ranking mientras no hay recorridos
 * terminados reales. El home lo usa como fallback y marca la sección como "ejemplo"
 * para no presentarlo como real. Cuando entren datos verdaderos, se muestran esos.
 */
export const SAMPLE_LEADERBOARD: LeaderRow[] = [
  { country: "PE", steps: 184_200, tours: 63 },
  { country: "MX", steps: 142_800, tours: 51 },
  { country: "AR", steps: 98_600, tours: 34 },
  { country: "CO", steps: 76_400, tours: 27 },
  { country: "US", steps: 61_900, tours: 22 },
  { country: "CL", steps: 44_300, tours: 15 },
  { country: "EC", steps: 33_150, tours: 12 },
  { country: "ES", steps: 27_800, tours: 9 },
  { country: "VE", steps: 19_500, tours: 7 },
  { country: "BO", steps: 12_700, tours: 4 },
];

/** Top países por pasos caminados en recorridos TERMINADOS. Vacío si no hay datos. */
export async function getCountryLeaderboard(limit = 10): Promise<LeaderRow[]> {
  try {
    const { data, error } = await createAdminClient().rpc("country_leaderboard", { p_limit: limit });
    if (error || !data) return [];
    return data.map((r) => ({ country: r.country, steps: Number(r.steps), tours: Number(r.tours) }));
  } catch {
    return [];
  }
}
