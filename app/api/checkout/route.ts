import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { slug?: string; anonId?: string };
  const slug = typeof body.slug === "string" ? body.slug : "";
  const anonId = typeof body.anonId === "string" ? body.anonId : "";
  if (!slug || anonId.length < 24) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data: exp } = await sb
    .from("experiences")
    .select("id, slug, title, price_cents, stripe_price_id, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!exp || exp.status !== "published" || exp.price_cents <= 0 || !exp.stripe_price_id) {
    return NextResponse.json({ error: "Esta experiencia no está a la venta." }, { status: 400 });
  }

  // purchase 'pending' (puente checkout→identidad antes del webhook)
  const { data: purchase } = await sb
    .from("purchases")
    .insert({
      experience_id: exp.id,
      anon_id: anonId,
      status: "pending",
      amount_cents: exp.price_cents,
      currency: "usd",
    })
    .select("id")
    .single();

  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://henry-demo-zeta.vercel.app";

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: exp.stripe_price_id, quantity: 1 }],
      client_reference_id: anonId,
      metadata: {
        experience_id: exp.id,
        anon_id: anonId,
        purchase_id: purchase?.id ?? "",
      },
      success_url: `${origin}/e/${slug}?purchased=1`,
      cancel_url: `${origin}/e/${slug}`,
    });
    if (purchase) {
      await sb
        .from("purchases")
        .update({ stripe_checkout_session_id: session.id })
        .eq("id", purchase.id);
    }
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "No se pudo iniciar el pago." }, { status: 502 });
  }
}
