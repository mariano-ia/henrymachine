import { generateJson } from "@/lib/gemini";

export type DraftStep = {
  type: "message" | "arrival";
  title?: string;
  body?: string;
  proposal?: string;
  walk_to_next?: string;
  place_query?: string;
  address?: string | null;
};

export type ExperienceDraft = {
  slug: string;
  pitch: string;
  city: string;
  steps: DraftStep[];
};

const SYSTEM = `Eres un asistente que arma EXPERIENCIAS de recorrido físico narradas por Henry, un YouTuber peruano afincado en Nueva York. El autor te da un relato en lenguaje natural y una cantidad de paradas; tú devuelves un BORRADOR estructurado de la experiencia.

ESTRUCTURA: una experiencia es una secuencia ORDENADA de PASOS:
- El PRIMER paso es 'message' (APERTURA): Henry da la bienvenida y arranca el recorrido.
- Luego N pasos 'arrival' (las paradas físicas; N ≈ la cantidad pedida).
- El ÚLTIMO paso es 'message' (CIERRE): Henry se despide.

VOZ DE HENRY: peruano natural, cercano, entusiasta, tuteo (tú/tienes), sin exagerar modismos ni caricatura. Mensajes de chat, cortos, sin markdown.

POR CADA PASO 'arrival':
- title: el nombre del lugar.
- proposal: qué cuenta o propone Henry en esa parada, en SU voz (1-3 frases).
- walk_to_next: cómo seguir a la próxima parada, si se infiere del relato (si no, déjalo vacío).
- place_query: el nombre del lugar para buscar en Google Maps.
- address: la dirección SOLO si está explícita en el relato; si no, null. NUNCA inventes direcciones.

POR CADA PASO 'message' (apertura/cierre): title corto + body en la voz de Henry.

SALIDA: devuelve EXCLUSIVAMENTE un JSON válido con esta forma:
{"slug":"kebab-case-corto","pitch":"una línea vendedora","city":"Ciudad","steps":[
  {"type":"message","title":"Bienvenida","body":"..."},
  {"type":"arrival","title":"...","proposal":"...","walk_to_next":"...","place_query":"...","address":null},
  {"type":"message","title":"Cierre","body":"..."}
]}`;

export async function generateExperienceDraft(opts: {
  title: string;
  story: string;
  stepCount: number;
  city?: string;
}): Promise<ExperienceDraft> {
  const prompt = `TÍTULO: ${opts.title}
CIUDAD: ${opts.city?.trim() || "(inferir del relato)"}
CANTIDAD DE PARADAS OBJETIVO: ${opts.stepCount}

RELATO DEL AUTOR:
${opts.story}`;

  const draft = await generateJson<ExperienceDraft>(SYSTEM, prompt);

  // saneamiento defensivo
  const steps = Array.isArray(draft.steps) ? draft.steps : [];
  return {
    slug: slugify(draft.slug || opts.title),
    pitch: (draft.pitch || "").slice(0, 280),
    city: draft.city || opts.city || "",
    steps: steps.map((s) => ({
      type: s.type === "arrival" ? "arrival" : "message",
      title: s.title?.slice(0, 140),
      body: s.body ?? undefined,
      proposal: s.proposal ?? undefined,
      walk_to_next: s.walk_to_next ?? undefined,
      place_query: s.place_query ?? undefined,
      address: s.address ?? null,
    })),
  };
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "experiencia";
}
