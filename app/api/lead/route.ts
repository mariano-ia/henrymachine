import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { sendTourLinkEmail } from "@/lib/email";

export const runtime = "nodejs";

/** Captura de email de gente que todavía no compró ("avisame del próximo recorrido"). */
export async function POST(req: NextRequest) {
  const ok = await rateLimit(req, "lead", null, 3600, 20);
  if (!ok) return NextResponse.json({ ok: false }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    source?: string;
    slug?: string;
  };
  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Email inválido." }, { status: 400 });
  }

  try {
    await createAdminClient()
      .from("leads")
      .upsert(
        {
          email,
          source: typeof body.source === "string" ? body.source.slice(0, 40) : null,
          slug: typeof body.slug === "string" ? body.slug.slice(0, 80) : null,
          marketing_consent: true,
        },
        { onConflict: "email", ignoreDuplicates: true }
      );
  } catch {
    /* no romper la UX por un lead */
  }

  // captura al arrancar → le mandamos el link para volver desde el correo.
  // Validamos que el slug sea una experiencia PUBLICADA y pasamos el slug canónico
  // de la DB: evita usar /api/lead como relay de correo con contenido arbitrario /
  // inyección de HTML vía un slug inventado.
  if (body.source === "player_start" && typeof body.slug === "string" && body.slug) {
    const { data: exp } = await createAdminClient()
      .from("experiences")
      .select("slug")
      .eq("slug", body.slug.slice(0, 80))
      .eq("status", "published")
      .maybeSingle();
    if (exp) await sendTourLinkEmail(email, exp.slug);
  }

  return NextResponse.json({ ok: true });
}
