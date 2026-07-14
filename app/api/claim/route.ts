import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Sin sesión." }, { status: 401 });

  const { anonId } = (await req.json().catch(() => ({}))) as { anonId?: string };
  const admin = createAdminClient();
  const email = user.email;

  // 1) lo comprado desde ESTE dispositivo → user_id
  if (typeof anonId === "string" && anonId.length >= 24) {
    await admin.from("entitlements").update({ user_id: user.id }).eq("anon_id", anonId).is("user_id", null);
    await admin.from("play_sessions").update({ user_id: user.id }).eq("anon_id", anonId).is("user_id", null);
  }
  // 2) lo comprado con este email desde CUALQUIER dispositivo → user_id
  // (puede chocar con entitlements_user_uq si el mismo user ya tiene esa experiencia
  // por el merge de anon_id de arriba; en ese caso ya tiene el acceso, se ignora)
  const { error: emailClaimError } = await admin
    .from("entitlements")
    .update({ user_id: user.id })
    .eq("grant_email", email)
    .is("user_id", null);
  if (emailClaimError && emailClaimError.code !== "23505") {
    return NextResponse.json({ error: "No pudimos unir tus compras." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
