"use client";

import ShareButton from "@/components/ShareButton";

/** Botón para compartir el ranking de países (client: usa Web Share). */
export default function LeaderboardShare() {
  return (
    <ShareButton
      label="Compartir el ranking 🌎"
      text="Mira qué países caminan más Nueva York con Henry"
      url="https://caminaconhenry.com/?ref=ranking#ranking"
      className="mt-3 w-full rounded-full border border-ink/15 py-2 text-[12px] font-semibold text-ink/70 transition hover:bg-ink/5"
    />
  );
}
