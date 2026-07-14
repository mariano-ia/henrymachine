"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createCoupon, setPromotionActive } from "@/lib/stripe-coupons";

/** Guard: solo admins pueden tocar cupones (las actions son endpoints públicos). */
async function requireAdmin(): Promise<boolean> {
  const sb = await createClient();
  const { data } = await sb.rpc("is_admin");
  return data === true;
}

export async function createCouponAction(input: {
  code: string;
  kind: "percent" | "amount";
  value: number; // % (1..100) o USD (ej. 3 = US$3)
  maxRedemptions: number | null;
  expiresAt: number | null; // epoch segundos
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "No autorizado." };
  const r = await createCoupon({
    code: input.code,
    percentOff: input.kind === "percent" ? Math.round(input.value) : null,
    amountOffCents: input.kind === "amount" ? Math.round(input.value * 100) : null,
    maxRedemptions: input.maxRedemptions,
    expiresAt: input.expiresAt,
  });
  if (r.ok) revalidatePath("/admin/cupones");
  return r;
}

export async function togglePromotionAction(
  promotionCodeId: string,
  active: boolean
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "No autorizado." };
  const r = await setPromotionActive(promotionCodeId, active);
  if (r.ok) revalidatePath("/admin/cupones");
  return r;
}
