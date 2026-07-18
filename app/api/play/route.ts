import { NextRequest, NextResponse } from "next/server";
import { getPlayableExperience } from "@/lib/db/experiences";
import { getGlobalPersona } from "@/lib/db/persona";
import { getUtilitiesBlock } from "@/lib/db/utilities";
import { getStopHoursLine } from "@/lib/places";
import { buildPlaySystemInstruction, type TourPhase } from "@/lib/engine/play-prompt";
import { tourReply } from "@/lib/gemini";
import { rateLimit, globalLimit } from "@/lib/rate-limit";
import { recordTurn, sessionTotalTurns } from "@/lib/db/sessions";
import { createClient } from "@/lib/supabase/server";
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
  "Uff querubín, se nos fue el día entero charlando y yo todavía tengo que editar unos videos 😅 Lo caminado nadie te lo quita. Dejamos el recorrido acá por hoy — un abrazo y nos vemos en el próximo! 🤙";
// kill-switch / presupuesto agotado: mensaje en personaje, sin llamar al LLM.
const MAINT_MESSAGE =
  "Uy, ahorita ando desconectado un ratito 😴 dame unos minutos y seguimos el recorrido, ya? Un abrazo 🤙";

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
    if (!message) return NextResponse.json({ error: "Escribe un mensaje." }, { status: 400 });

    // kill-switch de emergencia: apaga el chat SIN deploy (Vercel env CHAT_DISABLED=1),
    // p. ej. si el costo se dispara o la cuota de Gemini se agota.
    if (process.env.CHAT_DISABLED === "1" || process.env.CHAT_DISABLED === "true") {
      return NextResponse.json({ reply: MAINT_MESSAGE, intent: "none" });
    }

    // rate limit: 20/min y 400/día por anonId+IP, Y un tope por IP sola. El anonId
    // lo genera el cliente: rotándolo evadía los dos primeros; el bucket por-IP no.
    // OJO: la audiencia es peruana y móvil (Claro/Movistar/Entel usan CGNAT: MUCHOS
    // usuarios legítimos comparten una IP de egreso). Por eso el tope por-IP es alto
    // —solo frena una ráfaga scripteada desde una IP, no el NAT compartido—; el
    // verdadero límite de costo agregado es DAILY_TURN_BUDGET (globalLimit) más abajo.
    const anonIdForRl = typeof body.anonId === "string" ? body.anonId : null;
    const okMin = await rateLimit(req, "play-m", anonIdForRl, 60, 20);
    const okDay = await rateLimit(req, "play-d", anonIdForRl, 86400, 400);
    const okIpMin = await rateLimit(req, "play-ip-m", null, 60, 300);
    if (!okMin || !okDay || !okIpMin) {
      return NextResponse.json(
        { reply: "Uy, me están llegando mensajes muy rápido 😅 dame un minutito y seguimos, ya?", intent: "none" },
        { status: 429 }
      );
    }

    const [exp, persona, utilities] = await Promise.all([
      getPlayableExperience(slug, body.anonId),
      getGlobalPersona(),
      getUtilitiesBlock(),
    ]);
    if (!exp || exp.stops.length === 0) {
      return NextResponse.json({ error: "Experiencia no disponible." }, { status: 404 });
    }

    // límite duro server-side: el mayor entre lo que dice el cliente y la sesión
    // real (un cliente que resetea su contador no evade el tope). Despedida sin LLM.
    const clientTurns = Math.max(0, Number(body.totalTurns ?? 0));
    const serverTurns = anonIdForRl ? await sessionTotalTurns(exp.id, anonIdForRl) : 0;
    const totalTurns = Math.max(clientTurns, serverTurns);
    if (totalTurns >= HARD_TURN_LIMIT) {
      return NextResponse.json({ reply: FAREWELL_AT_LIMIT, intent: "finish", limit: true });
    }

    // presupuesto GLOBAL de turnos/día (Vercel env DAILY_TURN_BUDGET): backstop de
    // costo ante abuso distribuido (muchas IPs). Solo cuenta turnos que van al LLM.
    const dailyBudget = Number(process.env.DAILY_TURN_BUDGET ?? 0);
    if (dailyBudget > 0 && !(await globalLimit("play-day", 86400, dailyBudget))) {
      return NextResponse.json({ reply: MAINT_MESSAGE, intent: "none" });
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
      history: Array.isArray(body.history)
        ? body.history.slice(-12).map((t) => ({
            role: t?.role === "henry" ? ("henry" as const) : ("user" as const),
            text: String(t?.text ?? "").slice(0, 1000),
          }))
        : [],
      message,
    });

    // ¿está logueado el que juega? entonces linkeamos la sesión a su cuenta,
    // así "Mis recorridos" refleja el progreso aunque juegue desde otro dispositivo.
    let userId: string | null = null;
    try {
      const { data } = await (await createClient()).auth.getUser();
      userId = data.user?.id ?? null;
    } catch {
      /* sin sesión: queda anónimo */
    }

    // progreso + costo server-side (fire-and-forget; nunca rompe el chat)
    await recordTurn({
      experienceId: exp.id,
      anonId: anonIdForRl,
      userId,
      stopIndex,
      phase,
      intent: result.intent,
      finished: result.intent === "finish",
      replyText: result.reply,
      userMessage: message,
      country: req.headers.get("x-vercel-ip-country"),
      promptTokens: result.usage.prompt,
      outputTokens: result.usage.output,
    });

    return NextResponse.json({ reply: result.reply, intent: result.intent });
  } catch (e) {
    console.error("[play] el motor del chat falló", e);
    return NextResponse.json({ error: "Se me trabó 😅 prueba de nuevo." }, { status: 500 });
  }
}
