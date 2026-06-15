import { GoogleGenAI } from "@google/genai";
import type { ChatTurn, ChatResponse } from "./types";
import { VOICE_DISTILL_PROMPT } from "./persona";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
// "thinking" solo existe en los modelos 2.5; en 2.0 pasar thinkingConfig falla.
const THINKING = /2\.5/.test(MODEL) ? { thinkingConfig: { thinkingBudget: 0 } } : {};

function client(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
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

/** Destila un perfil de voz a partir del texto combinado de las transcripciones. */
export async function distillVoiceProfile(corpusText: string): Promise<string> {
  const ai = client();
  const res = await withRetry(() =>
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
  const ai = client();

  const contents = [
    ...params.history.map(
      (t): { role: "user" | "model"; parts: { text: string }[] } => ({
        role: t.role === "henry" ? "model" : "user",
        parts: [{ text: t.text }],
      })
    ),
    { role: "user" as const, parts: [{ text: params.message }] },
  ];

  const res = await withRetry(() =>
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

  const text = (res.text ?? "").trim();
  if (!text) {
    return { reply: "Perdón, se me cruzaron los cables 😅 Preguntame de nuevo." };
  }
  return parseChat(text);
}

function parseChat(text: string): ChatResponse {
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const o = JSON.parse(cleaned) as {
      reply?: unknown;
      clip?: { videoId?: unknown; startSec?: unknown; label?: unknown };
    };
    const reply = typeof o.reply === "string" ? o.reply : cleaned;
    let clip: ChatResponse["clip"];
    if (
      o.clip &&
      typeof o.clip.videoId === "string" &&
      o.clip.videoId.length > 0 &&
      typeof o.clip.startSec === "number" &&
      Number.isFinite(o.clip.startSec)
    ) {
      clip = {
        videoId: o.clip.videoId,
        startSec: Math.max(0, Math.floor(o.clip.startSec)),
        label:
          typeof o.clip.label === "string" && o.clip.label.trim()
            ? o.clip.label.trim()
            : "escuchá cómo lo cuenta",
      };
    }
    return { reply, clip };
  } catch {
    return { reply: text };
  }
}
