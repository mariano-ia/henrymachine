import { NextRequest, NextResponse } from "next/server";
import { getPlayableExperience } from "@/lib/db/experiences";
import { getGlobalPersona } from "@/lib/db/persona";
import { getUtilitiesBlock } from "@/lib/db/utilities";
import { buildPlaySystemInstruction, type TourPhase } from "@/lib/engine/play-prompt";
import { tourReply } from "@/lib/gemini";
import type { ChatTurn } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const PHASES: TourPhase[] = ["CAMINANDO", "EN_PARADA", "EN_PAUSA"];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      slug?: string;
      anonId?: string;
      stopIndex?: number;
      phase?: TourPhase;
      turnsInStop?: number;
      message?: string;
      history?: ChatTurn[];
      nudge?: boolean;
    };

    const slug = typeof body.slug === "string" ? body.slug : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!slug) return NextResponse.json({ error: "Falta la experiencia." }, { status: 400 });
    if (!message) return NextResponse.json({ error: "Escribí un mensaje." }, { status: 400 });

    const [exp, persona, utilities] = await Promise.all([
      getPlayableExperience(slug, body.anonId),
      getGlobalPersona(),
      getUtilitiesBlock(),
    ]);
    if (!exp || exp.stops.length === 0) {
      return NextResponse.json({ error: "Experiencia no disponible." }, { status: 404 });
    }

    const stopIndex = Math.min(Math.max(0, Number(body.stopIndex ?? 0)), exp.stops.length - 1);
    const phase: TourPhase = PHASES.includes(body.phase as TourPhase)
      ? (body.phase as TourPhase)
      : "CAMINANDO";

    const systemInstruction = buildPlaySystemInstruction({
      stops: exp.stops,
      grounding: exp.grounding,
      stopIndex,
      phase,
      turnsInStop: Math.max(0, Number(body.turnsInStop ?? 0)),
      nudge: body.nudge === true,
      persona,
      utilities,
    });

    const result = await tourReply({
      systemInstruction,
      history: Array.isArray(body.history) ? body.history.slice(-12) : [],
      message,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Se me trabó 😅 probá de nuevo." }, { status: 500 });
  }
}
