"use client";

import { useEffect, useState } from "react";
import type { IngestResult } from "@/lib/types";

const LOADING_MSGS = [
  "Bajando los subtítulos…",
  "Escuchando cómo habla Henry…",
  "Capturando su tono y sus mañas…",
  "Casi listo…",
];

export default function IngestScreen({
  onReady,
}: {
  onReady: (r: IngestResult) => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<{ url: string; error: string }[]>([]);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(
      () => setMsgIndex((i) => (i + 1) % LOADING_MSGS.length),
      1800
    );
    return () => clearInterval(id);
  }, [loading]);

  async function generate() {
    setError(null);
    setDetails([]);
    const links = text
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);

    if (links.length === 0) {
      setError("Pegá al menos un link de YouTube.");
      return;
    }

    setLoading(true);
    setMsgIndex(0);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo procesar.");
        if (Array.isArray(data.errors)) setDetails(data.errors);
        setLoading(false);
        return;
      }
      onReady({ videos: data.videos, voiceProfile: data.voiceProfile });
    } catch {
      setError("Error de red. Probá de nuevo.");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-2xl font-bold text-white shadow-lg">
          H
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Chateá con Henry</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Pegá hasta 3 videos suyos y hablá con él sobre eso. Responde con su
          info y su voz.
        </p>
      </div>

      <label className="mb-2 block text-sm font-medium text-neutral-700">
        Links de YouTube (uno por línea, hasta 3)
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={loading}
        rows={4}
        placeholder={"https://www.youtube.com/watch?v=...\nhttps://www.youtube.com/watch?v=..."}
        className="w-full resize-none rounded-2xl border border-neutral-300 bg-white p-4 text-sm shadow-sm outline-none placeholder:text-neutral-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
      />

      {error && (
        <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
          {details.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs text-red-600">
              {details.map((d, i) => (
                <li key={i} className="truncate">
                  {d.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        onClick={generate}
        disabled={loading}
        className="mt-5 flex h-12 items-center justify-center rounded-2xl bg-neutral-900 text-base font-semibold text-white shadow-md transition hover:bg-neutral-800 active:scale-[0.99] disabled:opacity-70"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Spinner />
            {LOADING_MSGS[msgIndex]}
          </span>
        ) : (
          "Generar"
        )}
      </button>

      <p className="mt-4 text-center text-xs text-neutral-400">
        Solo responde con lo que está en esos videos.
      </p>
    </main>
  );
}

function Spinner() {
  return (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
  );
}
