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
    email?: string;
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

  const originEarly = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "";

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
      return NextResponse.json({ alreadyOwned: true, url: `${originEarly}/e/${slug}/chat` });
    }

    // anti doble-cargo: si ya hay un checkout pendiente para este anon+exp, no creamos
    // otro. Si sigue abierto, reusamos su URL; si ya se pagó (webhook demorado), lo
    // mandamos al chat a esperar la confirmación en vez de cobrar de nuevo.
    const { data: pend } = await sb
      .from("purchases")
      .select("stripe_checkout_session_id")
      .eq("experience_id", exp.id)
      .eq("anon_id", anonId)
      .eq("status", "pending")
      .not("stripe_checkout_session_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pend?.stripe_checkout_session_id) {
      try {
        const prev = await getStripe().checkout.sessions.retrieve(pend.stripe_checkout_session_id);
        if (prev.status === "open" && prev.url) {
          return NextResponse.json({ url: prev.url });
        }
        if (prev.status === "complete") {
          return NextResponse.json({ alreadyOwned: true, url: `${originEarly}/e/${slug}/chat?purchased=1` });
        }
      } catch {
        /* la sesión previa no se pudo leer: seguimos y creamos una nueva */
      }
    }
  }

  // regalo a quien YA la tiene: no cobrar de gusto
  if (isGift) {
    const { data: alreadyGifted } = await sb
      .from("entitlements")
      .select("id")
      .eq("experience_id", exp.id)
      .eq("grant_email", recipientEmail)
      .is("revoked_at", null)
      .maybeSingle();
    if (alreadyGifted) {
      return NextResponse.json(
        { error: "Esa persona ya tiene este recorrido. No hace falta comprarlo de nuevo." },
        { status: 400 }
      );
    }
  }

  // cupón del upsell (?promo=CODE): se resuelve a un promotion code de Stripe.
  // Si vino un código pero no resuelve (vencido/desactivado), avisamos en vez de
  // cobrar precio completo en silencio.
  const promoRaw = typeof body.promo === "string" ? body.promo.trim() : "";
  const promoId = promoRaw ? await resolvePromotionCode(promoRaw) : null;
  if (promoRaw && !promoId) {
    return NextResponse.json(
      { error: "Ese cupón ya no está disponible.", code: "invalid_promo" },
      { status: 400 }
    );
  }

  // purchase 'pending' (puente checkout→identidad antes del webhook)
  const { data: purchase, error: purchaseErr } = await sb
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
  // si el registro de compra no se creó, abortar ANTES de cobrar: con purchase_id
  // vacío el webhook no puede marcar la compra como pagada ni evitar doble cargo.
  if (purchaseErr || !purchase) {
    console.error("[checkout] no se pudo crear el purchase pending", {
      slug,
      error: purchaseErr?.message,
    });
    return NextResponse.json({ error: "No se pudo iniciar el pago." }, { status: 500 });
  }

  const origin = originEarly || "https://caminaconhenry.com";
  // prefill del email en Stripe si ya lo capturamos (menos fricción al pagar)
  const prefillEmail =
    typeof body.email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)
      ? body.email.toLowerCase()
      : undefined;

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: exp.stripe_price_id, quantity: 1 }],
      client_reference_id: anonId,
      ...(prefillEmail ? { customer_email: prefillEmail } : {}),
      // con descuento auto-aplicado no se puede además ofrecer el campo de promo manual.
      // (consent_collection.promotions se descartó: exige aceptar ToS en el dashboard
      // y rompía el checkout; el opt-in de marketing se retoma con la cuenta definitiva.)
      ...(promoId
        ? { discounts: [{ promotion_code: promoId }] }
        : { allow_promotion_codes: true }),
      metadata: {
        experience_id: exp.id,
        anon_id: anonId,
        purchase_id: purchase.id,
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
    await sb
      .from("purchases")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", purchase.id);
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[checkout] no se pudo crear la sesión de Stripe", { slug, error: e });
    return NextResponse.json({ error: "No se pudo iniciar el pago." }, { status: 502 });
  }
}
