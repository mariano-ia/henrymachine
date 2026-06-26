"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function setPricing(input: {
  experienceId: string;
  priceCents: number;
  paywallAfter: number | null;
  message: string | null;
  title: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { error: rpcErr } = await sb.rpc("set_experience_pricing", {
    p_exp: input.experienceId,
    p_price_cents: input.priceCents,
    p_paywall_after: input.priceCents > 0 ? input.paywallAfter : null,
    p_message: input.message,
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };

  if (input.priceCents > 0) {
    try {
      const price = await getStripe().prices.create({
        unit_amount: input.priceCents,
        currency: "usd",
        product_data: { name: `Henry — ${input.title}` },
      });
      await sb.from("experiences").update({ stripe_price_id: price.id }).eq("id", input.experienceId);
    } catch {
      return { ok: false, error: "No se pudo crear el precio en Stripe." };
    }
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
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/admin/e/${input.id}`);
  return { ok: true };
}

export async function publishExperience(id: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { error } = await sb.from("experiences").update({ status: "published" }).eq("id", id);
  if (error) return { ok: false, error: traducePublishError(error.message) };
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

function traducePublishError(msg: string): string {
  if (msg.includes("sin pasos")) return "No se puede publicar sin pasos.";
  if (msg.includes("paywall")) return "Revisá el paywall: una experiencia paga necesita un paso de paywall; una gratis no debe tener.";
  if (msg.includes("arrival")) return "Hay paradas sin lugar/dirección. Completá el lugar de cada parada.";
  return msg;
}
