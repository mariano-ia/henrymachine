import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** true = permitido. Ante error de DB deja pasar (fail-open: nunca romper el chat por el limiter). */
export async function rateLimit(
  req: NextRequest,
  bucket: string,
  anonId: string | null,
  windowSecs: number,
  max: number
): Promise<boolean> {
  try {
    const ip =
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "noip";
    const key = `${bucket}:${anonId ?? "anon"}:${ip}`;
    const { data, error } = await createAdminClient().rpc("rl_hit", {
      p_key: key,
      p_window_secs: windowSecs,
      p_max: max,
    });
    if (error) return true;
    return data === true;
  } catch {
    return true;
  }
}
