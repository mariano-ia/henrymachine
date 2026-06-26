import { NextRequest, NextResponse } from "next/server";
import { getPlayableExperience } from "@/lib/db/experiences";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { slug?: string; anonId?: string };
  const slug = typeof body.slug === "string" ? body.slug : "";
  if (!slug) return NextResponse.json({ error: "Falta la experiencia." }, { status: 400 });

  const exp = await getPlayableExperience(slug, body.anonId);
  if (!exp) return NextResponse.json({ error: "No disponible." }, { status: 404 });

  // subset CLIENT-SAFE (sin grounding ni proposal — eso queda server-side en /api/play)
  return NextResponse.json({
    slug: exp.slug,
    title: exp.title,
    openingMessage: exp.openingMessage,
    closingMessage: exp.closingMessage,
    stops: exp.stops.map((s) => ({
      title: s.title,
      placeQuery: s.placeQuery,
      media: s.media,
    })),
    locked: exp.locked,
    priceCents: exp.priceCents,
    paywallMessage: exp.paywallMessage,
  });
}
