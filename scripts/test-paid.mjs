import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const authorId = "a0000000-0000-4000-8000-000000000001";
const price = await stripe.prices.create({ unit_amount: 500, currency: "usd", product_data: { name: "Henry — TEST paid" } });
await sb.from("experiences").delete().eq("slug", "test-paid");
const { data: exp, error } = await sb.from("experiences").insert({ author_id: authorId, slug: "test-paid", title: "TEST paid", status: "draft", price_cents: 500, stripe_price_id: price.id, language: "es" }).select("id").single();
if (error) { console.error(error); process.exit(1); }
await sb.from("content_sources").insert({ experience_id: exp.id, inline_text: "Recorrido de prueba.", ingest_status: "ready" });
const mk = (o) => ({ experience_id: exp.id, is_paywall:false, ...o });
const { error: sErr } = await sb.from("steps").insert([
  mk({ position:1, type:"message", title:"Bienvenida", body:"Hola, soy Henry." }),
  mk({ position:2, type:"arrival", title:"Parada gratis", proposal:"Mira esto.", place_query:"Times Square, New York" }),
  mk({ position:3, type:"paywall", is_paywall:true, title:"Paywall", paywall_message:"Compra para seguir el recorrido." }),
  mk({ position:4, type:"arrival", title:"Parada paga", proposal:"Lo bueno.", place_query:"Central Park, New York" }),
  mk({ position:5, type:"message", title:"Cierre", body:"Un abrazo." }),
]);
if (sErr) { console.error("steps:", sErr); process.exit(1); }
const { error: pErr } = await sb.from("experiences").update({ status:"published" }).eq("id", exp.id);
if (pErr) { console.error("publish:", pErr); process.exit(1); }
console.log("OK test-paid | price:", price.id);
