import { NextRequest, NextResponse } from "next/server";
import { buildHenrySystemInstruction } from "@/lib/persona";
import { chatWithHenry } from "@/lib/gemini";
import type { ChatTurn, VideoTranscript } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      videos?: VideoTranscript[];
      voiceProfile?: string;
      message?: string;
      history?: ChatTurn[];
    };

    const videos = Array.isArray(body.videos) ? body.videos : [];
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json({ error: "Escribí un mensaje." }, { status: 400 });
    }
    if (videos.length === 0) {
      return NextResponse.json(
        { error: "No hay videos cargados en esta sesión." },
        { status: 400 }
      );
    }

    const systemInstruction = buildHenrySystemInstruction({
      voiceProfile: body.voiceProfile ?? "",
      videos,
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
