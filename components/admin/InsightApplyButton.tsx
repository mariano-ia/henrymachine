"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { applyUtilityFromInsight } from "@/app/admin/(app)/insights/actions";

const CATS = ["Baños", "Agua", "Transporte", "WiFi y carga", "Plata", "Emergencias", "Consejos"];
const inputCls =
  "w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-emerald-400/50";

export default function InsightApplyButton({
  insightId,
  itemIndex,
  utility,
  metricSlug,
  metricStep,
  keywords,
}: {
  insightId: string;
  itemIndex: number;
  utility: { category: string; name: string; neighborhood?: string; henry_note?: string };
  metricSlug?: string | null;
  metricStep?: number | null;
  keywords?: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    category: CATS.includes(utility.category) ? utility.category : "Consejos",
    name: utility.name ?? "",
    neighborhood: utility.neighborhood ?? "",
    henry_note: utility.henry_note ?? "",
  });

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const r = await applyUtilityFromInsight({
        insightId,
        itemIndex,
        utility: {
          category: f.category,
          name: f.name,
          neighborhood: f.neighborhood || null,
          henry_note: f.henry_note || null,
        },
        metricSlug: metricSlug ?? null,
        metricStep: metricStep ?? null,
        keywords: keywords ?? [],
      });
      if (!r.ok) {
        setErr(r.error ?? "No se pudo aplicar.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setErr("No se pudo aplicar. Reintentá.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[13px] font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
      >
        + Agregar a la Guía útil
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-neutral-950 p-3">
      <p className="text-[12px] text-neutral-500">Revisá y confirmá lo que va a la Guía útil (lo lee Henry):</p>
      <div className="grid grid-cols-2 gap-2">
        <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={inputCls}>
          {CATS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          value={f.neighborhood}
          onChange={(e) => setF({ ...f, neighborhood: e.target.value })}
          placeholder="Barrio (opcional)"
          className={inputCls}
        />
      </div>
      <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nombre del lugar/dato" className={inputCls} />
      <textarea
        value={f.henry_note}
        onChange={(e) => setF({ ...f, henry_note: e.target.value })}
        placeholder="El dato en la voz de Henry"
        rows={2}
        className={inputCls}
      />
      {err && <p className="text-[12px] text-red-400">{err}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={busy || !f.name.trim()}
          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {busy ? "Aplicando…" : "Confirmar y agregar"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-[13px] text-neutral-400 hover:text-neutral-200">
          Cancelar
        </button>
      </div>
    </div>
  );
}
