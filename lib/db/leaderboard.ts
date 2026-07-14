import { createAdminClient } from "@/lib/supabase/admin";

export type LeaderRow = { country: string; steps: number; tours: number };

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
