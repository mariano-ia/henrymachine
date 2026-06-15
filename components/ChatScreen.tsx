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

export default function ChatScreen(_props: {
  videoTitles: string[];
  videoCount: number;
}) {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      role: "henry",
      text: "¡Hola! ¿Qué tal? Soy Henry. Te puedo contar todo de mi viaje a Tokio — ¿qué quieres saber?",
      time: now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

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

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "henry",
          text: res.ok
            ? data.reply
            : data.error || "Uff, algo se me trabó. Intenta de nuevo.",
          time: now(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "henry", text: "Se me cortó la señal 😅 Intenta de nuevo.", time: now() },
      ]);
    } finally {
      setSending(false);
    }
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
          <p className="text-xs leading-tight text-white/80">
            {sending ? "escribiendo…" : "en línea"}
          </p>
        </div>
        <div className="flex items-center gap-4 pr-1">
          <Icon><path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z" /></Icon>
          <Icon><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .7-.2 1l-2.3 2.2z" /></Icon>
          <Icon><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></Icon>
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
        <div className="flex flex-1 items-center gap-2 rounded-3xl bg-white px-3 py-2">
          <span className="text-lg opacity-50">😊</span>
          <textarea
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
            className="max-h-28 flex-1 resize-none bg-transparent text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400"
          />
          <span className="text-lg opacity-50">📎</span>
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

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      {children}
    </svg>
  );
}
