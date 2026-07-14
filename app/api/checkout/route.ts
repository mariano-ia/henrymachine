import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { rateLimit } from "@/lib/rate-limit";
import { resolvePromotionCode } from "@/lib/stripe-coupons";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    slug?: string;
    anonId?: string;
    utm?: Record<string, string>;
    promo?: string | null;
    gift?: boolean;
    recipientEmail?: string;
    giftMessage?: string;
  };
  const slug = typeof body.slug === "string" ? body.slug : "";
  const anonId = typeof body.anonId === "string" ? body.anonId : "";
  const utm = (body as { utm?: Record<string, string> }).utm ?? {};
  if (!slug || anonId.length < 24) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  // modo regalo: el acceso va al email del regalado, no al comprador
  const isGift = body.gift === true;
  const recipientEmail = (body.recipientEmail ?? "").trim().toLowerCase();
  if (isGift && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) {
    return NextResponse.json({ error: "Pon un email válido para el regalo." }, { status: 400 });
  }

  const okCheckout = await rateLimit(req, "checkout", anonId, 3600, 10);
  if (!okCheckout) {
    return NextResponse.json({ error: "Demasiados intentos. Prueba en un rato." }, { status: 429 });
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

  // guard server-side: si YA tiene acceso, no dejar que pague dos veces
  // (solo compra propia; un regalo se puede comprar aunque el comprador ya la tenga)
  if (!isGift) {
    const { data: existing } = await sb
      .from("entitlements")
      .select("id")
      .eq("experience_id", exp.id)
      .eq("anon_id", anonId)
      .is("revoked_at", null)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ alreadyOwned: true, url: `${req.headers.get("origin") || ""}/e/${slug}/chat` });
    }
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
      is_gift: isGift,
      gift_recipient_email: isGift ? recipientEmail : null,
      gift_message: isGift ? (body.giftMessage ?? "").slice(0, 400) || null : null,
    })
    .select("id")
    .single();

  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://henry-demo-zeta.vercel.app";

  // cupón del upsell (?promo=CODE): se resuelve a un promotion code de Stripe
  const promoId =
    typeof body.promo === "string" && body.promo.trim()
      ? await resolvePromotionCode(body.promo)
      : null;

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: exp.stripe_price_id, quantity: 1 }],
      client_reference_id: anonId,
      // con descuento auto-aplicado no se puede además ofrecer el campo de promo manual.
      // (consent_collection.promotions se descartó: exige aceptar ToS en el dashboard
      // y rompía el checkout; el opt-in de marketing se retoma con la cuenta definitiva.)
      ...(promoId
        ? { discounts: [{ promotion_code: promoId }] }
        : { allow_promotion_codes: true }),
      metadata: {
        experience_id: exp.id,
        anon_id: anonId,
        purchase_id: purchase?.id ?? "",
        utm_source: (utm.utm_source ?? "").slice(0, 100),
        utm_medium: (utm.utm_medium ?? "").slice(0, 100),
        utm_campaign: (utm.utm_campaign ?? "").slice(0, 100),
        gift: isGift ? "1" : "",
        gift_recipient_email: isGift ? recipientEmail : "",
      },
      // un regalo NO desbloquea para el comprador: va a la confirmación de regalo
      success_url: isGift
        ? `${origin}/e/${slug}?gift=sent&to=${encodeURIComponent(recipientEmail)}`
        : `${origin}/e/${slug}/chat?purchased=1`,
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
