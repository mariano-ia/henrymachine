import { NextRequest, NextResponse } from "next/server";
import { getPlayableExperience } from "@/lib/db/experiences";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { slug?: string; anonId?: string };
  const slug = typeof body.slug === "string" ? body.slug : "";
  if (!slug) return NextResponse.json({ error: "Falta la experiencia." }, { status: 400 });

  const exp = await getPlayableExperience(slug, body.anonId);
  if (!exp) return NextResponse.json({ error: "No disponible." }, { status: 404 });

  // progreso server-side (reanudar cross-device): la sesión EN_CURSO de este anon.
  let serverProgress: { stopIndex: number; phase: string; totalTurns: number } | null = null;
  if (typeof body.anonId === "string" && body.anonId.length >= 24) {
    try {
      const { data: sess } = await createAdminClient()
        .from("play_sessions")
        .select("current_step_position, phase, total_turns")
        .eq("experience_id", exp.id)
        .eq("anon_id", body.anonId)
        .eq("status", "EN_CURSO")
        .gt("expires_at", new Date().toISOString()) // ventana 7d: no reanudar vencidas
        .maybeSingle();
      if (sess) {
        serverProgress = {
          stopIndex: Math.max(0, (sess.current_step_position ?? 1) - 1),
          phase: sess.phase,
          totalTurns: sess.total_turns ?? 0,
        };
      }
    } catch {
      /* sin progreso server: el cliente usa su localStorage */
    }
  }

  // subset CLIENT-SAFE (sin grounding ni proposal — eso queda server-side en /api/play)
  return NextResponse.json({
    slug: exp.slug,
    title: exp.title,
    openingMessage: exp.openingMessage,
    openingMedia: exp.openingMedia,
    closingMessage: exp.closingMessage,
    stops: exp.stops.map((s) => ({
      title: s.title,
      placeQuery: s.placeQuery,
      media: s.media,
      askReview: s.askReview,
      reviewMessage: s.reviewMessage,
    })),
    locked: exp.locked,
    purchaseExpired: exp.purchaseExpired,
    priceCents: exp.priceCents,
    paywallMessage: exp.paywallMessage,
    upsell: exp.upsell,
    distanceM: exp.distanceM,
    neighborhood: exp.neighborhood,
    serverProgress,
  });
}
