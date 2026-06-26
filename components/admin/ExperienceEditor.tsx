"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  saveExperience,
  publishExperience,
  unpublishExperience,
  deleteExperience,
} from "@/app/admin/(app)/e/[id]/actions";
import MediaSection, { type MediaItem } from "@/components/admin/MediaSection";

type Step = {
  id: string;
  position: number;
  type: string;
  title: string | null;
  body: string | null;
  proposal: string | null;
  walk_to_next: string | null;
  place_query: string | null;
  address: string | null;
  is_paywall: boolean;
  paywall_message: string | null;
};
type Experience = {
  id: string;
  slug: string;
  title: string;
  pitch: string | null;
  city: string | null;
  status: string;
  price_cents: number;
};

const ta =
  "w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-500/20";

export default function ExperienceEditor({
  experience,
  steps: initialSteps,
  media,
}: {
  experience: Experience;
  steps: Step[];
  media: Record<string, MediaItem[]>;
}) {
  const published = experience.status === "published";
  const [title, setTitle] = useState(experience.title);
  const [pitch, setPitch] = useState(experience.pitch ?? "");
  const [city, setCity] = useState(experience.city ?? "");
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const ro = published; // read-only mientras está publicada (inmutable)

  function patch(id: string, field: keyof Step, value: string) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  function save() {
    start(async () => {
      const r = await saveExperience({
        id: experience.id,
        title,
        pitch: pitch || null,
        city: city || null,
        steps: steps.map((s) => ({
          id: s.id,
          title: s.title,
          body: s.body,
          proposal: s.proposal,
          walk_to_next: s.walk_to_next,
          place_query: s.place_query,
          address: s.address,
        })),
      });
      setMsg(r.ok ? { kind: "ok", text: "Guardado." } : { kind: "err", text: r.error ?? "Error" });
    });
  }
  function publish() {
    start(async () => {
      const r = await publishExperience(experience.id);
      setMsg(r.ok ? { kind: "ok", text: "¡Publicada!" } : { kind: "err", text: r.error ?? "Error" });
    });
  }
  function unpublish() {
    start(async () => {
      await unpublishExperience(experience.id);
      setMsg({ kind: "ok", text: "Despublicada — ya podés editar." });
    });
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/admin" className="text-sm text-neutral-500 hover:text-neutral-300">
          ← Experiencias
        </Link>
        <div className="flex items-center gap-2">
          {published ? (
            <>
              <Link
                href={`/e/${experience.slug}`}
                target="_blank"
                className="rounded-lg px-3 py-1.5 text-sm text-neutral-300 hover:bg-white/5"
              >
                Jugar
              </Link>
              <button
                onClick={unpublish}
                disabled={pending}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-50"
              >
                Despublicar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={save}
                disabled={pending}
                className="rounded-lg border border-white/10 px-4 py-1.5 text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-50"
              >
                {pending ? "Guardando…" : "Guardar"}
              </button>
              <button
                onClick={publish}
                disabled={pending}
                className="rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-200 disabled:opacity-50"
              >
                Publicar
              </button>
            </>
          )}
        </div>
      </div>

      {msg && (
        <p
          className={`mb-4 rounded-lg px-3 py-2 text-sm ${
            msg.kind === "ok" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"
          }`}
        >
          {msg.text}
        </p>
      )}

      {published && (
        <p className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Publicada (inmutable). Despublicá para editar el contenido.
        </p>
      )}

      {/* meta */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-neutral-900/40 p-5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={ro}
          className="w-full bg-transparent text-lg font-semibold text-white outline-none disabled:opacity-70"
          placeholder="Título"
        />
        <input
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          disabled={ro}
          className="w-full bg-transparent text-sm text-neutral-400 outline-none disabled:opacity-70"
          placeholder="Pitch (una línea vendedora)"
        />
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span>/{experience.slug}</span>
          <span>·</span>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={ro}
            className="bg-transparent text-neutral-400 outline-none disabled:opacity-70"
            placeholder="Ciudad"
          />
        </div>
      </div>

      {/* pasos */}
      <h2 className="mb-3 mt-8 text-sm font-medium uppercase tracking-wide text-neutral-500">
        Pasos ({steps.length})
      </h2>
      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.id} className="rounded-2xl border border-white/10 bg-neutral-900/40 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-xs font-medium text-neutral-400">
                {s.position}
              </span>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                {labelType(s.type)}
              </span>
              <input
                value={s.title ?? ""}
                onChange={(e) => patch(s.id, "title", e.target.value)}
                disabled={ro}
                placeholder="Título del paso"
                className="flex-1 bg-transparent text-sm font-medium text-white outline-none disabled:opacity-70"
              />
            </div>

            {s.type === "message" ? (
              <textarea
                value={s.body ?? ""}
                onChange={(e) => patch(s.id, "body", e.target.value)}
                disabled={ro}
                rows={3}
                placeholder="Lo que dice Henry"
                className={`${ta} disabled:opacity-70`}
              />
            ) : (
              <div className="space-y-2">
                <textarea
                  value={s.proposal ?? ""}
                  onChange={(e) => patch(s.id, "proposal", e.target.value)}
                  disabled={ro}
                  rows={2}
                  placeholder="Qué propone Henry en esta parada"
                  className={`${ta} disabled:opacity-70`}
                />
                <input
                  value={s.walk_to_next ?? ""}
                  onChange={(e) => patch(s.id, "walk_to_next", e.target.value)}
                  disabled={ro}
                  placeholder="Cómo seguir a la próxima"
                  className={`${ta} disabled:opacity-70`}
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    value={s.place_query ?? ""}
                    onChange={(e) => patch(s.id, "place_query", e.target.value)}
                    disabled={ro}
                    placeholder="Lugar (para Maps)"
                    className={`${ta} disabled:opacity-70`}
                  />
                  <input
                    value={s.address ?? ""}
                    onChange={(e) => patch(s.id, "address", e.target.value)}
                    disabled={ro}
                    placeholder="Dirección (opcional)"
                    className={`${ta} disabled:opacity-70`}
                  />
                </div>
              </div>
            )}

            <MediaSection
              experienceId={experience.id}
              stepId={s.id}
              items={media[s.id] ?? []}
              disabled={ro}
            />
          </li>
        ))}
      </ol>

      <div className="mt-10 border-t border-white/5 pt-5">
        <form action={deleteExperience.bind(null, experience.id)}>
          <button
            type="submit"
            className="text-sm text-red-400/70 transition hover:text-red-400"
          >
            Borrar experiencia
          </button>
        </form>
      </div>
    </div>
  );
}

function labelType(t: string): string {
  return (
    { message: "Mensaje", arrival: "Parada", media: "Media", interactive: "Chat", paywall: "Paywall" }[t] ??
    t
  );
}
