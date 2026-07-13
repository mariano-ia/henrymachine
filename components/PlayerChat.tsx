"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatTurn } from "@/lib/types";
import type { TourPhase } from "@/lib/engine/play-prompt";
import { mapsDirUrl } from "@/lib/maps";
import type { PlayMedia } from "@/lib/db/experiences";

type StopMeta = { title: string; placeQuery: string | null; media: PlayMedia[] };
type Message = {
  role: "user" | "henry";
  text: string;
  time: string;
  media?: PlayMedia[];
  kind?: "arrival";
  arrival?: { n: number; title: string };
};
type Status = "EN_CURSO" | "TERMINADO" | "PAYWALL";

type State = {
  stopIndex: number;
  phase: TourPhase;
  turnsInStop: number;
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

export default function PlayerChat({
  slug,
  anonId,
  openingMessage,
  closingMessage,
  stops,
  locked,
  priceCents,
  paywallMessage,
}: {
  slug: string;
  anonId: string;
  title: string;
  openingMessage: string;
  closingMessage: string | null;
  stops: StopMeta[];
  locked: boolean;
  priceCents: number;
  paywallMessage: string | null;
}) {
  const LAST = stops.length - 1;

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
          s.status = "TERMINADO";
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

  const [messages, setMessages] = useState<Message[]>(() => [
    { role: "henry", text: openingMessage, time: now() },
  ]);
  const [tour, setTour] = useState<State>({
    stopIndex: 0,
    phase: "CAMINANDO",
    turnsInStop: 0,
    prevPhase: "CAMINANDO",
    status: "EN_CURSO",
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [nudged, setNudged] = useState(false);
  const [buying, setBuying] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, tour.status]);
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

    let reply = "Se me cortó la señal 😅 dale de nuevo";
    let intent = "none";
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
          message: text,
          history,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        reply = data.reply;
        intent = data.intent || "none";
      } else reply = data.error || "uff, algo se me trabó. dale de nuevo";
    } catch {
      /* fallback */
    }

    const next = applyIntent(tour, intent);
    let shown = reply;
    if (next.status === "TERMINADO" && closingMessage) shown = closingMessage;
    if (next.status === "PAYWALL" && paywallMessage) shown = paywallMessage;

    const wait = humanDelayMs(shown.length) - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    setMessages((prev) => {
      const out: Message[] = [...prev, { role: "henry", text: shown, time: now() }];
      if (intent === "arrived") {
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
      }
      return out;
    });
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
    }
    setSending(false);
  }, [sending, nudged, tour, messages, slug, anonId]);

  useEffect(() => {
    if (tour.status !== "EN_CURSO" || tour.phase === "EN_PAUSA" || nudged || sending) return;
    const id = setTimeout(sendNudge, NUDGE_AFTER_MS);
    return () => clearTimeout(id);
  }, [messages, tour.phase, tour.status, nudged, sending, sendNudge]);

  async function buy() {
    if (buying) return;
    setBuying(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setBuying(false);
    } catch {
      setBuying(false);
    }
  }

  const showMapLink = tour.status === "EN_CURSO" && tour.phase !== "EN_PAUSA";
  const target = stops[tour.stopIndex];

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[#F4F2EC]">
      {/* header */}
      <header className="flex items-center gap-3 bg-night px-3 py-2.5 text-white">
        <button
          onClick={() => history.back()}
          className="-ml-1 px-1 text-2xl leading-none text-white/70"
          aria-label="Atrás"
        >
          ‹
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-[15px] font-bold text-white">
          H
        </div>
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
        {messages.map((m, i) => {
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
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-[14px] font-bold text-white">
              H
            </div>
            <p className="rounded-2xl rounded-tl-sm bg-[#F4F2EC] px-3.5 py-2.5 text-[15px] leading-snug text-ink">
              {paywallMessage ?? "Hasta acá es gratis. Si te está gustando, seguimos con el resto del recorrido."}
            </p>
          </div>
          <button
            onClick={buy}
            disabled={buying}
            className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-brand px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60"
          >
            {buying ? "Abriendo el pago…" : `Desbloqueá el resto · $${(priceCents / 100).toFixed(2)}`}
          </button>
        </div>
      ) : tour.status === "TERMINADO" ? (
        <div
          className="border-t border-ink/10 bg-white px-4 py-5 text-center"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          <p className="font-hand text-[24px] leading-tight text-brand">un abrazo, nos vemos en la próxima</p>
          <p className="mt-1 text-[13px] text-ink/45">Recorrido terminado · gracias por caminar conmigo</p>
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
              placeholder="Escribile a Henry…"
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
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-bold text-white">
            H
          </div>
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
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-bold text-white">
        H
      </div>
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
