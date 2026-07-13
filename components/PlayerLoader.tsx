"use client";

import { useEffect, useState } from "react";
import PlayerChat from "./PlayerChat";
import type { PlayMedia } from "@/lib/db/experiences";

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

  useEffect(() => {
    let id = localStorage.getItem("henry_anon");
    if (!id) {
      id = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
      localStorage.setItem("henry_anon", id);
    }
    setAnonId(id);
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
  if (confirming && !data) return <Centered>Confirmando tu compra…</Centered>;
  if (!data || !anonId) return <Centered>Cargando…</Centered>;

  return <PlayerChat anonId={anonId} {...data} />;
}
