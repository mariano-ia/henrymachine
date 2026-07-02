// Siembra experiencias de ejemplo (publicadas) para poblar el catálogo, con la
// metadata de las cards (duración, distancia, barrio, tema) y varias paradas.
// Correr: node --env-file=.env.local scripts/seed-catalog.mjs
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const AUTHOR = "a0000000-0000-4000-8000-000000000001"; // Henry

const items = [
  {
    slug: "pizzas-brooklyn",
    title: "Las mejores pizzas de Brooklyn",
    city: "Brooklyn",
    neighborhood: "Williamsburg → Bushwick",
    theme: "Comida",
    minutes: 75,
    distance_m: 2800,
    price: 600,
    pitch: "Las pizzerías que Henry defiende con la vida, de Williamsburg a Bushwick.",
    stops: [
      ["Una porción clásica", "Arrancamos por la de siempre. Vení con hambre.", "Best Pizza, Williamsburg, Brooklyn"],
      ["Horno a leña", "Cruzamos para la napolitana del barrio.", "Roberta's, Bushwick, Brooklyn"],
      ["El secreto de la esquina", "Una que sólo conocen los de acá.", "L'industrie Pizzeria, Williamsburg, Brooklyn"],
      ["El cierre dulce", "Cerramos con un cannolo.", "Fortunato Brothers, Williamsburg, Brooklyn"],
    ],
  },
  {
    slug: "cafes-village",
    title: "Cafés de especialidad en el Village",
    city: "Manhattan",
    neighborhood: "West Village",
    theme: "Comida",
    minutes: 60,
    distance_m: 1600,
    price: 500,
    pitch: "Cuatro barras y las historias que Henry junta en cada café del West Village.",
    stops: [
      ["El primer cortado", "Empezamos suave, donde me conocen.", "Partners Coffee, West Village, New York"],
      ["El de la esquina vieja", "Un clásico de toda la vida.", "Caffe Reggio, Greenwich Village, New York"],
      ["El nuevo de moda", "Te muestro la barra del momento.", "Abraço, East Village, New York"],
    ],
  },
  {
    slug: "miradores-manhattan",
    title: "Miradores secretos de Manhattan",
    city: "Manhattan",
    neighborhood: "Chelsea / Midtown",
    theme: "Vistas",
    minutes: 90,
    distance_m: 3200,
    price: 700,
    pitch: "Azoteas, puentes y rincones con vista que Henry encontró caminando.",
    stops: [
      ["La vista de arranque", "Subimos despacio, que la ciudad se abra de a poco.", "The High Line, New York"],
      ["El balcón escondido", "Pocos saben que se puede subir acá.", "230 Fifth Rooftop, New York"],
      ["Entre rascacielos", "El punto donde todo se ve enorme.", "Top of the Rock, New York"],
      ["El cierre con río", "Terminamos mirando el agua.", "Brooklyn Bridge Park, New York"],
    ],
  },
  {
    slug: "domingo-williamsburg",
    title: "Un domingo en Williamsburg",
    city: "Brooklyn",
    neighborhood: "Williamsburg",
    theme: "Vida local",
    minutes: 80,
    distance_m: 2200,
    price: 0,
    pitch: "Mercado, vinilos, café de fila y el río. El domingo lento de Henry.",
    stops: [
      ["El mercado del domingo", "Vení sin apuro, esto se disfruta caminando.", "Smorgasburg, Williamsburg, Brooklyn"],
      ["Vinilos viejos", "Nos perdemos entre discos un rato.", "Rough Trade, Williamsburg, Brooklyn"],
      ["Café de fila", "El que vale la pena esperar.", "Devoción, Williamsburg, Brooklyn"],
      ["La tarde junto al río", "Cerramos mirando Manhattan de frente.", "Domino Park, Williamsburg, Brooklyn"],
    ],
  },
];

for (const it of items) {
  await sb.from("purchases").delete().in(
    "experience_id",
    (await sb.from("experiences").select("id").eq("slug", it.slug)).data?.map((r) => r.id) ?? []
  );
  await sb.from("experiences").delete().eq("slug", it.slug);

  let stripePriceId = null;
  if (it.price > 0) {
    const sp = await stripe.prices.create({
      unit_amount: it.price,
      currency: "usd",
      product_data: { name: `Henry — ${it.title}` },
    });
    stripePriceId = sp.id;
  }

  const { data: exp, error } = await sb
    .from("experiences")
    .insert({
      author_id: AUTHOR,
      slug: it.slug,
      title: it.title,
      city: it.city,
      neighborhood: it.neighborhood,
      theme: it.theme,
      pitch: it.pitch,
      status: "draft",
      expected_minutes: it.minutes,
      distance_m: it.distance_m,
      price_cents: it.price,
      stripe_price_id: stripePriceId,
      language: "es",
    })
    .select("id")
    .single();
  if (error) {
    console.error(it.slug, error);
    continue;
  }

  await sb.from("content_sources").insert({
    experience_id: exp.id,
    inline_text: it.pitch,
    ingest_status: "ready",
  });

  const mk = (o) => ({ experience_id: exp.id, is_paywall: false, ...o });
  const steps = [];
  let pos = 1;
  steps.push(mk({ position: pos++, type: "message", title: "Bienvenida", body: `Hola, soy Henry. Vamos a ${it.title.toLowerCase()}.` }));
  it.stops.forEach((s, idx) => {
    if (it.price > 0 && idx === it.stops.length - 1) {
      steps.push(mk({ position: pos++, type: "paywall", is_paywall: true, title: "Seguí conmigo", paywall_message: "Seguí el recorrido completo conmigo." }));
    }
    steps.push(mk({ position: pos++, type: "arrival", title: s[0], proposal: s[1], place_query: s[2] }));
  });
  steps.push(mk({ position: pos++, type: "message", title: "Cierre", body: "Hasta acá llegamos. Un abrazo y nos vemos en la próxima." }));

  const { error: sErr } = await sb.from("steps").insert(steps);
  if (sErr) {
    console.error(it.slug, "steps:", sErr);
    continue;
  }

  const { error: pErr } = await sb
    .from("experiences")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", exp.id);
  if (pErr) {
    console.error(it.slug, "publish:", pErr);
    continue;
  }
  console.log("OK", it.slug);
}

// la experiencia real (12h) también necesita su metadata de card
await sb
  .from("experiences")
  .update({ theme: "Clásicos", neighborhood: "Varios barrios", distance_m: 14000, expected_minutes: 720 })
  .eq("slug", "nyc12horas");

console.log("listo");
