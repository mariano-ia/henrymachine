import type { VideoTranscript } from "./types";
import v1 from "@/data/transcripts/YoQ062ljML0.json";
import v2 from "@/data/transcripts/TnoYCZVcFJE.json";
import voice from "@/data/voice-profile.json";

/**
 * Sesión-demo fija: los 2 videos de Tokyo de Henry, ya ingeridos
 * (transcripciones pre-cacheadas + perfil de voz pre-destilado).
 * El demo abre directo en el chat con esto cargado — sin pantalla de pegar links.
 */
const VIDEOS: VideoTranscript[] = [
  v1 as unknown as VideoTranscript,
  v2 as unknown as VideoTranscript,
];

export function getDemoVideos(): VideoTranscript[] {
  return VIDEOS;
}

export function getDemoVoiceProfile(): string {
  return (voice as { voiceProfile: string }).voiceProfile ?? "";
}

export function getDemoVideoTitles(): string[] {
  return VIDEOS.map((v) => v.title).filter((t): t is string => Boolean(t));
}
