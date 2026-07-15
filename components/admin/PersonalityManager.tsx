"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PersonalitySource, HenryPersona } from "@/lib/db/persona";

const KIND_ICON: Record<string, string> = {
  youtube: "▶︎",
  video: "🎬",
  audio: "🎧",
  pdf: "📄",
  image: "🖼️",
  text: "✍️",
};
const KIND_LABEL: Record<string, string> = {
  youtube: "YouTube",
  video: "Video",
  audio: "Audio",
  pdf: "PDF",
  image: "Imagen",
  text: "Texto",
};

function kindFromMime(m: string): PersonalitySource["kind"] | null {
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("video/")) return "video";
  return null;
}

const box =
  "w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-indigo-400/50";

export default function PersonalityManager({
  sources,
  dossier,
}: {
  sources: PersonalitySource[];
  dossier: HenryPersona | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [ytUrl, setYtUrl] = useState("");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const doneCount = sources.filter((s) => s.status === "done").length;

  async function processSource(id: string) {
    setProcessing(id);
    try {
      const r = await fetch("/api/admin/persona/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (d.status === "error") setMsg({ kind: "err", text: `No se pudo procesar: ${d.error ?? ""}` });
    } catch {
      setMsg({ kind: "err", text: "Se cortó al procesar. Prueba 'Reprocesar'." });
    }
    setProcessing(null);
    router.refresh();
  }

  async function add(payload: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/persona/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!d.id) {
        setMsg({ kind: "err", text: d.error ?? "No se pudo agregar." });
        setBusy(false);
        return;
      }
      router.refresh();
      await processSource(d.id);
    } catch {
      setMsg({ kind: "err", text: "No se pudo agregar la fuente." });
    }
    setBusy(false);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const kind = kindFromMime(file.type);
    if (!kind) {
      setMsg({ kind: "err", text: "Tipo de archivo no soportado (video, audio, PDF o imagen)." });
      return;
    }
    setBusy(true);
    setMsg({ kind: "ok", text: "Subiendo archivo…" });
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = `${crypto.randomUUID()}-${safe}`;
    const sb = createClient();
    const { error } = await sb.storage
      .from("personality-sources")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      setMsg({ kind: "err", text: "No se pudo subir el archivo." });
      setBusy(false);
      return;
    }
    await add({ kind, title: file.name, storagePath: path, mimeType: file.type });
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch("/api/admin/persona/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      /* noop */
    }
    setBusy(false);
    router.refresh();
  }

  async function regenerate() {
    setBusy(true);
    setMsg({ kind: "ok", text: "Regenerando dossier…" });
    try {
      const r = await fetch("/api/admin/persona/regenerate", { method: "POST" });
      const d = await r.json();
      setMsg(d.ok ? { kind: "ok", text: "Dossier regenerado." } : { kind: "err", text: d.error ?? "No se pudo." });
    } catch {
      setMsg({ kind: "err", text: "No se pudo regenerar." });
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-white">Personalidad de Henry</h1>
        <span className="text-[12px] text-neutral-500">{doneCount} fuente(s) en el dossier</span>
      </div>
      <p className="mt-1 text-sm text-neutral-400">
        Suma fuentes (video, audio, PDF, imagen, link de YouTube o texto). Gemini extrae de cada
        una cómo es y cómo habla Henry, y el dossier se arma juntando todas — es acumulativo.
      </p>

      {msg && (
        <p
          className={
            "mt-4 rounded-lg px-4 py-2.5 text-sm " +
            (msg.kind === "ok" ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-300")
          }
        >
          {msg.text}
        </p>
      )}

      {/* ---- AGREGAR FUENTE ---- */}
      <section className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-neutral-900/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label
            className={
              "cursor-pointer rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5 " +
              (busy ? "pointer-events-none opacity-50" : "")
            }
          >
            + Subir archivo
            <input
              type="file"
              accept="video/*,audio/*,application/pdf,image/*"
              className="hidden"
              disabled={busy}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          <span className="text-[12px] text-neutral-500">video · audio · PDF · imagen</span>
        </div>

        <div className="flex gap-2">
          <input
            value={ytUrl}
            onChange={(e) => setYtUrl(e.target.value)}
            disabled={busy}
            placeholder="Pega un link de YouTube"
            className={box}
          />
          <button
            onClick={() => {
              if (!ytUrl.trim()) return;
              add({ kind: "youtube", externalUrl: ytUrl.trim(), title: ytUrl.trim() });
              setYtUrl("");
            }}
            disabled={busy || !ytUrl.trim()}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-40"
          >
            Sumar
          </button>
        </div>

        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            rows={2}
            placeholder="…o pega un texto (una bio, una nota, una entrevista)"
            className={box}
          />
          <button
            onClick={() => {
              if (text.trim().length < 10) return;
              add({ kind: "text", rawText: text.trim(), title: "Texto pegado" });
              setText("");
            }}
            disabled={busy || text.trim().length < 10}
            className="shrink-0 self-start rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-40"
          >
            Sumar
          </button>
        </div>
        <p className="text-[11px] leading-snug text-neutral-500">
          Los videos muy largos subidos pueden tardar; para esos conviene el link de YouTube (Gemini
          los procesa sin subirlos).
        </p>
      </section>

      {/* ---- DOSSIER ACTUAL ---- */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-neutral-900/40 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Dossier actual</h2>
          <button
            onClick={regenerate}
            disabled={busy || doneCount === 0}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-white/5 disabled:opacity-40"
          >
            Regenerar
          </button>
        </div>
        {dossier?.bio || dossier?.voice ? (
          <div className="mt-3 space-y-3">
            {dossier.bio && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Bio</p>
                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-300">{dossier.bio}</p>
              </div>
            )}
            {dossier.voice && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Voz</p>
                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-300">{dossier.voice}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-neutral-500">
            Todavía no hay dossier. Suma una fuente y se arma solo.
          </p>
        )}
      </section>

      {/* ---- FUENTES ---- */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-white">Fuentes ({sources.length})</h2>
        {sources.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-neutral-500">
            Todavía no sumaste fuentes.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {sources.map((s) => (
              <li key={s.id} className="rounded-xl border border-white/10 bg-neutral-900/40 p-3.5">
                <div className="flex items-start gap-3">
                  <span className="text-lg leading-none">{KIND_ICON[s.kind] ?? "•"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-white">
                        {s.title || KIND_LABEL[s.kind]}
                      </span>
                      <StatusBadge status={processing === s.id ? "processing" : s.status} />
                    </div>
                    {s.notes && (
                      <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-[12px] leading-snug text-neutral-400">
                        {s.notes}
                      </p>
                    )}
                    {s.status === "error" && s.error && (
                      <p className="mt-1 text-[12px] text-red-300">{s.error}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {(s.status === "error" || s.status === "pending") && processing !== s.id && (
                      <button
                        onClick={() => processSource(s.id)}
                        disabled={busy}
                        className="text-[12px] font-medium text-indigo-300 transition hover:text-indigo-200 disabled:opacity-40"
                      >
                        {s.status === "error" ? "Reprocesar" : "Procesar"}
                      </button>
                    )}
                    <button
                      onClick={() => remove(s.id)}
                      disabled={busy || processing === s.id}
                      className="text-[12px] text-neutral-600 transition hover:text-red-400 disabled:opacity-40"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { t: string; c: string }> = {
    pending: { t: "pendiente", c: "bg-white/5 text-neutral-400" },
    processing: { t: "procesando…", c: "bg-indigo-500/15 text-indigo-200" },
    done: { t: "listo", c: "bg-emerald-500/15 text-emerald-200" },
    error: { t: "error", c: "bg-red-500/15 text-red-300" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide " + s.c}>
      {s.t}
    </span>
  );
}
