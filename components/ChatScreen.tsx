"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatTurn, Clip, IngestResult } from "@/lib/types";
import ClipPlayer from "./ClipPlayer";

type Message = { role: "user" | "henry"; text: string; clip?: Clip };

export default function ChatScreen({
  session,
  onReset,
}: {
  session: IngestResult;
  onReset: () => void;
}) {
  const titles = session.videos
    .map((v) => v.title)
    .filter(Boolean)
    .join(" · ");

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "henry",
      text: `¡Eh! Soy Henry 🙌 Ya tengo fresquito${
        titles ? ` lo de "${titles}"` : " lo que pegaste"
      }. Preguntame lo que quieras.`,
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
        body: JSON.stringify({
          videos: session.videos,
          voiceProfile: session.voiceProfile,
          message: text,
          history,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "henry", text: data.error || "Uff, algo se me trabó. Probá de nuevo." },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "henry", text: data.reply, clip: data.clip },
        ]);
      }
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
    <div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col bg-white">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-lg font-bold text-white">
          H
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">Henry</p>
          <p className="truncate text-xs text-neutral-400">
            {session.videos.length} video
            {session.videos.length > 1 ? "s" : ""} cargado
            {session.videos.length > 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={onReset}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100"
        >
          Cambiar videos
        </button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <Bubble key={i} message={m} />
        ))}
        {sending && <TypingBubble />}
      </div>

      {/* Input */}
      <div
        className="border-t border-neutral-200 px-3 py-3"
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
            className="max-h-32 flex-1 resize-none rounded-3xl border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-500 active:scale-95 disabled:opacity-40"
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
      <div className={isUser ? "max-w-[80%]" : "max-w-[85%]"}>
        <div
          className={
            isUser
              ? "rounded-3xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-sm text-white"
              : "rounded-3xl rounded-bl-md bg-neutral-200 px-4 py-2.5 text-sm text-neutral-900"
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
      <div className="rounded-3xl rounded-bl-md bg-neutral-200 px-4 py-3">
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
