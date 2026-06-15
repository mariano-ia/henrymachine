import { YoutubeTranscript } from "youtube-transcript";
import type { TranscriptSegment } from "./types";

/**
 * Baja la transcripción de un video de YouTube y la normaliza a
 * { text, startSec }. Intenta español primero, luego el default.
 * `offset` de la librería puede venir en seg o ms según el caso: lo normalizamos.
 */
export async function fetchTranscriptSegments(
  videoIdOrUrl: string
): Promise<TranscriptSegment[]> {
  let items: Array<{ text: string; offset?: number; duration?: number }> = [];

  try {
    items = await YoutubeTranscript.fetchTranscript(videoIdOrUrl, { lang: "es" });
  } catch {
    items = await YoutubeTranscript.fetchTranscript(videoIdOrUrl);
  }

  return items
    .map((it) => {
      // youtube-transcript devuelve `offset` en milisegundos.
      const startSec = Math.round(Number(it.offset ?? 0) / 1000);
      const text = decodeEntities(String(it.text ?? ""))
        .replace(/\s+/g, " ")
        .trim();
      return { text, startSec };
    })
    .filter((s) => s.text.length > 0);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;#39;|&#39;/g, "'")
    .replace(/&amp;quot;|&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
