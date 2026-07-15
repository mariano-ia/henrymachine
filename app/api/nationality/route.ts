import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Nacionalidad auto-declarada: reescribe el país de TODAS las sesiones del anon
 * con el elegido (pasadas incluidas). Se pide al terminar (sesión ya TERMINADO),
 * así el registro de turnos no lo vuelve a pisar. El leaderboard usa
 * play_sessions.country, así que el declarado le gana a la IP sin más cambios.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { anonId?: string; country?: string };
  const anonId = typeof body.anonId === "string" ? body.anonId : "";
  const country = typeof body.country === "string" ? body.country.toUpperCase() : "";
  // ISO-2; solo puede afectar las sesiones del propio anon (bajo riesgo)
  if (anonId.length < 24 || !/^[A-Z]{2}$/.test(country)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const ok = await rateLimit(req, "nationality", anonId, 3600, 20);
  if (!ok) return NextResponse.json({ ok: false }, { status: 429 });

  try {
    await createAdminClient().from("play_sessions").update({ country }).eq("anon_id", anonId);
  } catch {
    /* no romper la UX por esto */
  }
  return NextResponse.json({ ok: true });
}
