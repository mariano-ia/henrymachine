"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UtilityInput = {
  category: string;
  name: string;
  neighborhood: string | null;
  address: string | null;
  place_query: string | null;
  hours: string | null;
  is_free: boolean;
  henry_note: string | null;
};

export async function addUtility(input: UtilityInput): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { error } = await sb.from("utilities").insert(input);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/utilidades");
  return { ok: true };
}

export async function updateUtility(
  id: string,
  input: UtilityInput & { active: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { error } = await sb.from("utilities").update(input).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/utilidades");
  return { ok: true };
}

export async function deleteUtility(id: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { error } = await sb.from("utilities").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/utilidades");
  return { ok: true };
}
