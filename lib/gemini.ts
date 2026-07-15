import { GoogleGenAI } from "@google/genai";
import type { ChatTurn, ChatResponse } from "./types";
import { VOICE_DISTILL_PROMPT, PERSONA_EXTRACT_PROMPT, PERSONA_SYNTHESIZE_PROMPT } from "./persona";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
// "thinking" solo existe en los modelos 2.5; en 2.0 pasar thinkingConfig falla.
const THINKING = /2\.5/.test(MODEL) ? { thinkingConfig: { thinkingBudget: 0 } } : {};

function client(key?: string): GoogleGenAI {
  const apiKey = key ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY en el entorno.");
  return new GoogleGenAI({ apiKey });
}

/** Reintenta ante errores transitorios (429 / 5xx / red), con backoff exponencial. */
async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = String((e as Error)?.message ?? e);
      const retriable =
        /429|RESOURCE_EXHAUSTED|UNAVAILABLE|INTERNAL|50\d|deadline|timeout|fetch failed|ECONN|network/i.test(
          msg
        );
      if (!retriable || i === tries - 1) break;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw lastErr;
}

const QUOTA_RE = /429|RESOURCE_EXHAUSTED|quota|billing|prepa|exhaust/i;

/** Corre con la key primaria; si se agotó cuota/crédito y existe
 *  GEMINI_API_KEY_FALLBACK, reintenta con la key de respaldo. */
async function withFailover<T>(fn: (ai: GoogleGenAI) => Promise<T>): Promise<T> {
  try {
    return await withRetry(() => fn(client()));
  } catch (e) {
    const fb = process.env.GEMINI_API_KEY_FALLBACK;
    if (fb && QUOTA_RE.test(String((e as Error)?.message ?? e))) {
      return await withRetry(() => fn(client(fb)));
    }
    throw e;
  }
}

/** Destila un perfil de voz a partir del texto combinado de las transcripciones. */
export async function distillVoiceProfile(corpusText: string): Promise<string> {
  const res = await withFailover((ai) =>
    ai.models.generateContent({
      model: MODEL,
      contents: corpusText,
      config: {
        systemInstruction: VOICE_DISTILL_PROMPT,
        temperature: 0.4,
        maxOutputTokens: 800,
        ...THINKING,
      },
    })
  );
  return (res.text ?? "").trim();
}

/** Fuente multimodal para extraer notas de personalidad. */
export type PersonaSourceInput =
  | { kind: "youtube"; url: string }
  | { kind: "text"; text: string }
  | { kind: "file"; bytes: Blob; mimeType: string; displayName?: string };

const EXTRACT_CFG = { temperature: 0.4, maxOutputTokens: 700, ...THINKING };
const NUDGE = "Analiza esta fuente y extrae las notas de personalidad de Henry.";

/**
 * Extrae NOTAS de personalidad de UNA fuente (video/audio/pdf/imagen/youtube/texto).
 * Para archivos usa el File API de Gemini (sube + espera ACTIVE) con la misma key
 * que después genera, para que el archivo sea accesible.
 */
export async function extractPersonaNotes(input: PersonaSourceInput): Promise<string> {
  if (input.kind === "text") {
    const res = await withFailover((ai) =>
      ai.models.generateContent({
        model: MODEL,
        contents: input.text.slice(0, 100000),
        config: { systemInstruction: PERSONA_EXTRACT_PROMPT, ...EXTRACT_CFG },
      })
    );
    return (res.text ?? "").trim();
  }
  if (input.kind === "youtube") {
    const res = await withFailover((ai) =>
      ai.models.generateContent({
        model: MODEL,
        contents: [{ fileData: { fileUri: input.url } }, { text: NUDGE }],
        config: { systemInstruction: PERSONA_EXTRACT_PROMPT, ...EXTRACT_CFG },
      })
    );
    return (res.text ?? "").trim();
  }
  // archivo: subir al File API → esperar ACTIVE → generar (todo con la misma key)
  return await withFailover(async (ai) => {
    const uploaded = await ai.files.upload({
      file: input.bytes,
      config: { mimeType: input.mimeType, displayName: input.displayName },
    });
    let f = uploaded;
    const name = f.name!;
    for (let i = 0; i < 80 && f.state !== "ACTIVE"; i++) {
      if (f.state === "FAILED") throw new Error("Gemini no pudo procesar el archivo.");
      await new Promise((r) => setTimeout(r, 3000));
      f = await ai.files.get({ name });
    }
    if (f.state !== "ACTIVE") throw new Error("El archivo tardó demasiado en procesarse.");
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: [{ fileData: { fileUri: f.uri!, mimeType: f.mimeType ?? input.mimeType } }, { text: NUDGE }],
      config: { systemInstruction: PERSONA_EXTRACT_PROMPT, ...EXTRACT_CFG },
    });
    return (res.text ?? "").trim();
  });
}

