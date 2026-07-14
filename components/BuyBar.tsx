"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { track, getUtm } from "@/lib/track";

function fmtPrice(cents: number): string {
  return !cents || cents === 0 ? "Gratis" : `$${(cents / 100).toFixed(2)}`;
}

export default function BuyBar({
  slug,
  priceCents,
}: {
  slug: string;
  priceCents: number;
}) {
  const router = useRouter();
  const free = !priceCents || priceCents === 0;
  const [anonId, setAnonId] = useState("");
  const [owned, setOwned] = useState(free);
  const [checking, setChecking] = useState(!free);
  const [busy, setBusy] = useState(false);

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
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId, utm: getUtm() }),
      });
      const d = await res.json();
      if (d.url) window.location.href = d.url;
      else setBusy(false);
    } catch {
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

  if (free || owned) {
    return (
      <button onClick={start} className={`${base} bg-brand text-white hover:bg-brand-dark`}>
        Dale, vamos <span aria-hidden>→</span>
      </button>
    );
  }

  return (
    <button
      onClick={buy}
      disabled={busy}
      className={`${base} bg-brand text-white hover:bg-brand-dark disabled:opacity-70`}
    >
      {busy ? "Abriendo el pago…" : `Comprá y arrancá · ${fmtPrice(priceCents)}`}
    </button>
  );
}
