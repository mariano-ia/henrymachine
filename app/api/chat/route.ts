import { NextRequest, NextResponse } from "next/server";
import { buildHenrySystemInstruction } from "@/lib/persona";
import { chatWithHenry } from "@/lib/gemini";
import { getDemoVideos, getDemoVoiceProfile } from "@/lib/demo-session";
import type { ChatTurn } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      message?: string;
      history?: ChatTurn[];
    };

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "Escribí un mensaje." }, { status: 400 });
    }

    // Sesión-demo fija: los videos de Tokio ya ingeridos (server-side).
    const systemInstruction = buildHenrySystemInstruction({
      voiceProfile: getDemoVoiceProfile(),
      videos: getDemoVideos(),
    });

    const result = await chatWithHenry({
      systemInstruction,
      history: Array.isArray(body.history) ? body.history.slice(-12) : [],
      message,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: "Error generando la respuesta.", message: String((e as Error)?.message ?? e) },
      { status: 500 }
    );
  }
}
