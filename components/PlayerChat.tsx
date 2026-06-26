"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatTurn } from "@/lib/types";
import type { TourPhase } from "@/lib/engine/play-prompt";
import { mapsDirUrl } from "@/lib/maps";
import type { PlayMedia } from "@/lib/db/experiences";

type StopMeta = { title: string; placeQuery: string | null; media: PlayMedia[] };
type Message = { role: "user" | "henry"; text: string; time: string; media?: PlayMedia[] };
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
        const m = stops[next.stopIndex]?.media ?? [];
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
    <div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col bg-[#efeae2]">
      <header className="flex items-center gap-2.5 bg-[#075e54] px-2 py-2 text-white">
        <button className="px-0.5 text-2xl leading-none opacity-90" aria-label="Atrás">‹</button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-base font-semibold">H</div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">Henry</p>
          <p className="h-4 text-xs leading-tight text-white/80">{sending ? "escribiendo…" : "en línea"}</p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        {messages.map((m, i) => (
          <Bubble key={i} m={m} />
        ))}
      </div>

      {showMapLink && target?.placeQuery && (
        <a
          href={mapsDirUrl(target.placeQuery)}
          target="_blank"
          rel="noreferrer"
          className="mx-3 mb-1 flex items-center justify-center gap-1.5 rounded-lg bg-white/70 px-3 py-2 text-sm font-medium text-[#075e54] shadow-sm active:scale-[0.99]"
        >
          📍 {tour.phase === "CAMINANDO" ? `Cómo llegar a ${target.title}` : `Ver ${target.title} en el mapa`}
        </a>
      )}

      {tour.status === "PAYWALL" ? (
        <div
          className="bg-[#f0f0f0] px-5 py-5 text-center"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          <p className="text-sm text-neutral-600">{paywallMessage ?? "Seguí el recorrido completo."}</p>
          <button
            onClick={buy}
            disabled={buying}
            className="mt-3 inline-flex items-center justify-center rounded-full bg-[#075e54] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0a7a68] active:scale-[0.99] disabled:opacity-60"
          >
            {buying ? "Abriendo el pago…" : `Comprar · $${(priceCents / 100).toFixed(2)}`}
          </button>
        </div>
      ) : tour.status === "TERMINADO" ? (
        <div
          className="bg-[#f0f0f0] px-4 py-5 text-center text-sm text-neutral-500"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          Recorrido finalizado · ¡gracias por recorrer con Henry! 🗽
        </div>
      ) : (
        <div
          className="flex items-end gap-2 bg-[#f0f0f0] px-2 py-2"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex flex-1 items-end rounded-3xl bg-white px-4 py-2">
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
              placeholder="Escribe un mensaje"
              className="block w-full resize-none overflow-y-auto bg-transparent py-1 text-[15px] leading-5 text-neutral-900 outline-none placeholder:text-neutral-400"
            />
          </div>
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#075e54] text-white transition active:scale-95 disabled:opacity-60"
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

function Bubble({ m }: { m: Message }) {
  const isUser = m.role === "user";
  const hasMedia = (m.media?.length ?? 0) > 0;
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={`relative max-w-[82%] rounded-lg shadow-sm ${
          hasMedia ? "p-1.5" : "px-2.5 py-1.5"
        } ${isUser ? "rounded-tr-none bg-[#d9fdd3]" : "rounded-tl-none bg-white"}`}
      >
        {hasMedia ? (
          <div className="space-y-1.5">
            {m.media!.map((md, i) => (
              <MediaCard key={i} m={md} />
            ))}
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap pb-2 pr-14 text-[15px] leading-snug text-[#111b21]">
              {m.text}
            </p>
            <span className="absolute bottom-1 right-2 flex items-center gap-0.5 text-[11px] text-[#667781]">
              {m.time}
              {isUser && <span className="ml-0.5 text-[#53bdeb]">✓✓</span>}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function MediaCard({ m }: { m: PlayMedia }) {
  if (m.kind === "image")
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.url} alt={m.caption ?? ""} className="max-h-72 w-[260px] rounded-md object-cover" />;
  if (m.kind === "video")
    return <video src={m.url} controls className="max-h-72 w-[260px] rounded-md" />;
  return <audio src={m.url} controls className="w-[240px]" />;
}
