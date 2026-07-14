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
import CoverSection from "@/components/admin/CoverSection";
import { THEMES } from "@/lib/themes";

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
  neighborhood: string | null;
  theme: string | null;
  expected_minutes: number | null;
  distance_m: number | null;
  henry_tip: string | null;
  cover_path: string | null;
  card_image_path: string | null;
  upsell_experience_id: string | null;
  upsell_message: string | null;
  upsell_promo_code: string | null;
  status: string;
  price_cents: number;
};

const ta =
  "w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-500/20";

export default function ExperienceEditor({
  experience,
  steps: initialSteps,
  media,
  otherExperiences = [],
}: {
  experience: Experience;
  steps: Step[];
  media: Record<string, MediaItem[]>;
  otherExperiences?: { id: string; title: string }[];
}) {
  const published = experience.status === "published";
  const [title, setTitle] = useState(experience.title);
  const [pitch, setPitch] = useState(experience.pitch ?? "");
  const [city, setCity] = useState(experience.city ?? "");
  const [neighborhood, setNeighborhood] = useState(experience.neighborhood ?? "");
  const [theme, setTheme] = useState(experience.theme ?? "");
  const [durationMin, setDurationMin] = useState(
    experience.expected_minutes ? String(experience.expected_minutes) : ""
  );
  const [distanceKm, setDistanceKm] = useState(
    experience.distance_m ? String(experience.distance_m / 1000) : ""
  );
  const [henryTip, setHenryTip] = useState(experience.henry_tip ?? "");
  const [upsellId, setUpsellId] = useState(experience.upsell_experience_id ?? "");
  const [upsellMsg, setUpsellMsg] = useState(experience.upsell_message ?? "");
  const [upsellPromo, setUpsellPromo] = useState(experience.upsell_promo_code ?? "");
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const paywallStep = initialSteps.find((s) => s.is_paywall) ?? null;
  const arrivalsInit = initialSteps.filter((s) => s.type === "arrival");
  const [priceDollars, setPriceDollars] = useState(
    experience.price_cents ? (experience.price_cents / 100).toString() : ""
  );
  // el autor piensa en PARADAS gratis (el timeline público muestra paradas);
  // la posición del paso del paywall se calcula recién al guardar
  const initialFreeStops = paywallStep
    ? arrivalsInit.filter((a) => a.position < paywallStep.position).length
    : Math.max(1, Math.ceil(arrivalsInit.length / 2));
  const [freeStops, setFreeStops] = useState<number>(initialFreeStops);
  const [paywallMsg, setPaywallMsg] = useState(paywallStep?.paywall_message ?? "");

  const ro = false; // las experiencias se pueden editar siempre, también publicadas

  const router = useRouter();

  function patch(id: string, field: keyof Step, value: string) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  function savePayload() {
    const mins = parseInt(durationMin, 10);
    const km = parseFloat(distanceKm.replace(",", "."));
    return {
      id: experience.id,
      title,
      pitch: pitch || null,
      city: city || null,
      neighborhood: neighborhood.trim() || null,
      theme: theme || null,
      expectedMinutes: Number.isFinite(mins) && mins > 0 ? mins : null,
      distanceM: Number.isFinite(km) && km > 0 ? Math.round(km * 1000) : null,
      henryTip: henryTip.trim() || null,
      upsellExperienceId: upsellId || null,
      upsellMessage: upsellMsg.trim() || null,
      upsellPromoCode: upsellPromo.trim().toUpperCase() || null,
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

  // UN solo "Guardar": campos + pasos + (si cambió) precio/paywall.
  // Stripe solo se toca cuando la parte de precios está sucia.
  function save() {
    const cents = Math.round(parseFloat(priceDollars || "0") * 100);
    const priceCents = Number.isFinite(cents) && cents > 0 ? cents : 0;
    const pricingDirty =
      priceCents !== experience.price_cents ||
      (priceCents > 0 &&
        (freeStops !== initialFreeStops ||
          paywallMsg !== (paywallStep?.paywall_message ?? "")));

    if (pricingDirty && priceCents > 0) {
      if (arrivalSteps.length < 2) {
        setMsg({ kind: "err", text: "Se necesitan al menos 2 paradas para poner un paywall." });
        return;
      }
      if (!Number.isInteger(freeStops) || freeStops < 1 || freeStops > maxFreeStops) {
        setMsg({
          kind: "err",
          text: `"Paradas gratis" tiene que estar entre 1 y ${maxFreeStops}: tiene que quedar al menos una parada paga detrás del paywall.`,
        });
        return;
      }
    }
    // traducir paradas → posición de paso (lista renumerada sin el paywall actual)
    const lastFree = arrivalSteps[freeStops - 1];
    const paywallAfter =
      priceCents > 0 && lastFree ? contentSteps.indexOf(lastFree) + 1 : null;

    start(async () => {
      const r = await saveExperience(savePayload());
      if (!r.ok) {
        setMsg({ kind: "err", text: r.error ?? "Error" });
        return;
      }
      if (!pricingDirty) {
        setMsg({ kind: "ok", text: r.warning ? `Guardado. ⚠ ${r.warning}` : "Guardado." });
        return;
      }
      const p = await setPricing({
        experienceId: experience.id,
        priceCents,
        paywallAfter,
        message: paywallMsg || null,
        title,
      });
      if (!p.ok) {
        setMsg({ kind: "err", text: p.error ?? "Error" });
        return;
      }
      setMsg({
        kind: "ok",
        text:
          priceCents > 0
            ? "Guardado — precio y paywall actualizados."
            : "Guardado — marcada como gratis.",
      });
      router.refresh();
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
  // paradas de contenido: el paywall va después de una parada entre 1 y n-1
  // (tiene que quedar al menos una parada paga detrás)
  const contentSteps = steps.filter((s) => !s.is_paywall);
  const arrivalSteps = contentSteps.filter((s) => s.type === "arrival");
  const maxFreeStops = Math.max(1, arrivalSteps.length - 1);
  const arrivalOrdinal = new Map<string, number>();
  arrivalSteps.forEach((s, i) => arrivalOrdinal.set(s.id, i + 1));

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

      {/* meta: todo lo que se ve en la card del catálogo y el encabezado del detalle */}
      <div className="space-y-4 rounded-2xl border border-white/10 bg-neutral-900/40 p-5">
        <div>
          <span className="mb-1.5 block text-xs text-neutral-500">Título</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={ro}
            className={`${ta} text-base font-semibold disabled:opacity-70`}
            placeholder="Título"
          />
        </div>
        <div>
          <span className="mb-1.5 block text-xs text-neutral-500">
            Pitch <span className="text-neutral-600">(una línea vendedora, va debajo del título)</span>
          </span>
          <input
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            disabled={ro}
            className={`${ta} disabled:opacity-70`}
            placeholder="Henry te lleva 12 horas por Nueva York…"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-xs text-neutral-500">Ciudad</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={ro}
              className={`${ta} disabled:opacity-70`}
              placeholder="Nueva York"
            />
          </div>
          <div>
            <span className="mb-1.5 block text-xs text-neutral-500">Barrio / zona</span>
            <input
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              disabled={ro}
              className={`${ta} disabled:opacity-70`}
              placeholder="Brooklyn, Manhattan…"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <span className="mb-1.5 block text-xs text-neutral-500">Tema</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              disabled={ro}
              className={`${ta} disabled:opacity-70`}
            >
              <option value="">— sin tema —</option>
              {Object.keys(THEMES).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="mb-1.5 block text-xs text-neutral-500">Duración (minutos)</span>
            <input
              type="number"
              min={0}
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              disabled={ro}
              className={`${ta} disabled:opacity-70`}
              placeholder="60"
            />
          </div>
          <div>
            <span className="mb-1.5 block text-xs text-neutral-500">Caminata (km)</span>
            <input
              type="number"
              min={0}
              step="0.1"
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              disabled={ro}
              className={`${ta} disabled:opacity-70`}
              placeholder="3.5"
            />
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-xs text-neutral-500">
            Tip de Henry <span className="text-neutral-600">(frase manuscrita en el detalle)</span>
          </span>
          <input
            value={henryTip}
            onChange={(e) => setHenryTip(e.target.value)}
            disabled={ro}
            className={`${ta} disabled:opacity-70`}
            placeholder="Vení con hambre y zapatillas cómodas."
          />
        </div>
        <CoverSection experienceId={experience.id} coverPath={experience.cover_path} />
        <CoverSection
          experienceId={experience.id}
          coverPath={experience.card_image_path}
          field="card_image_path"
          label="Imagen de la card (cuadrada, solo imagen)"
          imageOnly
        />
        <p className="text-xs text-neutral-600">
          /{experience.slug} · la cantidad de paradas se calcula sola desde los pasos
        </p>
      </div>

      {/* al terminar: upsell de la siguiente experiencia */}
      <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-neutral-900/40 p-5">
        <h2 className="text-sm font-medium text-neutral-300">Al terminar</h2>
        <p className="text-xs text-neutral-500">
          Cuando el usuario termina este recorrido, Henry le ofrece el siguiente (con un
          cupón si querés). Dejalo vacío para no ofrecer nada.
        </p>
        <div>
          <span className="mb-1.5 block text-xs text-neutral-500">Siguiente experiencia</span>
          <select
            value={upsellId}
            onChange={(e) => setUpsellId(e.target.value)}
            disabled={ro}
            className={`${ta} disabled:opacity-70`}
          >
            <option value="">— no ofrecer nada —</option>
            {otherExperiences.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        </div>
        {upsellId && (
          <>
            <div>
              <span className="mb-1.5 block text-xs text-neutral-500">
                Mensaje de Henry <span className="text-neutral-600">(en su voz)</span>
              </span>
              <textarea
                value={upsellMsg}
                onChange={(e) => setUpsellMsg(e.target.value)}
                disabled={ro}
                rows={2}
                placeholder="¿Te quedaste con ganas de más, querubín? Este te va a encantar…"
                className={`${ta} disabled:opacity-70`}
              />
            </div>
            <div>
              <span className="mb-1.5 block text-xs text-neutral-500">
                Cupón <span className="text-neutral-600">(código de Stripe, opcional — ver la sección Cupones)</span>
              </span>
              <input
                value={upsellPromo}
                onChange={(e) => setUpsellPromo(e.target.value.toUpperCase())}
                disabled={ro}
                placeholder="GOLAZO20"
                className={`${ta} disabled:opacity-70`}
              />
            </div>
          </>
        )}
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
                <span className="mb-1 block text-xs text-neutral-500">Paradas gratis</span>
                <input
                  type="number"
                  min={1}
                  max={maxFreeStops}
                  value={freeStops}
                  onChange={(e) => setFreeStops(Number(e.target.value))}
                  className="w-24 rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400/50"
                />
              </label>
            )}
            {Number(priceDollars) > 0 && arrivalSteps[freeStops - 1] && (
              <p className="pb-2 text-xs text-neutral-500">
                El paywall va después de{" "}
                <span className="text-neutral-300">
                  {arrivalSteps[freeStops - 1].title || `la parada ${freeStops}`}
                </span>
                {" "}· {Math.max(0, arrivalSteps.length - freeStops)} parada(s) pagas
              </p>
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
          <p className="text-xs text-neutral-600">
            El precio y el paywall se aplican con el botón <span className="text-neutral-400">Guardar</span> de
            arriba (si el precio cambió, se crea el producto en Stripe).
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

            {/* alta de pasos debajo de éste + marcador de paywall por parada */}
            <div className="mt-3 flex items-center gap-3 border-t border-white/5 pt-2.5">
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
              {s.type === "arrival" && Number(priceDollars) > 0 && (
                <button
                  onClick={() => {
                    const k = arrivalOrdinal.get(s.id)!;
                    if (k > maxFreeStops) {
                      setMsg({
                        kind: "err",
                        text: "Después de la última parada no puede ir el paywall: no quedaría nada para vender.",
                      });
                      return;
                    }
                    setFreeStops(k);
                    setMsg({
                      kind: "ok",
                      text: `Paywall después de "${s.title || `parada ${k}`}". Tocá "Guardar" para aplicarlo.`,
                    });
                  }}
                  disabled={pending}
                  className={
                    "ml-auto text-xs font-medium transition disabled:opacity-40 " +
                    (freeStops === arrivalOrdinal.get(s.id)
                      ? "text-amber-300"
                      : "text-neutral-600 hover:text-amber-200")
                  }
                >
                  {freeStops === arrivalOrdinal.get(s.id)
                    ? "🔒 paywall después de esta"
                    : "poner paywall después de esta"}
                </button>
              )}
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
