import { GoogleGenAI } from "@google/genai";
import type { ChatTurn, ChatResponse } from "./types";
import { VOICE_DISTILL_PROMPT } from "./persona";

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
          : "Perdón, se me cruzaron los cables 😅 dale de nuevo.",
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
      reply: looksJson || !text ? "Perdón, se me trabó 😅 dale de nuevo." : text,
      intent: "none",
      usage,
    };
  }
}
