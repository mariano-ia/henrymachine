import "server-only";
import Stripe from "stripe";

/**
 * Cupones sobre Stripe: Stripe es la ÚNICA fuente de verdad (Coupons +
 * Promotion Codes). No hay tabla local de redenciones. El "código" que ve el
 * usuario es el Promotion Code (ej. GOLAZO20); el descuento lo define el Coupon.
 *
 * ⚠️ Cliente pineado a 2024-06-20: la API dahlia (2026-06-24, default de la
 * cuenta) rechaza `coupon` en promotionCodes.create. Los promotion codes son
 * objetos de cuenta independientes de la versión, así que se aplican sin
 * problema en el checkout (que corre en dahlia). getStripe() no se toca.
 */
let _cstripe: Stripe | null = null;
function couponStripe(): Stripe {
  if (!_cstripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY no configurada");
    // los tipos del SDK son dahlia-only; casteamos la versión pineada a propósito
    _cstripe = new Stripe(key, {
      apiVersion: "2024-06-20",
    } as unknown as ConstructorParameters<typeof Stripe>[1]);
  }
  return _cstripe;
}

export type CouponView = {
  promotionCodeId: string;
  code: string;
  active: boolean;
  percentOff: number | null;
  amountOffCents: number | null;
  currency: string | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  expiresAt: number | null; // epoch segundos
};

export async function listPromotionCodes(): Promise<CouponView[]> {
  const stripe = couponStripe();
  const res = await stripe.promotionCodes.list({ limit: 100, expand: ["data.coupon"] });
  // el shape 2024-06-20 (pc.coupon con percent_off/amount_off) no está en los tipos dahlia
  return res.data.map((raw) => {
    const pc = raw as unknown as {
      id: string;
      code: string;
      active: boolean;
      max_redemptions: number | null;
      times_redeemed: number;
      expires_at: number | null;
      coupon: { percent_off: number | null; amount_off: number | null; currency: string | null };
    };
    return {
      promotionCodeId: pc.id,
      code: pc.code,
      active: pc.active,
      percentOff: pc.coupon.percent_off ?? null,
      amountOffCents: pc.coupon.amount_off ?? null,
      currency: pc.coupon.currency ?? null,
      maxRedemptions: pc.max_redemptions ?? null,
      timesRedeemed: pc.times_redeemed,
      expiresAt: pc.expires_at ?? null,
    };
  });
}

export async function createCoupon(input: {
  code: string;
  percentOff?: number | null; // 1..100
  amountOffCents?: number | null; // en centavos USD
  maxRedemptions?: number | null;
  expiresAt?: number | null; // epoch segundos
}): Promise<{ ok: boolean; error?: string }> {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,40}$/.test(code)) {
    return { ok: false, error: "El código debe ser 3–40 caracteres alfanuméricos." };
  }
  const pct = input.percentOff ?? null;
  const amt = input.amountOffCents ?? null;
  if ((pct == null && amt == null) || (pct != null && amt != null)) {
    return { ok: false, error: "Elige porcentaje O monto fijo, uno solo." };
  }
  if (pct != null && (pct < 1 || pct > 100)) {
    return { ok: false, error: "El porcentaje va de 1 a 100." };
  }
  if (amt != null && amt < 50) {
    return { ok: false, error: "El monto mínimo es US$0,50." };
  }
  try {
    const stripe = couponStripe();
    const coupon = await stripe.coupons.create(
      pct != null
        ? { percent_off: pct, duration: "once", name: `Henry ${code}` }
        : { amount_off: amt!, currency: "usd", duration: "once", name: `Henry ${code}` }
    );
    // `coupon` no está en los params dahlia; en 2024-06-20 sí (cast intencional)
    await stripe.promotionCodes.create({
      coupon: coupon.id,
      code,
      ...(input.maxRedemptions ? { max_redemptions: input.maxRedemptions } : {}),
      ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
    } as unknown as Stripe.PromotionCodeCreateParams);
    return { ok: true };
  } catch (e) {
    const msg = (e as Error)?.message ?? "";
    if (/already exists/i.test(msg)) return { ok: false, error: "Ya existe un cupón con ese código." };
    return { ok: false, error: "No se pudo crear el cupón en Stripe." };
  }
}

export async function setPromotionActive(
  promotionCodeId: string,
  active: boolean
): Promise<{ ok: boolean; error?: string }> {
  try {
    await couponStripe().promotionCodes.update(promotionCodeId, { active });
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo actualizar el cupón." };
  }
}

/** Resuelve un Promotion Code (el string visible) a su id de Stripe, si está activo. */
export async function resolvePromotionCode(code: string): Promise<string | null> {
  try {
    const res = await couponStripe().promotionCodes.list({
      code: code.trim().toUpperCase(),
      active: true,
      limit: 1,
    });
    return res.data[0]?.id ?? null;
  } catch {
    return null;
  }
}
