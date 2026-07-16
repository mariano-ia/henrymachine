import "server-only";
import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/lib/supabase/admin";

/** Un insight accionable del análisis. `target` define a dónde linkea el admin. */
export type InsightItem = {
  tipo: string; // fricción | abandono | pregunta_recurrente | conversión | producto
  hallazgo: string; // 1 frase
  evidencia: string; // números / ejemplos reales
  accionable: string; // qué hacer
  target: "guia_util" | "experiencia" | "general";
  slug?: string; // slug real de la experiencia si target = experiencia
};

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function genai(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_FALLBACK;
  if (!key) throw new Error("GEMINI_API_KEY no configurada");
  return new GoogleGenAI({ apiKey: key });
}

/** Cuántas jugadas TERMINARON desde `sinceTs` (para el disparo automático). */
export async function countFinishedSince(sinceTs: string): Promise<number> {
  const { count } = await createAdminClient()
    .from("play_sessions")
    .select("*", { count: "exact", head: true })
    .eq("status", "TERMINADO")
    .gte("created_at", sinceTs);
  return count ?? 0;
}

/** Timestamp del último análisis (o null si no hubo). */
export async function lastAnalysisTs(): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("insights")
    .select("window_to")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.window_to ?? null;
}

/** Borra mensajes de usuario más viejos que `days` (retención de privacidad). */
export async function purgeOldUserMessages(days = 90): Promise<void> {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  await createAdminClient()
    .from("session_messages")
    .delete()
    .eq("role", "user")
    .lt("created_at", cutoff);
}

async function gather(sinceTs: string) {
  const sb = createAdminClient();

  const { data: exps } = await sb
    .from("experiences")
    .select("id, slug, title")
    .eq("status", "published");
  const expById = new Map((exps ?? []).map((e) => [e.id, e]));

  // sesiones de la ventana
  const { data: sessions } = await sb
    .from("play_sessions")
    .select("experience_id, status, current_step_position, total_turns")
    .gte("created_at", sinceTs)
    .limit(5000);

  // agregado por experiencia: iniciadas / terminadas / abandono por paso
  const perExp: Record<string, { title: string; started: number; finished: number; dropSteps: Record<number, number> }> = {};
  for (const s of sessions ?? []) {
    const e = expById.get(s.experience_id);
    const key = e?.slug ?? s.experience_id;
    perExp[key] ??= { title: e?.title ?? key, started: 0, finished: 0, dropSteps: {} };
    perExp[key].started++;
    if (s.status === "TERMINADO") perExp[key].finished++;
    else {
      const p = s.current_step_position ?? 1;
      perExp[key].dropSteps[p] = (perExp[key].dropSteps[p] ?? 0) + 1;
    }
  }

  // embudo (events)
  const eventNames = ["view_home", "view_detail", "open_chat", "begin_checkout", "finish_tour"];
  const funnel: Record<string, number> = {};
  for (const n of eventNames) {
    const { count } = await sb
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("name", n)
      .gte("created_at", sinceTs);
    funnel[n] = count ?? 0;
  }

  // muestra de mensajes del usuario (para temas recurrentes)
  const { data: msgs } = await sb
    .from("session_messages")
    .select("text, step_position")
    .eq("role", "user")
    .gte("created_at", sinceTs)
    .order("created_at", { ascending: false })
    .limit(400);

  return {
    slugs: (exps ?? []).map((e) => e.slug),
    perExp,
    funnel,
    messages: (msgs ?? []).map((m) => `(paso ${m.step_position ?? "?"}) ${m.text}`),
    playsAnalyzed: (sessions ?? []).length,
  };
}

const SYSTEM = `Sos un analista de producto para "La Nueva York de Henry" (micro-recorridos a pie por NYC guiados por chat). Te paso datos agregados de las jugadas y una muestra de mensajes reales de los usuarios. Tu trabajo: encontrar INSIGHTS accionables para mejorar el producto.

Reglas:
- Basate SOLO en los datos que te paso. Citá números y ejemplos reales en la evidencia. Nada inventado.
- Priorizá lo accionable: dónde se traban, dónde abandonan, qué preguntan seguido (baños, wifi, cómo llegar, confusión), qué convierte, qué piden que no existe.
- Devolvé entre 3 y 8 insights, del más importante al menos. Si no hay datos suficientes para algo, no lo fuerces.
- Para cada insight, "target" indica a dónde llevar al admin a arreglarlo:
  - "guia_util": necesidades recurrentes globales (baños, wifi, agua, transporte) → van a la Guía útil.
  - "experiencia": problema de un recorrido puntual → poné su "slug" REAL (de la lista que te paso).
  - "general": todo lo demás.
- Español, directo, para el dueño (Mariano). El "accionable" tiene que ser una acción concreta.

Devolvé SOLO JSON con esta forma:
{ "summary": "1-2 frases con lo más importante", "items": [ { "tipo": "...", "hallazgo": "...", "evidencia": "...", "accionable": "...", "target": "guia_util|experiencia|general", "slug": "opcional" } ] }`;

async function analyze(data: Awaited<ReturnType<typeof gather>>): Promise<{ summary: string; items: InsightItem[] }> {
  const prompt = `SLUGS REALES DE EXPERIENCIAS: ${JSON.stringify(data.slugs)}

EMBUDO (conteos de la ventana): ${JSON.stringify(data.funnel)}

POR EXPERIENCIA (iniciadas / terminadas / abandono por paso): ${JSON.stringify(data.perExp)}

MENSAJES DE USUARIOS (muestra reciente, con el paso donde lo escribieron):
${data.messages.join("\n")}`;

  const res = await genai().models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM,
      temperature: 0.4,
      maxOutputTokens: 4000,
      responseMimeType: "application/json",
    },
  });
  const raw = (res.text ?? "").trim();
  let parsed: { summary?: string; items?: InsightItem[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    // rescate: recortar al primer { y último }
    const s = raw.indexOf("{");
    const e = raw.lastIndexOf("}");
    parsed = s >= 0 && e > s ? JSON.parse(raw.slice(s, e + 1)) : { summary: "", items: [] };
  }
  const validTargets = new Set(["guia_util", "experiencia", "general"]);
  const items = (parsed.items ?? [])
    .filter((it) => it && it.hallazgo && it.accionable)
    .map((it) => ({
      tipo: String(it.tipo ?? "general"),
      hallazgo: String(it.hallazgo),
      evidencia: String(it.evidencia ?? ""),
      accionable: String(it.accionable),
      target: (validTargets.has(it.target) ? it.target : "general") as InsightItem["target"],
      // slug solo si es real
      slug: it.slug && data.slugs.includes(it.slug) ? it.slug : undefined,
    }));
  return { summary: String(parsed.summary ?? ""), items };
}

/** Corre el análisis completo y guarda una fila en `insights`. Devuelve su id. */
export async function runInsights(kind: "auto" | "manual"): Promise<string | null> {
  const sb = createAdminClient();
  const sinceTs = (await lastAnalysisTs()) ?? new Date(Date.now() - 30 * 86400000).toISOString();
  const windowTo = new Date().toISOString();

  const data = await gather(sinceTs);
  const { summary, items } = await analyze(data);

  const { data: row } = await sb
    .from("insights")
    .insert({
      kind,
      plays_analyzed: data.playsAnalyzed,
      window_from: sinceTs,
      window_to: windowTo,
      summary,
      items,
    })
    .select("id")
    .single();
  return row?.id ?? null;
}
