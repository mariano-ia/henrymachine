"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatTurn } from "@/lib/types";
import { NYC12 } from "@/lib/tours/nyc12horas";
import type { TourPhase } from "@/lib/tour-prompt";

type Message = { role: "user" | "henry"; text: string; time: string };
type Status = "EN_CURSO" | "TERMINADO";

type TourState = {
  stopIndex: number;
  phase: TourPhase;
  turnsInStop: number;
  prevPhase: TourPhase;
  status: Status;
};

function now(): string {
  return new Date().toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const LAST = NYC12.stops.length - 1;

function applyIntent(prev: TourState, intent: string): TourState {
  if (prev.status === "TERMINADO") return prev;
  const s = { ...prev };
  switch (intent) {
    case "arrived":
      if (s.phase !== "EN_PARADA") {
        s.phase = "EN_PARADA";
        s.turnsInStop = 0;
      } else s.turnsInStop++;
      break;
    case "next":
      if (s.stopIndex >= LAST) s.status = "TERMINADO";
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
    default: // question / chat / none
      if (s.phase === "EN_PARADA") s.turnsInStop++;
  }
  return s;
}

export default function TourChat() {
  const [messages, setMessages] = useState<Message[]>(() => [
    { role: "henry", text: NYC12.openingMessage, time: now() },
  ]);
  const [tour, setTour] = useState<TourState>({
    stopIndex: 0,
    phase: "CAMINANDO",
    turnsInStop: 0,
    prevPhase: "CAMINANDO",
    status: "EN_CURSO",
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");

    const history: ChatTurn[] = messages.map((m) => ({
      role: m.role,
      text: m.text,
    }));
    setMessages((prev) => [...prev, { role: "user", text, time: now() }]);
    setSending(true);
    const started = Date.now();

    let reply = "Se me cortó la señal 😅 dale de nuevo";
    let intent = "none";
    try {
      const res = await fetch("/api/tour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
      } else {
        reply = data.error || "uff, algo se me trabó. dale de nuevo";
      }
    } catch {
      /* fallback */
    }

    // retardo proporcional al largo (tipeo humano)
    const typingMs = Math.min(4500, Math.max(1200, 700 + reply.length * 22));
    const elapsed = Date.now() - started;
    if (elapsed < typingMs) await new Promise((r) => setTimeout(r, typingMs - elapsed));

    setMessages((prev) => [...prev, { role: "henry", text: reply, time: now() }]);
    setTour((prev) => applyIntent(prev, intent));
    setSending(false);
  }

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col bg-[#efeae2]">
      <header className="flex items-center gap-2.5 bg-[#075e54] px-2 py-2 text-white">
        <button className="px-0.5 text-2xl leading-none opacity-90" aria-label="Atrás">
          ‹
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-base font-semibold">
          H
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">Henry</p>
          <p className="h-4 text-xs leading-tight text-white/80">
            {sending ? "escribiendo…" : "en línea"}
          </p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        {messages.map((m, i) => (
          <Bubble key={i} m={m} />
        ))}
      </div>

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
    </div>
  );
}

function Bubble({ m }: { m: Message }) {
  const isUser = m.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={`relative max-w-[82%] rounded-lg px-2.5 py-1.5 shadow-sm ${
          isUser ? "rounded-tr-none bg-[#d9fdd3]" : "rounded-tl-none bg-white"
        }`}
      >
        <p className="whitespace-pre-wrap pb-2 pr-14 text-[15px] leading-snug text-[#111b21]">
          {m.text}
        </p>
        <span className="absolute bottom-1 right-2 flex items-center gap-0.5 text-[11px] text-[#667781]">
          {m.time}
          {isUser && <span className="ml-0.5 text-[#53bdeb]">✓✓</span>}
        </span>
      </div>
    </div>
  );
}
