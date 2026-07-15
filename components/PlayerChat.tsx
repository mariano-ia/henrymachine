"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatTurn } from "@/lib/types";
import type { TourPhase } from "@/lib/engine/play-prompt";
import { mapsDirUrl } from "@/lib/maps";
import type { PlayMedia } from "@/lib/db/experiences";
import { track, getUtm } from "@/lib/track";
import { fmtUsd } from "@/lib/price";
import { metersToSteps } from "@/lib/steps";
import ReviewPrompt from "@/components/ReviewPrompt";
import ShareButton from "@/components/ShareButton";
import EmailCaptureCard from "@/components/EmailCaptureCard";
import { getCapturedEmail } from "@/lib/email-capture";

type StopMeta = {
  title: string;
  placeQuery: string | null;
  media: PlayMedia[];
  askReview: boolean;
  reviewMessage: string | null;
};
type Message = {
  role: "user" | "henry";
  text: string;
  time: string;
  media?: PlayMedia[];
  kind?: "arrival" | "review";
  arrival?: { n: number; title: string };
};
type Status = "EN_CURSO" | "TERMINADO" | "PAYWALL";

type State = {
  stopIndex: number;
  phase: TourPhase;
  turnsInStop: number;
  totalTurns: number; // presupuesto de conversación (el server corta suave/duro)
  prevPhase: TourPhase;
  status: Status;
};

