"use client";

import { useEffect, useState } from "react";
import PlayerChat from "./PlayerChat";
import type { PlayMedia } from "@/lib/db/experiences";
import { track } from "@/lib/track";

type Data = {
  slug: string;
  title: string;
  openingMessage: string;
  openingMedia: PlayMedia[];
  closingMessage: string | null;
  stops: { title: string; placeQuery: string | null; media: PlayMedia[] }[];
  locked: boolean;
  priceCents: number;
  paywallMessage: string | null;
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-950 px-6 text-center text-sm text-neutral-400">
      {children}
    </div>
  );
}

export default function PlayerLoader({ slug }: { slug: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [anonId, setAnonId] = useState("");
  const [missing, setMissing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);

  useEffect(() => {
    let id = localStorage.getItem("henry_anon");
    if (!id) {
      id = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
      localStorage.setItem("henry_anon", id);
    }
    setAnonId(id);
    track("open_chat", slug);
    const purchased = new URLSearchParams(location.search).get("purchased") === "1";
    if (purchased) setConfirming(true);
    let cancelled = false;

    async function load(attempt = 0) {
      const res = await fetch("/api/experience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId: id }),
      });
      if (res.status === 404) {
        if (!cancelled) setMissing(true);
        return;
      }
      const d = (await res.json()) as Data;
      // si volvió de comprar y el webhook todavía no confirmó, reintentar
      if (purchased && d.locked && attempt < 6 && !cancelled) {
        setTimeout(() => load(attempt + 1), 1500);
        return;
      }
      // pagó y seguimos sin confirmación: NO re-ofrecer compra (doble cargo);
      // avisar que el pago se está acreditando
      if (purchased && d.locked && !cancelled) {
        setPaymentPending(true);
        setConfirming(false);
        return;
      }
      if (!cancelled) {
        setData(d);
        setConfirming(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (missing) return <Centered>Esta experiencia no está disponible.</Centered>;
  if (paymentPending)
    return (
      <Centered>
        <span>
          Tu pago está confirmándose (a veces tarda un minuto).
          <br />
          Guardá este link y recargá en un rato — no vuelvas a comprar.
          <br />
          <button
            onClick={() => location.reload()}
            className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-neutral-900"
          >
            Reintentar ahora
          </button>
        </span>
      </Centered>
    );
  if (confirming && !data) return <Centered>Confirmando tu compra…</Centered>;
  if (!data || !anonId) return <Centered>Cargando…</Centered>;

  return <PlayerChat anonId={anonId} {...data} />;
}
