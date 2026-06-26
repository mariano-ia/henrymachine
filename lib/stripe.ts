import Stripe from "stripe";

let _stripe: Stripe | null = null;

/** Cliente de Stripe (lazy, para no romper el build sin la key). */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY no configurada");
    _stripe = new Stripe(key);
  }
  return _stripe;
}
