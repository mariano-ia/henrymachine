// Ingesta del dossier de Henry: transcripciones de YouTube → Gemini destila
// {bio, voice} → voice_profiles (fila global) que el motor inyecta en cada turno.
// Correr: node --env-file=.env.local scripts/ingest-persona.mjs <url1> <url2> ...

import { YoutubeTranscript } from "youtube-transcript";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function parseVideoId(input) {
  try {
    const url = new URL(input.trim());
    if (url.hostname === "youtu.be") return url.pathname.slice(1) || null;
    if (url.hostname.replace(/^www\./, "").endsWith("youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      const parts = url.pathname.split("/").filter(Boolean);
      if (["shorts", "embed", "v"].includes(parts[0])) return parts[1] || null;
    }
    return null;
  } catch {
    return /^[\w-]{11}$/.test(input.trim()) ? input.trim() : null;
  }
}

async function fetchTitle(url) {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    return r.ok ? (await r.json()).title : undefined;
  } catch {
    return undefined;
  }
}

function decodeEntities(s) {
  return s
    .replace(/&amp;#39;|&#39;/g, "'")
    .replace(/&amp;quot;|&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchTranscript(videoId) {
  let items;
  try {
    items = await YoutubeTranscript.fetchTranscript(videoId, { lang: "es" });
  } catch {
    items = await YoutubeTranscript.fetchTranscript(videoId);
  }
  return items
    .map((it) => decodeEntities(String(it.text ?? "")).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
}

/** Fallback sin subtítulos: Gemini "mira" el video de YouTube directo. */
async function transcribeWithGemini(url) {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { fileData: { fileUri: url } },
          {
            text: "Transcribí TODO lo que dice el presentador de este video, en su idioma original, como texto corrido. Sin timestamps, sin descripciones de escena: solo sus palabras.",
          },
        ],
      },
    ],
    config: { temperature: 0.1, maxOutputTokens: 60000, thinkingConfig: { thinkingBudget: 0 } },
  });
  return (res.text ?? "").trim();
}

const VOICE_PROMPT = `Sos un analista de estilo. Vas a recibir transcripciones de videos de un creador (Henry, un YouTuber peruano afincado en New York que recorre y muestra ciudades del mundo).

Escribí un PERFIL DE VOZ en español, en 1 o 2 párrafos (máximo 180 palabras). Describí CÓMO habla, no de qué habla:
- tono y actitud (cercano, entusiasta, etc.)
- nivel de formalidad y cómo se dirige a la audiencia
- muletillas, conectores y expresiones típicas: citá ENTRE 5 Y 10 palabras/frases reales, ni una más
- humor y ritmo

Es peruano, así que mencioná su registro, pero sin exagerar: describí su forma natural de hablar, no una caricatura. No resumas el contenido de los videos. El objetivo es que otro modelo pueda IMITAR su forma de hablar leyendo este perfil.`;

const BIO_PROMPT = `Vas a recibir transcripciones de videos de Henry, un YouTuber peruano afincado en New York. Escribí su DOSSIER PERSONAL en español, dirigido a él en segunda persona ("Naciste en...", "Tu esposa..."), para que un modelo que lo interpreta responda preguntas personales con SU verdad.

REGLA DE ORO: SOLO hechos que aparezcan explícitos en las transcripciones. Si un dato no aparece (nombres, fechas, lugares), NO lo pongas ni lo deduzcas. Nada inventado: este texto es la fuente de verdad sobre una persona real.

Estructurá así (omití secciones sin datos):
- TU HISTORIA: de dónde sos, qué hacías antes, cómo y por qué llegaste a New York.
- TU FAMILIA Y VIDA PERSONAL: pareja/esposa, hijos, familia — solo lo que él mismo cuenta.
- EL CANAL: cómo empezó, de qué se trata, hitos que menciona.
- TRABAJOS Y OFICIOS: en qué trabajaste/trabajás según contás.
- GUSTOS Y OPINIONES RECURRENTES: comidas, lugares, equipos, manías que repite.
- ANÉCDOTAS QUE CONTÁS SEGUIDO: 3-6 historias cortas que usa en sus videos.

Máximo ~500 palabras. Texto plano, sin markdown pesado (guiones simples está bien).`;

const links = process.argv.slice(2);
if (links.length === 0) {
  console.error("Uso: node scripts/ingest-persona.mjs <url1> <url2> ...");
  process.exit(1);
}

console.log(`Ingesta de ${links.length} videos…\n`);
const videos = [];
for (const url of links) {
  const id = parseVideoId(url);
  if (!id) {
    console.log(`✗ link inválido: ${url}`);
    continue;
  }
  const title = (await fetchTitle(url)) ?? id;
  try {
    const text = await fetchTranscript(id);
    videos.push({ title, text, via: "subtítulos" });
    console.log(`✓ ${title} (${text.length} chars, subtítulos)`);
  } catch {
    try {
      process.stdout.write(`… ${title}: sin subtítulos, transcribiendo con Gemini`);
      const text = await transcribeWithGemini(`https://www.youtube.com/watch?v=${id}`);
      if (!text) throw new Error("vacío");
      videos.push({ title, text, via: "gemini" });
      console.log(` → ✓ (${text.length} chars)`);
    } catch (e) {
      console.log(` → ✗ falló (${e.message})`);
    }
  }
}

if (videos.length === 0) {
  console.error("\nNo se pudo transcribir ningún video.");
  process.exit(1);
}

const corpus = videos.map((v, i) => `### VIDEO ${i + 1} — "${v.title}"\n${v.text}`).join("\n\n");
console.log(`\nCorpus: ${videos.length} videos, ${corpus.length} chars (~${Math.round(corpus.length / 4 / 1000)}k tokens)`);

async function distill(system, maxTokens) {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: corpus,
    config: {
      systemInstruction: system,
      temperature: 0.6,
      // thinking habilitado (sin thinkingBudget:0): evita loops de repetición
      maxOutputTokens: maxTokens,
    },
  });
  return (res.text ?? "").trim();
}

console.log("\nDestilando perfil de voz…");
const voice = await distill(VOICE_PROMPT, 4000);
console.log("Destilando biografía…");
const bio = await distill(BIO_PROMPT, 6000);

// upsert de la fila global
const { data: existing } = await sb.from("voice_profiles").select("id").eq("is_global", true).limit(1).maybeSingle();
const profile = {
  bio,
  voice,
  sources: videos.map((v) => ({ title: v.title, via: v.via })),
  ingested_at: new Date().toISOString(),
};
if (existing) {
  const { error } = await sb.from("voice_profiles").update({ profile, name: "henry" }).eq("id", existing.id);
  if (error) throw error;
  console.log(`\n✓ voice_profiles actualizado (${existing.id})`);
} else {
  const { error } = await sb.from("voice_profiles").insert({ name: "henry", is_global: true, profile });
  if (error) throw error;
  console.log("\n✓ voice_profiles creado (global)");
}

console.log("\n=== PERFIL DE VOZ ===\n" + voice);
console.log("\n=== BIO ===\n" + bio);
