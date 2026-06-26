"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NuevoPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [stepCount, setStepCount] = useState(6);
  const [story, setStory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, story, stepCount, city }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo generar.");
        setLoading(false);
        return;
      }
      router.push(`/admin/e/${data.id}`);
    } catch {
      setError("Error de red. Probá de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Link href="/admin" className="text-sm text-neutral-500 hover:text-neutral-300">
        ← Volver
      </Link>
      <h1 className="mt-3 text-xl font-semibold text-white">Nueva experiencia</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Escribí el recorrido en lenguaje natural. Henry lo convierte en pasos que después editás.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="Título">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Las mejores pizzerías de Brooklyn"
              className={inputCls}
            />
          </Field>
          <Field label="Paradas">
            <input
              type="number"
              min={2}
              max={30}
              value={stepCount}
              onChange={(e) => setStepCount(Number(e.target.value))}
              className={`${inputCls} w-24`}
            />
          </Field>
        </div>

        <Field label="Ciudad (opcional)">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Brooklyn, NYC"
            className={inputCls}
          />
        </Field>

        <Field label="El recorrido, contado por vos">
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            required
            rows={10}
            placeholder="Arrancamos en Di Fara, la clásica de Henry; la square slice es imperdible. Después caminamos a L&B Spumoni Gardens por la sliced sicilian…"
            className={`${inputCls} resize-y leading-relaxed`}
          />
        </Field>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200 active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-neutral-900" />
              Generando el recorrido…
            </>
          ) : (
            "Generar experiencia"
          )}
        </button>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-2.5 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-neutral-300">{label}</span>
      {children}
    </label>
  );
}
