"use client";

import { useState } from "react";

const SHARE_URL = "https://caminaconhenry.com/?ref=ranking#ranking";
const SHARE_TEXT = "Mira qué países caminan más Nueva York con Henry 🌎";

/** Comparte una IMAGEN del ranking (mucho más viral que un link). En mobile va
 *  como archivo por el share nativo; en desktop abre la imagen + copia el link. */
export default function LeaderboardShare() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function share() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ranking-image");
      const blob = await res.blob();
      const file = new File([blob], "ranking-henry.png", { type: "image/png" });

      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: SHARE_TEXT });
        return;
      }
      // fallback (desktop / sin file-share): abrir la imagen para guardarla + copiar link
      window.open(URL.createObjectURL(blob), "_blank");
      try {
        await navigator.clipboard.writeText(`${SHARE_TEXT} ${SHARE_URL}`);
        setMsg("Imagen abierta · link copiado");
      } catch {
        setMsg("Imagen abierta");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${SHARE_TEXT} ${SHARE_URL}`);
        setMsg("¡Link copiado!");
      } catch {
        setMsg("No se pudo compartir");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={share}
      disabled={busy}
      className="mt-3 w-full rounded-full border border-ink/15 py-2 text-[12px] font-semibold text-ink/70 transition hover:bg-ink/5 disabled:opacity-60"
    >
      {busy ? "Generando…" : msg ?? "Compartir el ranking 🌎"}
    </button>
  );
}
