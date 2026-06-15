import type { VideoTranscript } from "./types";
import v1 from "@/data/transcripts/YoQ062ljML0.json";
import v2 from "@/data/transcripts/TnoYCZVcFJE.json";

/**
 * Transcripciones pre-cacheadas. YouTube bloquea el fetch de subtítulos desde
 * las IPs de cloud (Vercel), así que para los videos del demo embebemos la
 * transcripción (bajada localmente) y la servimos sin depender del fetch en vivo.
 */
const CACHE: Record<string, VideoTranscript> = {
  YoQ062ljML0: v1 as unknown as VideoTranscript,
  TnoYCZVcFJE: v2 as unknown as VideoTranscript,
};

export function getCachedTranscript(videoId: string): VideoTranscript | null {
  return CACHE[videoId] ?? null;
}
