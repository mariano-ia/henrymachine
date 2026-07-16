"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** "Analizar ahora": corre el análisis y refresca la página. */
export default function InsightsRunButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/insights/run", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Falló el análisis.");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={busy}
        className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-60"
      >
        {busy ? "Analizando…" : "Analizar ahora"}
      </button>
      {err && <span className="text-sm text-red-400">{err}</span>}
    </div>
  );
}
