import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateExperienceDraft, slugify } from "@/lib/engine/generate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  // asegura author
  await sb
    .from("authors")
    .upsert(
      { id: user.id, display_name: user.email?.split("@")[0] ?? "Autor" },
      { onConflict: "id", ignoreDuplicates: true }
    );

  const body = (await req.json()) as {
    title?: string;
    story?: string;
    stepCount?: number;
    city?: string;
  };
  const title = (body.title ?? "").trim();
  const story = (body.story ?? "").trim();
  const stepCount = Math.min(Math.max(2, Number(body.stepCount ?? 6)), 30);
  if (!title || story.length < 20) {
    return NextResponse.json(
      { error: "Pon un título y un relato (al menos un par de frases)." },
      { status: 400 }
    );
  }

  let draft;
  try {
    draft = await generateExperienceDraft({ title, story, stepCount, city: body.city });
  } catch {
    return NextResponse.json({ error: "El generador se trabó. Inténtalo de nuevo." }, { status: 502 });
  }

  const slug = `${slugify(draft.slug || title)}-${crypto.randomUUID().slice(0, 4)}`;

  const { data: exp, error: expErr } = await sb
    .from("experiences")
    .insert({
      author_id: user.id,
      slug,
      title,
      city: draft.city || body.city || null,
      pitch: draft.pitch || null,
      status: "draft",
      price_cents: 0,
      language: "es",
      generated_from: story.slice(0, 4000),
    })
    .select("id")
    .single();
  if (expErr || !exp) {
    return NextResponse.json({ error: "No se pudo crear la experiencia." }, { status: 500 });
  }

  await sb
    .from("content_sources")
    .insert({ experience_id: exp.id, inline_text: story, ingest_status: "ready" });

  const stepsRows = draft.steps.map((s, i) => {
    const isArrival = s.type === "arrival";
    return {
      experience_id: exp.id,
      position: i + 1,
      type: s.type,
      title: s.title ?? null,
      body: s.body ?? null,
      proposal: isArrival ? s.proposal ?? null : null,
      walk_to_next: isArrival ? s.walk_to_next ?? null : null,
      // arrival_needs_place: garantizamos place_query
      place_query: isArrival ? s.place_query || s.title || "Nueva York" : null,
      address: isArrival ? s.address ?? null : null,
    };
  });
  const { error: stepsErr } = await sb.from("steps").insert(stepsRows);
  if (stepsErr) {
    // limpiar el borrador a medias
    await sb.from("experiences").delete().eq("id", exp.id);
    return NextResponse.json({ error: "No se pudieron crear los pasos." }, { status: 500 });
  }

  return NextResponse.json({ id: exp.id, slug });
}
