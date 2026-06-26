import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

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

  // idempotencia: el event_id es PK; si ya existe, ya se procesó.
  const { error: dupErr } = await sb.from("stripe_events").insert({
    event_id: event.id,
    type: event.type,
    payload: JSON.parse(JSON.stringify(event)),
  });
  if (dupErr) return NextResponse.json({ received: true, duplicate: true });

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    const experienceId = s.metadata?.experience_id ?? null;
    const anonId = s.metadata?.anon_id || s.client_reference_id || null;
    const purchaseId = s.metadata?.purchase_id || null;
    const email = s.customer_details?.email ?? null;
    const pi = typeof s.payment_intent === "string" ? s.payment_intent : null;

    if (purchaseId) {
      await sb
        .from("purchases")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: pi,
          purchaser_email: email,
          stripe_event_id: event.id,
        })
        .eq("id", purchaseId);
    }

    if (experienceId && (anonId || email)) {
      await sb.from("entitlements").insert({
        experience_id: experienceId,
        anon_id: anonId,
        grant_email: email,
        source: "purchase",
        purchase_id: purchaseId,
      });
      await sb.from("sales").insert({
        experience_id: experienceId,
        purchase_id: purchaseId,
        email,
        amount_cents: s.amount_total ?? 0,
        currency: s.currency ?? "usd",
        status: "paid",
        stripe_session_id: s.id,
      });
    }
  }

  if (event.type === "charge.refunded") {
    const ch = event.data.object as Stripe.Charge;
    const pi = typeof ch.payment_intent === "string" ? ch.payment_intent : null;
    if (pi) {
      // el trigger revoke_entitlement_on_refund revoca el acceso y marca el sale
      await sb
        .from("purchases")
        .update({ status: "refunded", refunded_at: new Date().toISOString() })
        .eq("stripe_payment_intent_id", pi);
    }
  }

  await sb.from("stripe_events").update({ processed_at: new Date().toISOString() }).eq("event_id", event.id);
  return NextResponse.json({ received: true });
}
