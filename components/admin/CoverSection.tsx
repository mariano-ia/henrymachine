"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setCover } from "@/app/admin/(app)/e/[id]/actions";

export const isVideoCover = (p: string) => /\.(mp4|webm|mov|m4v)$/i.test(p);

function publicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/experience-covers/${path}`;
}

/** Portada del hero (imagen/video) o imagen cuadrada de card, bucket público. */
export default function CoverSection({
  experienceId,
  coverPath,
  field = "cover_path",
  label = "Portada del hero (imagen o video)",
  imageOnly = false,
}: {
  experienceId: string;
  coverPath: string | null;
  field?: "cover_path" | "card_image_path";
  label?: string;
  imageOnly?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const okType = imageOnly
      ? file.type.startsWith("image/")
      : file.type.startsWith("image/") || file.type.startsWith("video/");
    if (!okType) {
      setErr(imageOnly ? "Solo imagen." : "Solo imagen o video.");
      return;
    }
    setBusy(true);
    setErr(null);
    const sb = createClient();
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const path = `${experienceId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage
      .from("experience-covers")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) {
      setErr("No se pudo subir.");
      setBusy(false);
      return;
    }
    const r = await setCover({ experienceId, path, oldPath: coverPath, field });
    if (!r.ok) setErr(r.error ?? "Error al guardar la imagen.");
    setBusy(false);
    e.target.value = "";
    router.refresh();
  }

  async function remove() {
    if (!coverPath || busy) return;
    setBusy(true);
    setErr(null);
    const r = await setCover({ experienceId, path: null, oldPath: coverPath, field });
    if (!r.ok) setErr(r.error ?? "Error al quitar la imagen.");
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <span className="mb-1.5 block text-xs text-neutral-500">{label}</span>
      <div className="flex items-center gap-3">
        {coverPath ? (
          isVideoCover(coverPath) ? (
            <video
              src={publicUrl(coverPath)}
              muted
              loop
              autoPlay
              playsInline
              className="h-24 w-40 rounded-lg object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={publicUrl(coverPath)}
              alt="Portada"
              className="h-24 w-40 rounded-lg object-cover"
            />
          )
        ) : (
          <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-dashed border-white/15 text-xs text-neutral-600">
            Sin portada
          </div>
        )}
        <div className="flex flex-col gap-2">
          <label className="cursor-pointer rounded-lg border border-white/10 px-3 py-1.5 text-center text-xs text-neutral-300 transition hover:bg-white/5">
            {busy ? "Subiendo…" : coverPath ? "Cambiar" : "Subir"}
            <input
              type="file"
              accept={imageOnly ? "image/*" : "image/*,video/*"}
              onChange={onFile}
              disabled={busy}
              className="hidden"
            />
          </label>
          {coverPath && (
            <button
              onClick={remove}
              disabled={busy}
              className="text-xs text-neutral-600 transition hover:text-red-400 disabled:opacity-40"
            >
              Quitar
            </button>
          )}
        </div>
      </div>
      {err && <p className="mt-1.5 text-xs text-red-300">{err}</p>}
    </div>
  );
}
