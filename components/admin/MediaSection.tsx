"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addStepMedia, deleteStepMedia } from "@/app/admin/(app)/e/[id]/actions";

export type MediaItem = {
  id: string;
  kind: "video" | "image" | "audio";
  storagePath: string | null;
  caption: string | null;
  url: string | null;
};

function kindFromType(t: string): "video" | "image" | "audio" | null {
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("audio/")) return "audio";
  return null;
}

export default function MediaSection({
  experienceId,
  stepId,
  items,
  disabled,
}: {
  experienceId: string;
  stepId: string;
  items: MediaItem[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const kind = kindFromType(file.type);
    if (!kind) {
      setErr("Solo video, imagen o audio.");
      return;
    }
    setUploading(true);
    setErr(null);
    const sb = createClient();
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const path = `${experienceId}/${stepId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage
      .from("experience-media")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) {
      setErr("No se pudo subir.");
      setUploading(false);
      return;
    }
    const r = await addStepMedia({ experienceId, stepId, kind, storagePath: path });
    if (!r.ok) setErr(r.error ?? "Error al registrar.");
    setUploading(false);
    e.target.value = "";
    router.refresh();
  }

  function remove(m: MediaItem) {
    start(async () => {
      await deleteStepMedia({ mediaId: m.id, experienceId, storagePath: m.storagePath });
      router.refresh();
    });
  }

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        {items.map((m) => (
          <div key={m.id} className="group relative">
            {m.kind === "image" && m.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.url} alt="" className="h-16 w-16 rounded-lg object-cover" />
            )}
            {m.kind === "video" && m.url && (
              <video src={m.url} className="h-16 w-24 rounded-lg object-cover" muted />
            )}
            {m.kind === "audio" &&
              (m.url ? (
                <audio src={m.url} controls preload="metadata" className="h-10 w-60" />
              ) : (
                <div className="flex h-16 items-center rounded-lg bg-white/5 px-3 text-xs text-neutral-400">
                  🎧 audio
                </div>
              ))}
            {!disabled && (
              <button
                onClick={() => remove(m)}
                className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-neutral-800 text-xs text-neutral-300 ring-1 ring-white/10 group-hover:flex"
                aria-label="Borrar"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {!disabled && (
          <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-white/15 text-xs text-neutral-500 transition hover:border-white/30 hover:text-neutral-300">
            {uploading ? "…" : "+ Media"}
            <input
              type="file"
              accept="video/*,image/*,audio/*"
              onChange={onFile}
              disabled={uploading}
              className="hidden"
            />
          </label>
        )}
      </div>
      {err && <p className="mt-1.5 text-xs text-red-300">{err}</p>}
    </div>
  );
}
