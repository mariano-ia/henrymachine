"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatTurn } from "@/lib/types";

type Message = { role: "user" | "henry"; text: string; time: string };

function now(): string {
  return new Date().toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// "escribiendo…" dura un rato proporcional al largo de la respuesta (simula tipeo humano).
const TYPING_BASE_MS = 700;
const TYPING_PER_CHAR_MS = 22;
const TYPING_MIN_MS = 1200;
const TYPING_MAX_MS = 4500;

export default function ChatScreen(_props: {
  videoTitles: string[];
  videoCount: number;
}) {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      role: "henry",
      text: "hola! qué tal? soy Henry. te puedo contar todo de mi viaje a Tokio, qué quieres saber?",
      time: now(),
    },
  ]);
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

  // Auto-crecer vertical de la caja de mensaje (hasta un máximo, luego scroll).
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

    let reply = "Se me cortó la señal 😅 intenta de nuevo";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      reply = res.ok
        ? data.reply
        : data.error || "uff, algo se me trabó. intenta de nuevo";
    } catch {
      /* usa el fallback */
    }

    // Tiempo de "tipeo" simulado, escalado al largo de la respuesta.
    const typingMs = Math.min(
      TYPING_MAX_MS,
      Math.max(TYPING_MIN_MS, TYPING_BASE_MS + reply.length * TYPING_PER_CHAR_MS)
    );
    const elapsed = Date.now() - started;
    if (elapsed < typingMs) {
      await new Promise((r) => setTimeout(r, typingMs - elapsed));
    }

    setMessages((prev) => [...prev, { role: "henry", text: reply, time: now() }]);
    setSending(false);
  }

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col bg-[#efeae2]">
      {/* Header WhatsApp */}
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

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        {messages.map((m, i) => (
          <Bubble key={i} m={m} />
        ))}
      </div>

      {/* Input WhatsApp */}
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
