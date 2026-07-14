"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { track, getUtm } from "@/lib/track";
import { fmtUsd } from "@/lib/price";

export default function BuyBar({
  slug,
  priceCents,
  freeStops = 0,
}: {
  slug: string;
  priceCents: number;
  freeStops?: number;
}) {
  const router = useRouter();
  const free = !priceCents || priceCents === 0;
  const [anonId, setAnonId] = useState("");
  const [owned, setOwned] = useState(free);
  const [checking, setChecking] = useState(!free);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let id = localStorage.getItem("henry_anon");
    if (!id) {
      id = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
      localStorage.setItem("henry_anon", id);
    }
    setAnonId(id);
    if (free) return;
    fetch("/api/experience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, anonId: id }),
    })
      .then((r) => r.json())
      .then((d) => setOwned(!d.locked))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [slug, free]);

  const start = () => router.push(`/e/${slug}/chat`);

  async function buy() {
    track("begin_checkout", slug);
    if (!anonId) return;
    setBusy(true);
    setErr(null);
    try {
      // cupón del upsell (llega como ?promo=CODE en la URL del detalle)
      const promo =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("promo")
          : null;
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId, utm: getUtm(), promo }),
      });
      const d = await res.json();
      if (d.url) window.location.href = d.url;
      else {
        setErr(d.error ?? "No se pudo iniciar el pago. Probá de nuevo.");
        setBusy(false);
      }
    } catch {
      setErr("No se pudo iniciar el pago. Probá de nuevo.");
      setBusy(false);
    }
  }

  const base =
    "inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-[15px] font-semibold transition-colors";

  if (checking) {
    return (
      <button disabled className={`${base} bg-ink/10 text-ink/40`}>
        Un segundo…
      </button>
    );
  }

  // gratis o ya comprada → arrancar directo
  if (free || owned) {
    return (
      <button onClick={start} className={`${base} bg-brand text-white hover:bg-brand-dark`}>
        Dale, vamos <span aria-hidden>→</span>
      </button>
    );
  }

  // paga con paradas gratis → empezás gratis y pagás en el chat al llegar al paywall
  if (freeStops > 0) {
    return (
      <div>
        <button onClick={start} className={`${base} bg-brand text-white hover:bg-brand-dark`}>
          Empezá gratis <span aria-hidden>→</span>
        </button>
        <p className="mt-2 text-center text-[12px] text-ink/50">
          {freeStops} {freeStops === 1 ? "parada gratis" : "paradas gratis"} · después desbloqueás por {fmtUsd(priceCents)}
        </p>
      </div>
    );
  }

  // paga sin preview → comprar directo
  return (
    <div>
      <button
        onClick={buy}
        disabled={busy}
        className={`${base} bg-brand text-white hover:bg-brand-dark disabled:opacity-70`}
      >
        {busy ? "Abriendo el pago…" : `Comprá y arrancá · ${fmtUsd(priceCents)}`}
      </button>
      {err && <p className="mt-2 text-center text-[12px] text-red-600">{err}</p>}
    </div>
  );
}
