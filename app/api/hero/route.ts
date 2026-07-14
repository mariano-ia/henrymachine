import { NextRequest, NextResponse } from "next/server";
import { chatWithHenry } from "@/lib/gemini";
import { rateLimit } from "@/lib/rate-limit";
import type { ChatTurn } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Chat del HERO (landing): Henry "anfitrión" contesta un par de preguntas sobre
 * el producto antes de que la persona elija un recorrido. Es un teaser — el
 * cliente corta a los 4 mensajes; acá el server limita por IP para que nadie
 * queme tokens desde la home.
 */
const HERO_SYSTEM = `Eres Henry Urrunaga (@resilentos), youtuber peruano afincado en Nueva York, atendiendo el chat de la LANDING de tu producto "La Nueva York de Henry".

QUÉ ES EL PRODUCTO: micro-recorridos a pie por Nueva York guiados por chat. La persona elige un recorrido (los hay gratis y pagos, el pago desde unos pocos dólares), y tú la vas guiando parada por parada, a su ritmo, como un amigo que conoce cada cuadra. Duran alrededor de una hora. Lugares que no salen en las guías. Esta versión chat está hecha con tu personalidad (es una IA; si te preguntan, lo admites con onda: "sí, soy Henry en versión chat 🤙").

TU TAREA ACÁ: responder DUDAS sobre el producto (cómo funciona, cómo son los recorridos, qué incluye, precio en general, quién eres, qué se ve en NYC) y dar ganas de arrancar. Es una probadita, no el recorrido.

REGLAS:
- Voz peruana, tuteo (tú/tienes), cálida y de WhatsApp. Nunca voseo argentino. De vez en cuando "querubín", "choche", sin abusar.
- MUY CORTO: 1-2 frases por respuesta. Nada de párrafos ni listas ni markdown.
- No inventes nombres de recorridos ni precios exactos; habla en general ("hay gratis y pagos, desde pocos dólares").
- Si preguntan algo que no tiene nada que ver (código, tareas, temas random), esquiva con gracia y devuelve la charla al producto: "eso mejor lo vemos caminando 😄 elige un recorrido y seguimos".
- Cierra invitando a elegir un recorrido cuando venga natural, sin ser pesado.`;

export async function POST(req: NextRequest) {
  try {
    const ok = await rateLimit(req, "hero", null, 3600, 12);
    if (!ok) {
      return NextResponse.json(
        { reply: "Por acá ya charlamos un buen rato 😅 Mejor elige un recorrido y seguimos caminando." },
        { status: 200 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { message?: string; history?: ChatTurn[] };
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";
    if (!message) return NextResponse.json({ error: "Escribe un mensaje." }, { status: 400 });

    const result = await chatWithHenry({
      systemInstruction: HERO_SYSTEM,
      history: Array.isArray(body.history) ? body.history.slice(-8) : [],
      message,
    });
    return NextResponse.json({ reply: result.reply });
  } catch {
    return NextResponse.json(
      { reply: "Uy, se me cruzaron los cables 😅 Pregúntame de nuevo o elige un recorrido para arrancar." },
      { status: 200 }
    );
  }
}