/** Sintetiza el dossier {bio, voice} juntando las notas de TODAS las fuentes. */
export async function synthesizePersonaDossier(
  notesList: string[]
): Promise<{ bio: string; voice: string }> {
  const corpus = notesList
    .filter(Boolean)
    .map((n, i) => `## Fuente ${i + 1}\n${n}`)
    .join("\n\n")
    .slice(0, 100000);
  const res = await withFailover((ai) =>
    ai.models.generateContent({
      model: MODEL,
      contents: corpus || "(sin fuentes)",
      config: {
        systemInstruction: PERSONA_SYNTHESIZE_PROMPT,
        temperature: 0.5,
        maxOutputTokens: 1400,
        responseMimeType: "application/json",
        ...THINKING,
      },
    })
  );
  try {
    const j = JSON.parse((res.text ?? "{}").trim()) as { bio?: string; voice?: string };
    return { bio: String(j.bio ?? "").trim(), voice: String(j.voice ?? "").trim() };
  } catch {
    return { bio: "", voice: (res.text ?? "").trim() };
  }
}

/** Una respuesta de Henry, groundeada en los videos (system instruction). */
export async function chatWithHenry(params: {
  systemInstruction: string;
  history: ChatTurn[];
  message: string;
}): Promise<ChatResponse> {

  const contents = [
    ...params.history.map(
      (t): { role: "user" | "model"; parts: { text: string }[] } => ({
        role: t.role === "henry" ? "model" : "user",
        parts: [{ text: t.text }],
      })
    ),
    { role: "user" as const, parts: [{ text: params.message }] },
  ];

  const res = await withFailover((ai) =>
    ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: params.systemInstruction,
        temperature: 0.85,
        maxOutputTokens: 1100,
        ...THINKING,
      },
    })
  );

  const text = (res.text ?? "").trim();
  return {
    reply: text || "Perdón, se me cruzaron los cables 😅 Pregúntame de nuevo.",
  };
}

/** Generación estructurada (JSON) — para el generador de experiencias. */
export async function generateJson<T = unknown>(
  systemInstruction: string,
  prompt: string,
  maxOutputTokens = 6000
): Promise<T> {
  const res = await withFailover((ai) =>
    ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens,
        responseMimeType: "application/json",
        ...THINKING,
      },
    })
  );
  const text = (res.text ?? "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(text) as T;
}

export type TourUsage = { prompt: number | null; output: number | null };

/** Turno de recorrido: respuesta de Henry + intención + tokens (para costo por sesión). */
export async function tourReply(params: {
  systemInstruction: string;
  history: ChatTurn[];
  message: string;
}): Promise<{ reply: string; intent: string; usage: TourUsage }> {
  const contents = [
    ...params.history.map(
      (t): { role: "user" | "model"; parts: { text: string }[] } => ({
        role: t.role === "henry" ? "model" : "user",
        parts: [{ text: t.text }],
      })
    ),
    { role: "user" as const, parts: [{ text: params.message }] },
  ];

  const res = await withFailover((ai) =>
    ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: params.systemInstruction,
        temperature: 0.85,
        maxOutputTokens: 1100,
        responseMimeType: "application/json",
        ...THINKING,
      },
    })
  );

  const usage: TourUsage = {
    prompt: res.usageMetadata?.promptTokenCount ?? null,
    output: res.usageMetadata?.candidatesTokenCount ?? null,
  };
  const text = (res.text ?? "").trim();
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const o = JSON.parse(cleaned) as { reply?: unknown; intent?: unknown };
    return {
      reply:
        typeof o.reply === "string" && o.reply.trim()
          ? o.reply
          : "Perdón, se me cruzaron los cables 😅 inténtalo de nuevo.",
      intent: typeof o.intent === "string" ? o.intent : "none",
      usage,
    };
  } catch {
    // JSON malformado: rescatar reply/intent por regex; NUNCA mostrar llaves crudas
    const replyMatch = cleaned.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const intentMatch = cleaned.match(/"?intent"?\s*:\s*"(\w+)"/);
    if (replyMatch) {
      let reply = replyMatch[1];
      try {
        reply = JSON.parse(`"${replyMatch[1]}"`) as string; // desescapar \n, \" etc.
      } catch {
        /* usar tal cual */
      }
      return { reply, intent: intentMatch?.[1] ?? "none", usage };
    }
    const looksJson = cleaned.startsWith("{") || cleaned.includes('"reply"');
    return {
      reply: looksJson || !text ? "Perdón, se me trabó 😅 inténtalo de nuevo." : text,
      intent: "none",
      usage,
    };
  }
}
