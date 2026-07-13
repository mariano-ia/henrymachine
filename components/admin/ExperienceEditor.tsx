"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  saveExperience,
  publishExperience,
  unpublishExperience,
  deleteExperience,
  setPricing,
  addStep,
  deleteStep,
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

  const paywallStep = initialSteps.find((s) => s.is_paywall) ?? null;
  const [priceDollars, setPriceDollars] = useState(
    experience.price_cents ? (experience.price_cents / 100).toString() : ""
  );
  const [paywallAfter, setPaywallAfter] = useState<number>(
    paywallStep ? paywallStep.position - 1 : Math.max(1, Math.ceil(initialSteps.length / 2))
  );
  const [paywallMsg, setPaywallMsg] = useState(paywallStep?.paywall_message ?? "");

  const ro = false; // las experiencias se pueden editar siempre, también publicadas

  const router = useRouter();

  function patch(id: string, field: keyof Step, value: string) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  function savePayload() {
    return {
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
    };
  }

  function save() {
    start(async () => {
      const r = await saveExperience(savePayload());
      setMsg(r.ok ? { kind: "ok", text: "Guardado." } : { kind: "err", text: r.error ?? "Error" });
    });
  }

  function addStepAt(afterPosition: number, type: "message" | "arrival") {
    start(async () => {
      // primero guardo lo editado, para no perderlo al recargar la lista
      const s1 = await saveExperience(savePayload());
      if (!s1.ok) {
        setMsg({ kind: "err", text: s1.error ?? "Error al guardar antes de agregar" });
        return;
      }
      const r = await addStep({ experienceId: experience.id, afterPosition, type });
      if (!r.ok) setMsg({ kind: "err", text: r.error ?? "Error" });
      else {
        setMsg({ kind: "ok", text: type === "arrival" ? "Parada agregada." : "Mensaje agregado." });
        router.refresh();
      }
    });
  }

  function removeStep(s: Step) {
    const name = s.title ? ` · ${s.title}` : "";
    if (!confirm(`¿Borrar el paso ${s.position}${name}? Se borra también su multimedia.`)) return;
    start(async () => {
      const s1 = await saveExperience(savePayload());
      if (!s1.ok) {
        setMsg({ kind: "err", text: s1.error ?? "Error al guardar antes de borrar" });
        return;
      }
      const r = await deleteStep({ stepId: s.id, experienceId: experience.id });
      if (!r.ok) setMsg({ kind: "err", text: r.error ?? "Error" });
      else {
        setMsg({ kind: "ok", text: "Paso borrado." });
        router.refresh();
      }
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
  // pasos de contenido (sin contar la fila del paywall): el paywall válido va
  // después de un paso entre 1 y contentCount-1 (tiene que quedar algo para vender)
  const contentCount = steps.filter((s) => !s.is_paywall).length;
  const maxPaywallAfter = Math.max(1, contentCount - 1);

  function savePricing() {
    const cents = Math.round(parseFloat(priceDollars || "0") * 100);
    const priceCents = Number.isFinite(cents) && cents > 0 ? cents : 0;
    if (priceCents > 0) {
      if (contentCount < 2) {
        setMsg({ kind: "err", text: "Se necesitan al menos 2 pasos para poner un paywall." });
        return;
      }
      if (!Number.isInteger(paywallAfter) || paywallAfter < 1 || paywallAfter > maxPaywallAfter) {
        setMsg({
          kind: "err",
          text: `"Gratis hasta el paso" tiene que estar entre 1 y ${maxPaywallAfter}: tiene que quedar al menos un paso pago detrás del paywall.`,
        });
        return;
      }
    }
    start(async () => {
      // primero guardo lo editado: el RPC re-crea el paywall y el editor se remonta
      const s1 = await saveExperience(savePayload());
      if (!s1.ok) {
        setMsg({ kind: "err", text: s1.error ?? "Error al guardar antes del precio" });
        return;
      }
      const r = await setPricing({
        experienceId: experience.id,
        priceCents,
        paywallAfter,
        message: paywallMsg || null,
        title,
      });
      if (!r.ok) setMsg({ kind: "err", text: r.error ?? "Error" });
      else {
        setMsg({
          kind: "ok",
          text: priceCents > 0 ? "Precio y paywall guardados." : "Marcada como gratis.",
        });
        router.refresh();
      }
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
                onClick={save}
                disabled={pending}
                className="rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-200 disabled:opacity-50"
              >
                {pending ? "Guardando…" : "Guardar"}
              </button>
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
        <p className="mb-4 rounded-lg bg-sky-500/10 px-3 py-2 text-sm text-sky-200">
          Publicada y en vivo. Editá y tocá <span className="font-medium">Guardar</span>: los cambios
          se aplican al instante para quien la juegue.
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

      {/* monetización */}
      {!ro && (
        <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-neutral-900/40 p-5">
          <h2 className="text-sm font-medium text-neutral-300">Monetización</h2>
          <div className="flex flex-wrap items-end gap-4">
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-500">Precio (USD · 0 = gratis)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                className="w-32 rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400/50"
              />
            </label>
            {Number(priceDollars) > 0 && (
              <label className="block">
                <span className="mb-1 block text-xs text-neutral-500">Gratis hasta el paso</span>
                <input
                  type="number"
                  min={1}
                  max={maxPaywallAfter}
                  value={paywallAfter}
                  onChange={(e) => setPaywallAfter(Number(e.target.value))}
                  className="w-24 rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400/50"
                />
              </label>
            )}
          </div>
          {Number(priceDollars) > 0 && (
            <textarea
              value={paywallMsg}
              onChange={(e) => setPaywallMsg(e.target.value)}
              rows={2}
              placeholder="Mensaje del paywall (lo que ve el usuario antes de comprar)"
              className={ta}
            />
          )}
          <button
            onClick={savePricing}
            disabled={pending}
            className="rounded-lg border border-white/10 px-4 py-1.5 text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar precio"}
          </button>
          <p className="text-xs text-neutral-600">
            Al guardar un precio se crea el producto en Stripe y se inserta el paso de paywall.
          </p>
        </div>
      )}

      {/* pasos */}
      <h2 className="mb-3 mt-8 text-sm font-medium uppercase tracking-wide text-neutral-500">
        Pasos ({steps.length})
      </h2>
      {steps.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center">
          <p className="mb-3 text-sm text-neutral-500">Esta experiencia no tiene pasos todavía.</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => addStepAt(0, "message")}
              disabled={pending}
              className="rounded-lg border border-white/10 px-4 py-1.5 text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-50"
            >
              + Mensaje de apertura
            </button>
            <button
              onClick={() => addStepAt(0, "arrival")}
              disabled={pending}
              className="rounded-lg border border-white/10 px-4 py-1.5 text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-50"
            >
              + Primera parada
            </button>
          </div>
        </div>
      )}
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
              {!s.is_paywall && (
                <button
                  onClick={() => removeStep(s)}
                  disabled={pending}
                  title="Borrar paso"
                  className="shrink-0 rounded-md px-1.5 text-lg leading-none text-neutral-600 transition hover:text-red-400 disabled:opacity-40"
                >
                  ×
                </button>
              )}
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

            {/* el paso paywall se borra y re-crea al guardar precio: no aceptar media ahí */}
            {!s.is_paywall && (
              <MediaSection
                experienceId={experience.id}
                stepId={s.id}
                items={media[s.id] ?? []}
                disabled={ro}
              />
            )}

            {/* alta de pasos debajo de éste */}
            <div className="mt-3 flex gap-3 border-t border-white/5 pt-2.5">
              <button
                onClick={() => addStepAt(s.position, "arrival")}
                disabled={pending}
                className="text-xs font-medium text-neutral-500 transition hover:text-white disabled:opacity-40"
              >
                + Parada debajo
              </button>
              <button
                onClick={() => addStepAt(s.position, "message")}
                disabled={pending}
                className="text-xs font-medium text-neutral-500 transition hover:text-white disabled:opacity-40"
              >
                + Mensaje debajo
              </button>
            </div>
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
