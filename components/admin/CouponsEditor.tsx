"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCouponAction, togglePromotionAction } from "@/app/admin/(app)/cupones/actions";
import type { CouponView } from "@/lib/stripe-coupons";

const inp =
  "w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-500/20";

function fmtDiscount(c: CouponView): string {
  if (c.percentOff != null) return `${c.percentOff}% off`;
  if (c.amountOffCents != null) return `US$${(c.amountOffCents / 100).toFixed(2)} off`;
  return "—";
}
function fmtExpiry(epoch: number | null): string {
  if (!epoch) return "sin vencimiento";
  return new Date(epoch * 1000).toLocaleDateString("es");
}

export default function CouponsEditor({ coupons }: { coupons: CouponView[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [maxRed, setMaxRed] = useState("");
  const [expiry, setExpiry] = useState(""); // yyyy-mm-dd
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();

  function create() {
    const v = parseFloat(value);
    if (!code.trim()) return setMsg({ kind: "err", text: "Pon un código." });
    if (!Number.isFinite(v) || v <= 0) return setMsg({ kind: "err", text: "Pon un valor válido." });
    const expiresAt = expiry ? Math.floor(new Date(expiry + "T23:59:59").getTime() / 1000) : null;
    const maxRedemptions = maxRed ? parseInt(maxRed, 10) : null;
    start(async () => {
      const r = await createCouponAction({ code: code.trim(), kind, value: v, maxRedemptions, expiresAt });
      if (r.ok) {
        setMsg({ kind: "ok", text: "Cupón creado." });
        setCode("");
        setValue("");
        setMaxRed("");
        setExpiry("");
        router.refresh();
      } else {
        setMsg({ kind: "err", text: r.error ?? "Error" });
      }
    });
  }

  function toggle(c: CouponView) {
    start(async () => {
      const r = await togglePromotionAction(c.promotionCodeId, !c.active);
      if (!r.ok) setMsg({ kind: "err", text: r.error ?? "Error" });
      else router.refresh();
    });
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-white">Cupones</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Códigos de descuento sobre Stripe (Stripe es la fuente de verdad). Se aplican en el
        checkout — por ejemplo, en el upsell de una experiencia.
      </p>

      {/* alta */}
      <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-neutral-900/40 p-5">
        <h2 className="text-sm font-medium text-neutral-300">Crear cupón</h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CÓDIGO (ej. GOLAZO20)"
            className={inp}
          />
          <div className="flex gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value as "percent" | "amount")} className={inp}>
              <option value="percent">% de descuento</option>
              <option value="amount">US$ de descuento</option>
            </select>
            <input
              type="number"
              min={0}
              step={kind === "percent" ? "1" : "0.5"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={kind === "percent" ? "20" : "3"}
              className={inp}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-neutral-500">Usos máximos (opcional)</span>
            <input type="number" min={1} value={maxRed} onChange={(e) => setMaxRed(e.target.value)} placeholder="sin límite" className={inp} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-neutral-500">Vence (opcional)</span>
            <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={inp} />
          </label>
        </div>
        <button
          onClick={create}
          disabled={pending}
          className="rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-200 disabled:opacity-50"
        >
          {pending ? "Creando…" : "Crear cupón"}
        </button>
        {msg && (
          <p className={`text-xs ${msg.kind === "ok" ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>
        )}
      </div>

      {/* listado */}
      <h2 className="mb-3 mt-8 text-sm font-medium uppercase tracking-wide text-neutral-500">
        Cupones ({coupons.length})
      </h2>
      <ul className="space-y-2">
        {coupons.map((c) => (
          <li
            key={c.promotionCodeId}
            className={"flex items-center gap-3 rounded-xl border border-white/10 bg-neutral-900/40 p-3.5" + (c.active ? "" : " opacity-50")}
          >
            <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-[13px] font-semibold text-white">{c.code}</span>
            <span className="text-sm text-neutral-300">{fmtDiscount(c)}</span>
            <span className="text-xs text-neutral-500">
              {c.timesRedeemed}
              {c.maxRedemptions ? `/${c.maxRedemptions}` : ""} usos · {fmtExpiry(c.expiresAt)}
            </span>
            <button
              onClick={() => toggle(c)}
              disabled={pending}
              className="ml-auto rounded-lg border border-white/10 px-3 py-1 text-xs text-neutral-200 hover:bg-white/5 disabled:opacity-50"
            >
              {c.active ? "Desactivar" : "Activar"}
            </button>
          </li>
        ))}
        {coupons.length === 0 && <p className="text-sm text-neutral-500">Todavía no hay cupones.</p>}
      </ul>
    </div>
  );
}
