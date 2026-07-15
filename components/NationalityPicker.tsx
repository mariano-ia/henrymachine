"use client";

import { useEffect, useState } from "react";
import { flagEmoji, countryName } from "@/lib/country";
import { COUNTRY_OPTIONS, getCountry, setCountry } from "@/lib/nationality";

async function postCountry(anonId: string, iso: string): Promise<boolean> {
  try {
    const r = await fetch("/api/nationality", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId, country: iso }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Al terminar: "¿a qué bandera sumamos tus pasos?". Pre-cargado con el país por
 * IP (si está en la lista); opcional. Al confirmar reescribe el país de las
 * sesiones del anon. Si ya declaró en un tour anterior, re-aplica su país a este
 * (sus sesiones nuevas se crean con el país de la IP hasta este resync).
 */
export default function NationalityPicker({
  anonId,
  detectedCountry,
}: {
  anonId: string;
  detectedCountry: string | null;
}) {
  const [saved, setSaved] = useState<string | null>(() => getCountry());
  const [sel, setSel] = useState<string>(() => {
    const g = getCountry();
    if (g) return g;
    const d = detectedCountry?.toUpperCase() ?? "";
    return COUNTRY_OPTIONS.includes(d) ? d : ""; // detectado fuera de la lista → sin preselección
  });
  const [busy, setBusy] = useState(false);

  // ya declaró antes (otro tour): re-aplica su país a las sesiones de este anon
  useEffect(() => {
    const g = getCountry();
    if (g && anonId) void postCountry(anonId, g);
  }, [anonId]);

  async function confirm() {
    if (!/^[A-Z]{2}$/i.test(sel)) return;
    const iso = sel.toUpperCase();
    setBusy(true);
    const ok = await postCountry(anonId, iso);
    setBusy(false);
    if (!ok) return; // falló (429/500): no marcar guardado, permitir reintento
    setCountry(iso);
    setSaved(iso);
  }

  if (saved) {
    return (
      <p className="mt-3 text-center text-[13px] text-ink/60">
        Sumando tus pasos a {flagEmoji(saved)} {countryName(saved)} 🙌
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-ink/10 bg-white p-3">
      <p className="text-center text-[13px] text-ink/70">¿A qué bandera sumamos tus pasos?</p>
      <div className="mt-2 flex gap-2">
        <select
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          aria-label="Tu país"
          className="min-w-0 flex-1 rounded-full border border-ink/15 bg-white px-3.5 py-2 text-[15px] text-ink outline-none focus:border-ink/40"
        >
          <option value="" disabled>
            Elige tu país
          </option>
          {COUNTRY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {flagEmoji(c)} {countryName(c)}
            </option>
          ))}
        </select>
        <button
          onClick={confirm}
          disabled={busy || !sel}
          className="shrink-0 rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {busy ? "…" : "Listo"}
        </button>
      </div>
    </div>
  );
}
