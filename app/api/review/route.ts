import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Reseña dejada al terminar el recorrido. Se crea 'pending' (se modera en el admin). */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    slug?: string;
    anonId?: string;
    rating?: number;
    body?: string;
    authorName?: string;
  };
  const slug = typeof body.slug === "string" ? body.slug : "";
  const anonId = typeof body.anonId === "string" ? body.anonId : "";
  const rating = Math.round(Number(body.rating));
  if (!slug || anonId.length < 24 || !(rating >= 1 && rating <= 5)) {
    return NextResponse.json({ ok: false, error: "Datos inválidos." }, { status: 400 });
  }

  const ok = await rateLimit(req, "review", anonId, 3600, 5);
  if (!ok) return NextResponse.json({ ok: false }, { status: 429 });

  const sb = createAdminClient();
  const { data: exp } = await sb
    .from("experiences")
    .select("id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!exp) return NextResponse.json({ ok: false, error: "No disponible." }, { status: 404 });

  // ¿compra verificada? (entitlement activo de este anon)
  const { data: ent } = await sb
    .from("entitlements")
    .select("id")
    .eq("experience_id", exp.id)
    .eq("anon_id", anonId)
    .is("revoked_at", null)
    .maybeSingle();

  // país: de la sesión de este anon, o del header de IP
  const { data: sess } = await sb
    .from("play_sessions")
    .select("country")
    .eq("experience_id", exp.id)
    .eq("anon_id", anonId)
    .order("last_active_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const country = sess?.country || req.headers.get("x-vercel-ip-country") || null;

  const { error } = await sb.from("reviews").insert({
    experience_id: exp.id,
    rating,
    body: typeof body.body === "string" ? body.body.trim().slice(0, 600) || null : null,
    author_name: typeof body.authorName === "string" ? body.authorName.trim().slice(0, 60) || null : null,
    country,
    anon_id: anonId,
    verified_purchase: !!ent,
    status: "pending",
  });
  // 23505 = ya dejó una reseña para esta experiencia desde este dispositivo
  if (error && error.code !== "23505") {
    return NextResponse.json({ ok: false, error: "No se pudo guardar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
