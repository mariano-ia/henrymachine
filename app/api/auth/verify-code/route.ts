import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const hash = (code: string, email: string) =>
  createHash("sha256").update(`${code}:${email}`).digest("hex");

/**
 * Verifica el código propio. Si es correcto, genera un token de sesión con
 * admin.generateLink (sin que Supabase mande email) y lo devuelve al cliente,
 * que establece la sesión con verifyOtp(token_hash).
 */
export async function POST(req: NextRequest) {
  const { email: raw, code: rawCode } = (await req.json().catch(() => ({}))) as {
    email?: string;
    code?: string;
  };
  const email = (raw ?? "").trim().toLowerCase();
  const code = (rawCode ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "Datos inválidos." }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data: row } = await sb
    .from("login_codes")
    .select("code_hash, expires_at, attempts")
    .eq("email", email)
    .maybeSingle();

  if (!row) return NextResponse.json({ ok: false, error: "Pide un código nuevo." }, { status: 400 });
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await sb.from("login_codes").delete().eq("email", email);
    return NextResponse.json({ ok: false, error: "El código venció. Pide uno nuevo." }, { status: 400 });
  }
  if (row.attempts >= 5) {
    await sb.from("login_codes").delete().eq("email", email);
    return NextResponse.json({ ok: false, error: "Demasiados intentos. Pide un código nuevo." }, { status: 429 });
  }
  if (row.code_hash !== hash(code, email)) {
    await sb.from("login_codes").update({ attempts: row.attempts + 1 }).eq("email", email);
    return NextResponse.json({ ok: false, error: "Código incorrecto." }, { status: 400 });
  }

  // código correcto → mintar sesión SIN email de Supabase
  const { data: link, error: linkErr } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !link?.properties?.hashed_token) {
    return NextResponse.json({ ok: false, error: "No se pudo iniciar sesión." }, { status: 500 });
  }
  await sb.from("login_codes").delete().eq("email", email);
  return NextResponse.json({ ok: true, tokenHash: link.properties.hashed_token });
}
