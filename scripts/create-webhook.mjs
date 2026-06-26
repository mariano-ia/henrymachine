// Crea (o recrea) el webhook endpoint de Henry en Stripe y escribe el signing
// secret en .env.local. Correr: node --env-file=.env.local scripts/create-webhook.mjs
import Stripe from "stripe";
import { readFileSync, writeFileSync } from "node:fs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const base =
  process.env.NEXT_PUBLIC_SITE_URL || "https://henry-demo-zeta.vercel.app";
const url = `${base}/api/stripe/webhook`;
const events = ["checkout.session.completed", "charge.refunded"];

const existing = await stripe.webhookEndpoints.list({ limit: 100 });
for (const e of existing.data) {
  if (e.url === url) await stripe.webhookEndpoints.del(e.id);
}

const ep = await stripe.webhookEndpoints.create({
  url,
  enabled_events: events,
  description: "Henry Machine",
});

const path = ".env.local";
let s = readFileSync(path, "utf8");
if (/^STRIPE_WEBHOOK_SECRET=.*$/m.test(s)) {
  s = s.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, `STRIPE_WEBHOOK_SECRET=${ep.secret}`);
} else {
  s += `\nSTRIPE_WEBHOOK_SECRET=${ep.secret}\n`;
}
writeFileSync(path, s);

console.log("webhook creado:", ep.id, "| eventos:", ep.enabled_events.join(", "), "| secret escrito en .env.local (oculto)");
