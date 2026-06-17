import { NextRequest, NextResponse } from "next/server";
import { NYC12 } from "@/lib/tours/nyc12horas";
import { buildTourSystemInstruction, type TourPhase } from "@/lib/tour-prompt";
import { tourReply } from "@/lib/gemini";
import type { ChatTurn } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const PHASES: TourPhase[] = ["CAMINANDO", "EN_PARADA", "EN_PAUSA"];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      stopIndex?: number;
      phase?: TourPhase;
      turnsInStop?: number;
      message?: string;
      history?: ChatTurn[];
    };

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "Escribí un mensaje." }, { status: 400 });
    }

    const stopIndex = Math.min(
      Math.max(0, Number(body.stopIndex ?? 0)),
      NYC12.stops.length - 1
    );
    const phase: TourPhase = PHASES.includes(body.phase as TourPhase)
      ? (body.phase as TourPhase)
      : "CAMINANDO";
    const turnsInStop = Math.max(0, Number(body.turnsInStop ?? 0));

    const systemInstruction = buildTourSystemInstruction({
      tour: NYC12,
      stopIndex,
      phase,
      turnsInStop,
    });

    const result = await tourReply({
      systemInstruction,
      history: Array.isArray(body.history) ? body.history.slice(-12) : [],
      message,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: "Se me trabó 😅 probá de nuevo." },
      { status: 500 }
    );
  }
}
