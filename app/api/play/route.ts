import { NextRequest, NextResponse } from "next/server";
import { getPlayableExperience } from "@/lib/db/experiences";
import { getGlobalPersona } from "@/lib/db/persona";
import { getUtilitiesBlock } from "@/lib/db/utilities";
import { getStopHoursLine } from "@/lib/places";
import { buildPlaySystemInstruction, type TourPhase } from "@/lib/engine/play-prompt";
import { tourReply } from "@/lib/gemini";
import type { ChatTurn } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const PHASES: TourPhase[] = ["CAMINANDO", "EN_PARADA", "EN_PAUSA"];

// Presupuesto de conversación por experiencia (~$0,0025/turno con Flash):
// súper permisivo — lo normal son 30-60 turnos. Al SOFT Henry va cerrando;
// al HARD se despide en personaje sin llamar al LLM.
const SOFT_TURN_LIMIT = 240;
const HARD_TURN_LIMIT = 300;
const FAREWELL_AT_LIMIT =
  "Uff querubín, se nos fue el día entero charlando y yo todavía tengo que editar unos videos 😅 Lo caminado nadie te lo quita. Dejamos el recorrido acá por hoy — ¡un abrazo y nos vemos en el próximo! 🤙";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      slug?: string;
      anonId?: string;
      stopIndex?: number;
      phase?: TourPhase;
      turnsInStop?: number;
      totalTurns?: number;
      message?: string;
      history?: ChatTurn[];
      nudge?: boolean;
    };

    const slug = typeof body.slug === "string" ? body.slug : "";
    // tope de largo por mensaje: nadie escribe 1200 chars caminando
    const message =
      typeof body.message === "string" ? body.message.trim().slice(0, 1200) : "";
    if (!slug) return NextResponse.json({ error: "Falta la experiencia." }, { status: 400 });
    if (!message) return NextResponse.json({ error: "Escribí un mensaje." }, { status: 400 });

    // límite duro: despedida cálida SIN llamar al modelo
    const totalTurns = Math.max(0, Number(body.totalTurns ?? 0));
    if (totalTurns >= HARD_TURN_LIMIT) {
      return NextResponse.json({ reply: FAREWELL_AT_LIMIT, intent: "finish", limit: true });
    }

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

    // horarios reales de la parada actual (caché 12 h en steps.meta; null sin key)
    const hoursInfo = await getStopHoursLine(exp.stops[stopIndex]);

    const systemInstruction = buildPlaySystemInstruction({
      stops: exp.stops,
      grounding: exp.grounding,
      stopIndex,
      phase,
      turnsInStop: Math.max(0, Number(body.turnsInStop ?? 0)),
      nudge: body.nudge === true,
      persona,
      utilities,
      hoursInfo,
      windDown: totalTurns >= SOFT_TURN_LIMIT,
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
