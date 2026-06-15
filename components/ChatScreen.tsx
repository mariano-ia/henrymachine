"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatTurn, Clip } from "@/lib/types";
import ClipPlayer from "./ClipPlayer";

type Message = { role: "user" | "henry"; text: string; clip?: Clip };

export default function ChatScreen({
  videoCount,
}: {
  videoTitles: string[];
  videoCount: number;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "henry",
      text: "¡Eh, qué tal! Soy Henry 🙌 Te puedo contar todo de mi viaje a Tokio. ¿Qué querés saber?",
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

    setMessages((prev) => [...prev, { role: "user", text }]);
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
        res.ok
          ? { role: "henry", text: data.reply, clip: data.clip }
          : {
              role: "henry",
              text: data.error || "Uff, algo se me trabó. Probá de nuevo.",
            },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "henry", text: "Se me cortó la señal 😅 Probá de nuevo." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col bg-neutral-950">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3 backdrop-blur">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-lg font-bold text-white ring-2 ring-white/10">
          H
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight text-white">Henry</p>
          <p className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Viaje a Japón · {videoCount} videos
          </p>
        </div>
        <span className="text-lg">🇯🇵</span>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {messages.map((m, i) => (
          <Bubble key={i} message={m} />
        ))}
        {sending && <TypingBubble />}
      </div>

      {/* Input */}
      <div
        className="border-t border-white/10 px-3 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-end gap-2">
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
            placeholder="Preguntale a Henry…"
            className="max-h-32 flex-1 resize-none rounded-3xl border border-white/10 bg-neutral-900 px-4 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-lg text-white transition hover:bg-indigo-500 active:scale-95 disabled:opacity-40"
            aria-label="Enviar"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div className={isUser ? "max-w-[80%]" : "max-w-[88%]"}>
        <div
          className={
            isUser
              ? "rounded-3xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-sm leading-relaxed text-white"
              : "rounded-3xl rounded-bl-md bg-neutral-800 px-4 py-2.5 text-sm leading-relaxed text-neutral-100"
          }
        >
          <p className="whitespace-pre-wrap">{message.text}</p>
        </div>
        {message.clip && <ClipPlayer clip={message.clip} />}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-3xl rounded-bl-md bg-neutral-800 px-4 py-3.5">
        <div className="flex gap-1">
          <Dot delay="0ms" />
          <Dot delay="150ms" />
          <Dot delay="300ms" />
        </div>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-2 w-2 animate-bounce rounded-full bg-neutral-500"
      style={{ animationDelay: delay }}
    />
  );
}
