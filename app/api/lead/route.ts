import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

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
  return NextResponse.json({ ok: true });
}
