import { listPromotionCodes } from "@/lib/stripe-coupons";
import CouponsEditor from "@/components/admin/CouponsEditor";

export const dynamic = "force-dynamic";

export default async function CuponesPage() {
  let coupons;
  try {
    coupons = await listPromotionCodes();
  } catch {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold text-white">Cupones</h1>
        <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">
          No pudimos leer los cupones de Stripe. Revisá la key.
        </p>
      </div>
    );
  }
  return <CouponsEditor coupons={coupons} />;
}
