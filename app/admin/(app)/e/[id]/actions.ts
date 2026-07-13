"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export async function setPricing(input: {
  experienceId: string;
  priceCents: number;
  paywallAfter: number | null;
  message: string | null;
  title: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();

  // autorización barata ANTES de crear nada en Stripe (las actions son endpoints públicos)
  const { data: isAuthor } = await sb.rpc("is_experience_author", { exp: input.experienceId });
  if (!isAuthor) return { ok: false, error: "No autorizado." };

  // El precio de Stripe se crea ANTES del RPC: en publicadas, el constraint
  // exp_paid_needs_price exige stripe_price_id junto con el precio pago.
  let stripePriceId: string | null = null;
  if (input.priceCents > 0) {
    try {
      const price = await getStripe().prices.create({
        unit_amount: input.priceCents,
        currency: "usd",
        product_data: { name: `Henry — ${input.title}` },
      });
      stripePriceId = price.id;
    } catch {
      return { ok: false, error: "No se pudo crear el precio en Stripe." };
    }
  }

  const { error: rpcErr } = await sb.rpc("set_experience_pricing", {
    p_exp: input.experienceId,
    p_price_cents: input.priceCents,
    p_paywall_after: input.priceCents > 0 ? input.paywallAfter : null,
    p_message: input.message,
    p_stripe_price_id: stripePriceId,
  });
  if (rpcErr) {
    // el price LIVE recién creado quedó sin referencia: desactivarlo (best effort)
    if (stripePriceId) {
      try {
        const stripe = getStripe();
        const price = await stripe.prices.update(stripePriceId, { active: false });
        if (typeof price.product === "string") {
          await stripe.products.update(price.product, { active: false });
        }
      } catch {
        /* best effort */
      }
    }
    return { ok: false, error: traduceDbError(rpcErr.message) };
  }

  revalidatePath(`/admin/e/${input.experienceId}`);
  return { ok: true };
}

export async function addStep(input: {
  experienceId: string;
  afterPosition: number;
  type: "message" | "arrival";
}): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { error } = await sb.rpc("admin_add_step", {
    p_exp: input.experienceId,
    p_after: input.afterPosition,
    p_type: input.type,
  });
  if (error) return { ok: false, error: traduceDbError(error.message) };
  revalidatePath(`/admin/e/${input.experienceId}`);
  return { ok: true };
}

export async function deleteStep(input: {
  stepId: string;
  experienceId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  // los archivos de media del paso: la fila cae por cascade, el storage se limpia acá
  const { data: media } = await sb
    .from("step_media")
    .select("storage_path")
    .eq("step_id", input.stepId);
  const { error } = await sb.rpc("admin_delete_step", { p_step: input.stepId });
  if (error) return { ok: false, error: traduceDbError(error.message) };
  // storage con service_role: el bucket es privado y el rol del autor no tiene
  // policy de select, así que remove() con su JWT no borra nada (falla en silencio)
  const paths = (media ?? []).map((m) => m.storage_path).filter(Boolean) as string[];
  if (paths.length) {
    await createAdminClient().storage.from("experience-media").remove(paths);
  }
  revalidatePath(`/admin/e/${input.experienceId}`);
  return { ok: true };
}

export type StepEdit = {
  id: string;
  title: string | null;
  body: string | null;
  proposal: string | null;
  walk_to_next: string | null;
  place_query: string | null;
  address: string | null;
};

export async function saveExperience(input: {
  id: string;
  title: string;
  pitch: string | null;
  city: string | null;
  steps: StepEdit[];
}): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();

  const { error: e1 } = await sb
    .from("experiences")
    .update({ title: input.title, pitch: input.pitch, city: input.city })
    .eq("id", input.id);
  if (e1) return { ok: false, error: e1.message };

  for (const s of input.steps) {
    const { error } = await sb
      .from("steps")
      .update({
        title: s.title,
        body: s.body,
        proposal: s.proposal,
        walk_to_next: s.walk_to_next,
        place_query: s.place_query,
        address: s.address,
      })
      .eq("id", s.id);
    if (error) return { ok: false, error: traduceDbError(error.message) };
  }

  revalidatePath(`/admin/e/${input.id}`);
  return { ok: true };
}

export async function publishExperience(id: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { error } = await sb.from("experiences").update({ status: "published" }).eq("id", id);
  if (error) return { ok: false, error: traduceDbError(error.message) };
  revalidatePath(`/admin/e/${id}`);
  revalidatePath("/admin");
  return { ok: true };
}

export async function unpublishExperience(id: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { error } = await sb.from("experiences").update({ status: "draft" }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/e/${id}`);
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteExperience(id: string): Promise<void> {
  const sb = await createClient();
  await sb.from("experiences").delete().eq("id", id);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function addStepMedia(input: {
  experienceId: string;
  stepId: string;
  kind: "video" | "image" | "audio";
  storagePath: string;
  caption?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { error } = await sb.from("step_media").insert({
    experience_id: input.experienceId,
    step_id: input.stepId,
    kind: input.kind,
    bucket: "experience-media",
    storage_path: input.storagePath,
    caption: input.caption ?? null,
    step_position: 0, // lo fija el trigger sync_step_media_position
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/e/${input.experienceId}`);
  return { ok: true };
}

export async function deleteStepMedia(input: {
  mediaId: string;
  experienceId: string;
  storagePath: string | null;
}): Promise<void> {
  const sb = await createClient();
  await sb.from("step_media").delete().eq("id", input.mediaId);
  if (input.storagePath) {
    await sb.storage.from("experience-media").remove([input.storagePath]);
  }
  revalidatePath(`/admin/e/${input.experienceId}`);
}

// Traduce los errores de los triggers/RPCs de la DB (corren al publicar Y al
// editar en vivo una publicada) a mensajes entendibles en el editor.
function traduceDbError(msg: string): string {
  if (msg.includes("sin pasos")) return "Una experiencia publicada no puede quedar sin pasos.";
  if (msg.includes("regalaria entera") || msg.includes("regalaría entera"))
    return "Una experiencia paga necesita su paso de paywall: sin él se regala entera.";
  if (msg.includes("contenido para vender"))
    return "El paywall tiene que dejar al menos un paso pago detrás. Bajá el número de \"Gratis hasta el paso\".";
  if (msg.includes("al menos 2 pasos"))
    return "Se necesitan al menos 2 pasos para poner un paywall.";
  if (msg.includes("estado invalido") || msg.includes("estado inválido"))
    return "Una experiencia gratis no debe tener paywall. Poné un precio o quitá el paywall.";
  if (msg.includes("paywall"))
    return "Revisá el paywall: una experiencia paga necesita un paso de paywall; una gratis no debe tener.";
  if (msg.includes("arrival")) return "Hay paradas sin lugar/dirección. Completá el lugar de cada parada.";
  return msg;
}