function now(): string {
  return new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function humanDelayMs(len: number): number {
  return Math.min(4500, Math.max(1200, 700 + len * 22));
}
const NUDGE_AFTER_MS = 100_000;

// ---- reanudar: el progreso sobrevive a cerrar la pestaña (mismo navegador) ----
const SAVE_VERSION = 2; // v2: State.totalTurns
const RESUME_WINDOW_MS = 7 * 24 * 3600 * 1000; // 7 días para retomar
const saveKey = (slug: string) => `henry_play_${slug}`;

type SavedPlay = { v: number; savedAt: number; tour: State; messages: Message[] };

function loadSaved(slug: string, stopsLen: number, locked: boolean): SavedPlay | null {
  try {
    const raw = localStorage.getItem(saveKey(slug));
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedPlay;
    if (s.v !== SAVE_VERSION) return null;
    if (Date.now() - s.savedAt > RESUME_WINDOW_MS) return null;
    if (s.tour.status === "TERMINADO") return null;
    if (s.tour.stopIndex >= stopsLen) return null;
    // volvió del paywall ya comprado: destrabar y seguir
    if (s.tour.status === "PAYWALL") {
      if (locked) return null;
      s.tour = { ...s.tour, status: "EN_CURSO" };
    }
    // las signed URLs de media caducan: se quitan esas burbujas del historial restaurado;
    // el pedido de reseña inline tampoco se restaura como interactivo (se usa el flag).
    s.messages = s.messages.filter((m) => !(m.media?.length ?? 0) && m.kind !== "review");
    if (s.messages.length === 0) return null;
    return s;
  } catch {
    return null;
  }
}

function resumeGreeting(tour: State, stops: StopMeta[]): Message {
  const st = stops[tour.stopIndex];
  const n = tour.stopIndex + 1;
  let text: string;
  if (tour.phase === "EN_PARADA") {
    text = `¡Volviste, querubín! Quedamos en ${st?.title ?? "una parada"} (parada ${n} de ${stops.length}). ¿Sigues por ahí?`;
  } else if (tour.phase === "EN_PAUSA") {
    text = `¡Volviste! Estábamos en pausa cerca de ${st?.title ?? "la próxima parada"}. Cuando quieras, retomamos.`;
  } else {
    text = `¡Volviste! Íbamos camino a ${st?.title ?? "la próxima parada"}. Avísame cuando llegues 🙌`;
  }
  return { role: "henry", text, time: now() };
}

export default function PlayerChat({
  slug,
  anonId,
  openingMessage,
  openingMedia,
  closingMessage,
  stops,
  locked,
  priceCents,
  paywallMessage,
  upsell,
  serverProgress,
  distanceM,
  neighborhood,
}: {
  slug: string;
  anonId: string;
  title: string;
  openingMessage: string;
  openingMedia?: PlayMedia[];
  closingMessage: string | null;
  stops: StopMeta[];
  locked: boolean;
  priceCents: number;
  paywallMessage: string | null;
  upsell?: {
    slug: string;
    title: string;
    priceCents: number;
    coverPath: string | null;
    message: string | null;
    promoCode: string | null;
  } | null;
  serverProgress?: { stopIndex: number; phase: string; totalTurns: number } | null;
  distanceM?: number | null;
  neighborhood?: string | null;
}) {
  const LAST = stops.length - 1;
  // texto de compartir al terminar (pasos + barrio reales)
  const pasosNum = metersToSteps(distanceM ?? null);
  const sharePasos = pasosNum ? `${pasosNum.toLocaleString("es-PE")} pasos` : "un buen tramo";
  const shareTexto = `Caminé ${sharePasos} por ${neighborhood ?? "Nueva York"} con Henry`;
  // ya lo tiene (paga y no bloqueada) → nunca pedir email
  const ownsIt = priceCents > 0 && !locked;
  const upsellCover = upsell?.coverPath
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/experience-covers/${upsell.coverPath}`
    : null;
  const upsellHref = upsell
    ? `/e/${upsell.slug}${upsell.promoCode ? `?promo=${encodeURIComponent(upsell.promoCode)}` : ""}`
    : "#";

  const applyIntent = useCallback(
    (prev: State, intent: string): State => {
      if (prev.status !== "EN_CURSO") return prev;
      const s = { ...prev };
      switch (intent) {
        case "arrived":
          if (s.phase !== "EN_PARADA") {
            s.phase = "EN_PARADA";
            s.turnsInStop = 0;
          } else s.turnsInStop++;
          break;
        case "next":
          if (s.stopIndex >= LAST) s.status = locked ? "PAYWALL" : "TERMINADO";
          else {
            s.stopIndex++;
            s.phase = "CAMINANDO";
            s.turnsInStop = 0;
          }
          break;
        case "finish":
          // si todavía hay paradas bloqueadas (preview pago), no cerramos:
          // mostramos el paywall para no perder la venta.
          s.status = locked ? "PAYWALL" : "TERMINADO";
          break;
        case "pause":
          if (s.phase !== "EN_PAUSA") {
            s.prevPhase = s.phase;
            s.phase = "EN_PAUSA";
          }
          break;
        case "resume":
          s.phase = s.prevPhase || "CAMINANDO";
          break;
        default:
          if (s.phase === "EN_PARADA") s.turnsInStop++;
      }
      return s;
    },
    [LAST, locked]
  );

  // PlayerChat solo monta en el cliente (PlayerLoader lo gatea tras el fetch),
  // así que acá localStorage está disponible.
  const [saved] = useState<SavedPlay | null>(() => loadSaved(slug, stops.length, locked));
  // reanudar desde el SERVER (otro dispositivo): solo si no hay guardado local
  // —que tiene el historial completo— y el server marca una parada avanzada.
  const [serverResume] = useState<State | null>(() => {
    if (saved || !serverProgress) return null;
    const { stopIndex, phase, totalTurns } = serverProgress;
    if (stopIndex < 0 || stopIndex >= stops.length) return null;
    const ph: TourPhase = (["CAMINANDO", "EN_PARADA", "EN_PAUSA"] as const).includes(
      phase as TourPhase
    )
      ? (phase as TourPhase)
      : "CAMINANDO";
    return { stopIndex, phase: ph, turnsInStop: 0, totalTurns, prevPhase: "CAMINANDO", status: "EN_CURSO" };
  });
  const [messages, setMessages] = useState<Message[]>(() => {
    if (saved) return [...saved.messages, resumeGreeting(saved.tour, stops)];
    if (serverResume) return [resumeGreeting(serverResume, stops)];
    const init: Message[] = [{ role: "henry", text: openingMessage, time: now() }];
    // media del paso de apertura (ej. audio de bienvenida de Henry)
    if (openingMedia?.length) init.push({ role: "henry", text: "", time: now(), media: openingMedia });
    return init;
  });
  const [tour, setTour] = useState<State>(
    () =>
      saved?.tour ??
      serverResume ?? {
        stopIndex: 0,
        phase: "CAMINANDO",
        turnsInStop: 0,
        totalTurns: 0,
        prevPhase: "CAMINANDO",
        status: "EN_CURSO",
      }
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [nudged, setNudged] = useState(false);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [promoInvalid, setPromoInvalid] = useState(false);
  // captura de email al arrancar (momento 1): salteable y deduplicada
  const [askEmail, setAskEmail] = useState<boolean>(
    () => !getCapturedEmail() && !ownsIt && stops.length > 0 && tour.status === "EN_CURSO"
  );
  // ¿ya dejó una reseña? (inline o al final). Persiste para no volver a pedirla.
  const [reviewed, setReviewed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`henry_reviewed_${slug}`) === "1";
    } catch {
      return false;
    }
  });
  const markReviewed = useCallback(() => {
    setReviewed(true);
    try {
      localStorage.setItem(`henry_reviewed_${slug}`, "1");
    } catch {
      /* storage bloqueado: igual queda en memoria esta sesión */
    }
  }, [slug]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, tour.status]);

  // persistir el progreso: cerrar y volver retoma donde quedó (48 h)
  useEffect(() => {
    try {
      if (tour.status === "TERMINADO") {
        localStorage.removeItem(saveKey(slug));
        return;
      }
      const s: SavedPlay = { v: SAVE_VERSION, savedAt: Date.now(), tour, messages };
      localStorage.setItem(saveKey(slug), JSON.stringify(s));
    } catch {
      /* storage lleno o bloqueado: el chat sigue, solo no persiste */
    }
  }, [messages, tour, slug]);
  useEffect(() => {
    const t = taRef.current;
    if (!t) return;
    t.style.height = "0px";
    t.style.height = Math.min(t.scrollHeight, 120) + "px";
  }, [input]);

  const historyFrom = (msgs: Message[]): ChatTurn[] =>
    msgs.map((m) => ({ role: m.role, text: m.text }));

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setNudged(false);
    const history = historyFrom(messages);
    setMessages((prev) => [...prev, { role: "user", text, time: now() }]);
    setSending(true);
    const started = Date.now();

    let reply = "Se me cortó la señal 😅 prueba de nuevo";
    let intent = "none";
    let limitFarewell = false;
    try {
      const res = await fetch("/api/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          anonId,
          stopIndex: tour.stopIndex,
          phase: tour.phase,
          turnsInStop: tour.turnsInStop,
          totalTurns: tour.totalTurns,
          message: text,
          history,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        reply = data.reply;
        intent = data.intent || "none";
        if (data.limit) limitFarewell = true;
      } else {
        // 429 (rate-limit) trae un mensaje amable en data.reply — no lo perdamos
        reply = data.reply || data.error || "uff, algo se me trabó. prueba de nuevo";
      }
    } catch {
      /* fallback */
    }

    const next = { ...applyIntent(tour, intent), totalTurns: tour.totalTurns + 1 };
    let shown = reply;
    // la despedida por límite se muestra tal cual (no la pisa el cierre guionado)
    if (next.status === "TERMINADO" && closingMessage && !limitFarewell) shown = closingMessage;
    if (next.status === "PAYWALL" && paywallMessage) shown = paywallMessage;

    const wait = humanDelayMs(shown.length) - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    setMessages((prev) => {
      const out: Message[] = [...prev, { role: "henry", text: shown, time: now() }];
      // solo si REALMENTE llegó recién (transición a EN_PARADA): si el modelo
      // repite 'arrived' estando ya en la parada, no duplicamos tarjeta ni media.
      if (intent === "arrived" && tour.phase !== "EN_PARADA") {
        const st = stops[next.stopIndex];
        out.push({
          role: "henry",
          text: "",
          time: now(),
          kind: "arrival",
          arrival: { n: next.stopIndex + 1, title: st?.title ?? "" },
        });
        const m = st?.media ?? [];
        if (m.length) out.push({ role: "henry", text: "", time: now(), media: m });
        // pedido de reseña inline: si esta parada lo tiene marcado y todavía no reseñó
        if (st?.askReview && !reviewed && !out.some((x) => x.kind === "review")) {
          out.push({
            role: "henry",
            time: now(),
            kind: "review",
            text: st.reviewMessage?.trim() || "¿Qué te está pareciendo hasta acá, querubín?",
          });
        }
      }
      return out;
    });
    if (next.status === "TERMINADO" && tour.status !== "TERMINADO") track("finish_tour", slug);
    setTour(next);
    setSending(false);
  }

  const sendNudge = useCallback(async () => {
    if (sending || nudged || tour.status !== "EN_CURSO" || tour.phase === "EN_PAUSA") return;
    setSending(true);
    setNudged(true);
    const started = Date.now();
    let reply = "";
    try {
      const res = await fetch("/api/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          anonId,
          stopIndex: tour.stopIndex,
          phase: tour.phase,
          turnsInStop: tour.turnsInStop,
          totalTurns: tour.totalTurns,
          message: "(el usuario no respondió en un rato)",
          history: historyFrom(messages),
          nudge: true,
        }),
      });
      const data = await res.json();
      if (res.ok) reply = data.reply || "";
    } catch {
      /* silencioso */
    }
    if (reply) {
      const wait = humanDelayMs(reply.length) - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      setMessages((prev) => [...prev, { role: "henry", text: reply, time: now() }]);
      setTour((t) => ({ ...t, totalTurns: t.totalTurns + 1 }));
    }
    setSending(false);
  }, [sending, nudged, tour, messages, slug, anonId]);

  useEffect(() => {
    if (tour.status !== "EN_CURSO" || tour.phase === "EN_PAUSA" || nudged || sending) return;
    const id = setTimeout(sendNudge, NUDGE_AFTER_MS);
    return () => clearTimeout(id);
  }, [messages, tour.phase, tour.status, nudged, sending, sendNudge]);

  async function buy(ignorePromo = false) {
    track("begin_checkout", slug);
    if (buying) return;
    setBuying(true);
    setBuyError(null);
    setPromoInvalid(false);
    try {
      // el cupón del upsell: ?promo en la URL, o el que BuyBar guardó por experiencia.
      let promo: string | null = null;
      if (!ignorePromo) {
        try {
          promo =
            new URLSearchParams(window.location.search).get("promo") ||
            localStorage.getItem(`henry_promo_${slug}`);
        } catch {
          promo = null;
        }
      }
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId, utm: getUtm(), promo }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      // cupón vencido/desactivado: lo limpiamos y ofrecemos seguir sin descuento
      // (en vez de cobrar precio completo en silencio).
      if (data.code === "invalid_promo") {
        setPromoInvalid(true);
        try {
          localStorage.removeItem(`henry_promo_${slug}`);
        } catch {
          /* noop */
        }
      }
      setBuyError(data.error ?? "No se pudo abrir el pago. Prueba de nuevo.");
      setBuying(false);
    } catch {
      setBuyError("No se pudo abrir el pago. Revisa tu conexión y prueba de nuevo.");
      setBuying(false);
    }
  }

  const showMapLink = tour.status === "EN_CURSO" && tour.phase !== "EN_PAUSA";
  const target = stops[tour.stopIndex];

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[#F4F2EC]">
      {/* header */}
      <header className="flex items-center gap-3 bg-night px-4 py-2.5 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/henry.jpg" alt="Henry" className="h-9 w-9 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-tight text-white">Henry</p>
          <p className="text-[11px] leading-tight text-white/55">
            {sending ? "escribiendo…" : "en línea"}
          </p>
        </div>
        {tour.status === "EN_CURSO" && stops.length > 0 && (
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/70">
            Parada {Math.min(tour.stopIndex + 1, stops.length)} de {stops.length}
          </span>
        )}
      </header>

      {/* body */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        <p className="pb-1 text-center text-[10px] leading-tight text-ink/30">
          Chat con IA en la voz de Henry
        </p>
        {askEmail && (
          <EmailCaptureCard
            title="¿Te guardo el link por si se te corta la señal? Te lo mando al correo y lo retomas cuando quieras."
            source="player_start"
            slug={slug}
            onDone={() => setAskEmail(false)}
            onSkip={() => setAskEmail(false)}
          />
        )}
        {messages.map((m, i) => {
          if (m.kind === "review") {
            return (
              <InlineReview
                key={i}
                slug={slug}
                anonId={anonId}
                message={m.text}
                done={reviewed}
                onDone={markReviewed}
              />
            );
          }
          const isGroupStart =
            m.role === "henry" &&
            !m.kind &&
            !(m.media?.length ?? 0) &&
            (i === 0 || messages[i - 1].role !== "henry" || messages[i - 1].kind === "arrival");
          return <Bubble key={i} m={m} avatar={isGroupStart} />;
        })}
        {sending && <TypingRow />}
      </div>

      {/* cómo llegar */}
      {showMapLink && target?.placeQuery && (
        <a
          href={mapsDirUrl(target.placeQuery)}
          target="_blank"
          rel="noreferrer"
          className="mx-3 mb-1.5 flex items-center justify-center gap-1.5 rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-[14px] font-semibold text-ink shadow-bubble active:scale-[0.99]"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="h-4 w-4 text-brand">
            <path d="M8 14s4.4-4.1 4.4-7.2A4.4 4.4 0 0 0 3.6 6.8C3.6 9.9 8 14 8 14Z" />
            <circle cx="8" cy="6.6" r="1.5" />
          </svg>
          {tour.phase === "CAMINANDO" ? `Cómo llegar a ${target.title}` : `Ver ${target.title} en el mapa`}
        </a>
      )}

      {/* footer: paywall / terminado / input */}
      {tour.status === "PAYWALL" ? (
        <div
          className="border-t border-ink/10 bg-white px-4 py-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/henry.jpg" alt="Henry" className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover" />
            <p className="rounded-2xl rounded-tl-sm bg-[#F4F2EC] px-3.5 py-2.5 text-[15px] leading-snug text-ink">
              {paywallMessage ?? "Hasta acá es gratis. Si te está gustando, seguimos con el resto del recorrido."}
            </p>
          </div>
          <button
            onClick={() => buy()}
            disabled={buying}
            className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-brand px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60"
          >
            {buying ? "Abriendo el pago…" : `Desbloquea el resto · ${fmtUsd(priceCents)}`}
          </button>
          {/* kit de confianza: qué te llevas y la garantía (compra impulsiva) */}
          <p className="mt-2 text-center text-[11px] leading-tight text-ink/50">
            Acceso para siempre con tu correo · si no te gustó, te devuelvo tu dinero
          </p>
          {buyError && <p className="mt-2 text-center text-[12px] text-red-600">{buyError}</p>}
          {promoInvalid && (
            <button
              onClick={() => buy(true)}
              disabled={buying}
              className="mt-1 w-full text-center text-[12px] font-semibold text-brand underline underline-offset-2 disabled:opacity-60"
            >
              Continuar sin descuento
            </button>
          )}
        </div>
      ) : tour.status === "TERMINADO" ? (
        <div
          className="max-h-[75dvh] overflow-y-auto border-t border-ink/10 bg-white px-4 py-5"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          <p className="text-center font-hand text-[24px] leading-tight text-brand">
            un abrazo, nos vemos en la próxima
          </p>
          <p className="mt-1 text-center text-[13px] text-ink/45">
            Recorrido terminado · gracias por caminar conmigo
          </p>
          {/* red de seguridad: si el cierre fue sin querer, se puede retomar */}
          <button
            onClick={() => setTour((t) => ({ ...t, status: "EN_CURSO" }))}
            className="mx-auto mt-2 block text-[12px] font-medium text-ink/45 underline underline-offset-2 transition hover:text-ink"
          >
            ¿Terminó sin querer? Volver al recorrido
          </button>

          <ShareButton
            label="Compartir mi recorrido 🗽"
            text={shareTexto}
            url={`https://caminaconhenry.com/e/${slug}?ref=compartir`}
            className="mx-auto mt-3 block rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-white transition hover:opacity-90"
          />

          {/* si ya dejó reseña inline durante el recorrido, no la volvemos a pedir */}
          {!reviewed && <ReviewPrompt slug={slug} anonId={anonId} onDone={markReviewed} />}

          {/* upsell: la siguiente experiencia, en la voz de Henry */}
          {upsell && (
            <div className="mt-4 rounded-2xl border border-ink/10 bg-[#F4F2EC] p-3">
              {upsell.message && (
                <p className="mb-2.5 flex items-start gap-2 text-[14px] leading-snug text-ink">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/henry.jpg" alt="" className="mt-0.5 h-6 w-6 shrink-0 rounded-full object-cover" />
                  <span>{upsell.message}</span>
                </p>
              )}
              <a
                href={upsellHref}
                className="flex items-center gap-3 rounded-xl bg-white p-2 shadow-bubble transition active:scale-[0.99]"
              >
                <span
                  className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-ink/5"
                  style={
                    upsellCover
                      ? { backgroundImage: `url(${upsellCover})`, backgroundSize: "cover", backgroundPosition: "center" }
                      : undefined
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">{upsell.title}</span>
                  <span className="text-[12px] text-ink/50">
                    {upsell.priceCents > 0 ? `US$${(upsell.priceCents / 100).toFixed(2)}` : "Gratis"}
                    {upsell.promoCode ? ` · con ${upsell.promoCode}` : ""}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-brand px-3.5 py-1.5 text-[13px] font-semibold text-white">
                  Ver →
                </span>
              </a>
            </div>
          )}
        </div>
      ) : (
        <div
          className="flex items-end gap-2 border-t border-ink/10 bg-white px-2.5 py-2.5"
          style={{ paddingBottom: "max(0.6rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex flex-1 items-end rounded-3xl bg-[#F0EEE7] px-4 py-2">
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Escríbele a Henry…"
              className="block w-full resize-none overflow-y-auto bg-transparent py-1 text-[16px] leading-6 text-ink outline-none placeholder:text-ink/40"
            />
          </div>
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition active:scale-95 disabled:opacity-40"
            aria-label="Enviar"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function Bubble({ m, avatar }: { m: Message; avatar: boolean }) {
  // tarjeta de "llegada" a una parada
  if (m.kind === "arrival") {
    return (
      <div className="flex justify-center py-1.5">
        <div className="inline-flex items-center gap-2.5 rounded-full bg-ink px-3.5 py-1.5 text-white shadow-bubble">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold">
            {m.arrival?.n}
          </span>
          <span className="text-[13px] font-semibold">Llegamos · {m.arrival?.title}</span>
        </div>
      </div>
    );
  }

  const isUser = m.role === "user";
  const hasMedia = (m.media?.length ?? 0) > 0;

  if (hasMedia) {
    return (
      <div className="flex justify-start pl-9">
        <div className="max-w-[82%] space-y-1.5 rounded-2xl rounded-tl-sm bg-white p-1.5 shadow-bubble">
          {m.media!.map((md, i) => (
            <MediaCard key={i} m={md} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={"flex items-end gap-2 " + (isUser ? "justify-end" : "justify-start")}>
      {!isUser &&
        (avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/henry.jpg" alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="w-7 shrink-0" />
        ))}
      <div
        className={
          "max-w-[80%] px-3.5 py-2 text-[16px] leading-snug shadow-bubble " +
          (isUser
            ? "rounded-2xl rounded-br-sm bg-brand text-white"
            : "rounded-2xl rounded-tl-sm bg-white text-ink")
        }
      >
        <p className="whitespace-pre-wrap break-words">{m.text}</p>
      </div>
    </div>
  );
}

function TypingRow() {
  return (
    <div className="flex items-end gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/henry.jpg" alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-white px-3.5 py-3 shadow-bubble">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="henry-typing-dot h-1.5 w-1.5 rounded-full bg-ink/40"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function MediaCard({ m }: { m: PlayMedia }) {
  const caption = m.caption ? (
    <figcaption className="px-1 pb-1 pt-1.5 font-hand text-[16px] leading-tight text-ink/70">
      {m.caption}
    </figcaption>
  ) : null;
  if (m.kind === "image")
    return (
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.url} alt={m.caption ?? ""} className="max-h-72 w-[260px] rounded-lg object-cover" />
        {caption}
      </figure>
    );
  if (m.kind === "video")
    return (
      <figure>
        <video src={m.url} controls className="max-h-72 w-[260px] rounded-lg" />
        {caption}
      </figure>
    );
  return (
    <figure>
      <audio src={m.url} controls className="w-[240px]" />
      {caption}
    </figure>
  );
}

/** Pedido de reseña INLINE, en medio del recorrido: mensaje de Henry + estrellas
 * + comentario opcional. Un submit y el recorrido sigue. No bloquea el chat. */
function InlineReview({
  slug,
  anonId,
  message,
  done,
  onDone,
}: {
  slug: string;
  anonId: string;
  message: string;
  done: boolean;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (rating < 1 || busy) return;
    setBusy(true);
    try {
      await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId, rating, body: text.trim() }),
      });
    } catch {
      /* igual agradecemos */
    }
    setSent(true);
    setBusy(false);
    onDone();
  }

  return (
    <div className="flex items-end gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/henry.jpg" alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
      <div className="max-w-[86%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-3 shadow-bubble">
        <p className="text-[16px] leading-snug text-ink">{message}</p>
        {sent || done ? (
          <p className="mt-2 font-hand text-[18px] leading-tight text-brand">¡Gracias, querubín! 🙏</p>
        ) : (
          <>
            <div className="mt-2 flex gap-1.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(i)}
                  className="text-[26px] leading-none transition-transform hover:scale-110"
                  style={{ color: (hover || rating) >= i ? "#D89A34" : "#00000022" }}
                  aria-label={`${i} estrella${i > 1 ? "s" : ""}`}
                >
                  ★
                </button>
              ))}
            </div>
            {rating > 0 && (
              <>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={2}
                  placeholder="¿Quieres agregar algo? (opcional)"
                  className="mt-2 w-full rounded-lg border border-ink/15 bg-[#F4F2EC] px-3 py-2 text-[14px] text-ink outline-none focus:border-ink/40"
                />
                <button
                  onClick={submit}
                  disabled={busy}
                  className="mt-2 w-full rounded-full bg-brand py-2 text-[14px] font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
                >
                  {busy ? "Enviando…" : "Enviar"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
