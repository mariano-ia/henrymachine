import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

// 23505 = unique_violation: el insert ya se hizo en un intento anterior → ok
const isDup = (e: { code?: string } | null) => e?.code === "23505";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new NextResponse("config", { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch {
    return new NextResponse("firma inválida", { status: 400 });
  }

  const sb = createAdminClient();

  // Idempotencia CON reproceso: si el intento anterior murió a mitad
  // (la fila existe pero processed_at quedó null), se procesa de nuevo.
  // Solo processed_at != null cuenta como duplicado real.
  const { error: insErr } = await sb.from("stripe_events").insert({
    event_id: event.id,
    type: event.type,
    payload: JSON.parse(JSON.stringify(event)),
  });
  if (insErr) {
    if (!isDup(insErr)) return new NextResponse("db events", { status: 500 });
    const { data: prev, error: prevErr } = await sb
      .from("stripe_events")
      .select("processed_at")
      .eq("event_id", event.id)
      .maybeSingle();
    if (prevErr) return new NextResponse("db events read", { status: 500 });
    if (prev?.processed_at) return NextResponse.json({ received: true, duplicate: true });
    // processed_at null → reprocesar
  }

  // Toda falla de escritura devuelve 500: Stripe reintenta solo (hasta 3 días).
  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    const experienceId = s.metadata?.experience_id ?? null;
    const anonId = s.metadata?.anon_id || s.client_reference_id || null;
    const purchaseId = s.metadata?.purchase_id || null;
    const email = s.customer_details?.email ?? null;
    const pi = typeof s.payment_intent === "string" ? s.payment_intent : null;

    if (purchaseId) {
      const { error } = await sb
        .from("purchases")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: pi,
          purchaser_email: email,
          stripe_event_id: event.id,
          marketing_consent: s.consent?.promotions === "opt_in",
        })
        .eq("id", purchaseId);
      if (error) return new NextResponse("db purchases", { status: 500 });
    }

    if (experienceId && (anonId || email)) {
      const { error: entErr } = await sb.from("entitlements").insert({
        experience_id: experienceId,
        anon_id: anonId,
        grant_email: email,
        source: "purchase",
        purchase_id: purchaseId,
      });
      if (entErr && !isDup(entErr)) return new NextResponse("db entitlements", { status: 500 });

      const { error: saleErr } = await sb.from("sales").insert({
        experience_id: experienceId,
        purchase_id: purchaseId,
        email,
        amount_cents: s.amount_total ?? 0,
        currency: s.currency ?? "usd",
        status: "paid",
        stripe_session_id: s.id,
        utm_source: s.metadata?.utm_source || null,
        utm_medium: s.metadata?.utm_medium || null,
        utm_campaign: s.metadata?.utm_campaign || null,
      });
      if (saleErr && !isDup(saleErr)) return new NextResponse("db sales", { status: 500 });
    }
  }

  if (event.type === "charge.refunded") {
    const ch = event.data.object as Stripe.Charge;
    const pi = typeof ch.payment_intent === "string" ? ch.payment_intent : null;
    if (pi) {
      // el trigger revoke_entitlement_on_refund revoca el acceso y marca el sale
      const { error } = await sb
        .from("purchases")
        .update({ status: "refunded", refunded_at: new Date().toISOString() })
        .eq("stripe_payment_intent_id", pi);
      if (error) return new NextResponse("db refund", { status: 500 });
    }
  }

  const { error: doneErr } = await sb
    .from("stripe_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", event.id);
  if (doneErr) return new NextResponse("db mark", { status: 500 });

  return NextResponse.json({ received: true });
}
