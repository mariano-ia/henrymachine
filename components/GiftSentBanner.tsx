"use client";

import { useEffect, useState } from "react";

/** La nota amarilla de Henry cuando terminás de regalar un recorrido. */
export default function GiftSentBanner({ title }: { title: string }) {
  const [to, setTo] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.get("gift") === "sent") setTo(p.get("to"));
  }, []);

  if (!to) return null;

  return (
    <div className="mb-6 rotate-[-0.6deg] bg-brand p-5 shadow-lg" style={{ color: "#1A1A1A" }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Nota de Henry · listo</p>
      <p className="mt-2 font-hand text-[24px] leading-tight">
        ¡Golazo! “{title}” quedó guardado para {to}.
        <br />
        Entrá con ese email en “Mis recorridos” y arrancás cuando quieras. — H.
      </p>
    </div>
  );
}
