import { NextRequest, NextResponse } from "next/server";
import { parseVideoId, fetchTitle } from "@/lib/youtube";
import { fetchTranscriptSegments } from "@/lib/transcript";
import { distillVoiceProfile } from "@/lib/gemini";
import type { VideoTranscript } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type PerLink =
  | { video: VideoTranscript }
  | { url: string; error: string };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { links?: unknown };
    const links = Array.isArray(body.links) ? body.links : [];
    const cleaned = links
      .map((l) => String(l).trim())
      .filter(Boolean)
      .slice(0, 3);

    if (cleaned.length === 0) {
      return NextResponse.json(
        { error: "Pegá al menos un link de YouTube." },
        { status: 400 }
      );
    }

    const results: PerLink[] = await Promise.all(
      cleaned.map(async (url): Promise<PerLink> => {
        const videoId = parseVideoId(url);
        if (!videoId) return { url, error: "Link de YouTube inválido." };
        try {
          const [segments, title] = await Promise.all([
            fetchTranscriptSegments(videoId),
            fetchTitle(url),
          ]);
          if (segments.length === 0) {
            return { url, error: "No encontré subtítulos para este video." };
          }
          return { video: { videoId, url, title, segments } };
        } catch {
          return {
            url,
            error: "No pude obtener la transcripción (¿tiene subtítulos?).",
          };
        }
      })
    );

    const videos = results
      .filter((r): r is { video: VideoTranscript } => "video" in r)
      .map((r) => r.video);
    const errors = results
      .filter((r): r is { url: string; error: string } => "error" in r)
      .map((r) => ({ url: r.url, error: r.error }));

    if (videos.length === 0) {
      return NextResponse.json(
        { error: "Ninguno de los videos tenía transcripción usable.", errors },
        { status: 422 }
      );
    }

    // Perfil de voz destilado del texto combinado (cap de seguridad).
    const corpusText = videos
      .map(
        (v) =>
          `# ${v.title ?? v.videoId}\n${v.segments.map((s) => s.text).join(" ")}`
      )
      .join("\n\n")
      .slice(0, 120000);

    let voiceProfile = "";
    try {
      voiceProfile = await distillVoiceProfile(corpusText);
    } catch {
      voiceProfile = "";
    }

    return NextResponse.json({ videos, voiceProfile, errors });
  } catch (e) {
    return NextResponse.json(
      { error: "Error procesando los links.", message: String((e as Error)?.message ?? e) },
      { status: 500 }
    );
  }
}
