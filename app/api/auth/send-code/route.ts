import { NextRequest, NextResponse } from "next/server";
import { createHash, randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendLoginCode } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const hash = (code: string, email: string) =>
  createHash("sha256").update(`${code}:${email}`).digest("hex");

/** Genera un código de 6 dígitos, lo guarda hasheado y lo manda por email (Henry). */
export async function POST(req: NextRequest) {
  const ok = await rateLimit(req, "sendcode", null, 3600, 8);
  if (!ok) return NextResponse.json({ ok: false, error: "Demasiados intentos. Probá en un rato." }, { status: 429 });

  const { email: raw } = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (raw ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Email inválido." }, { status: 400 });
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const sb = createAdminClient();
  const { error } = await sb
    .from("login_codes")
    .upsert({ email, code_hash: hash(code, email), expires_at: expiresAt, attempts: 0 }, { onConflict: "email" });
  if (error) return NextResponse.json({ ok: false, error: "No se pudo generar el código." }, { status: 500 });

  const sent = await sendLoginCode(email, code);
  if (!sent) return NextResponse.json({ ok: false, error: "No se pudo enviar el email." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
