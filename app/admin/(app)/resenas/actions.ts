"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin(): Promise<boolean> {
  const sb = await createClient();
  const { data } = await sb.rpc("is_admin");
  return data === true;
}

export async function setReviewStatus(
  id: string,
  status: "pending" | "approved" | "featured" | "rejected"
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "No autorizado." };
  const sb = await createClient();
  const { error } = await sb.from("reviews").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/resenas");
  return { ok: true };
}

export async function deleteReview(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "No autorizado." };
  const sb = await createClient();
  const { error } = await sb.from("reviews").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/resenas");
  return { ok: true };
}
