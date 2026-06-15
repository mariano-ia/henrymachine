export type TranscriptSegment = { text: string; startSec: number };

export type VideoTranscript = {
  videoId: string;
  url: string;
  title?: string;
  segments: TranscriptSegment[];
};

export type VideoMeta = { videoId: string; url: string; title?: string };

export type ChatTurn = { role: "user" | "henry"; text: string };

export type Clip = { videoId: string; startSec: number; label: string };

export type ChatResponse = { reply: string; clip?: Clip };

// Lo que el cliente recibe del ingest y sostiene en memoria para el chat.
export type IngestResult = { videos: VideoTranscript[]; voiceProfile: string };
