"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Msg = { from: "henry" | "user"; text: string };

// Guion de apertura: Henry explica el producto en pocos mensajes y termina
// invitando a preguntar. Después de esto aparece el input (charla real, con IA).
const INTRO: string[] = [
  "¡Hola, querubín! Soy Henry 🤙",
  "Te llevo a caminar Nueva York por chat: eliges un recorrido y yo te guío parada por parada, a tu ritmo.",
  "La ciudad que no sale en las guías. Y me preguntas lo que quieras en el camino, como a un pata que conoce cada cuadra.",
  "¿Y tú? Pregúntame algo antes de arrancar 👇",
];

const MAX_USER_MSGS = 4; // teaser: solo unas preguntas
const CAP_MSG =
  "Jaja, por acá te doy solo un par de datos, querubín 😉 Lo bueno de verdad es caminando: elige un recorrido y seguimos toda la vuelta.";

function humanDelay(len: number): number {
  return Math.min(2600, Math.max(900, 500 + len * 18));
}

export default function HeroChat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(true);
  const [ready, setReady] = useState(false); // terminó la intro → input habilitado
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [capped, setCapped] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  // reproducir la intro una vez, con "escribiendo…" entre mensajes
  useEffect(() => {
    let active = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let i = 0;
    const play = () => {
      if (!active || i >= INTRO.length) {
        if (active) { setTyping(false); setReady(true); }
        return;
      }
      setTyping(true);
      const text = INTRO[i];
      timers.push(
        setTimeout(() => {
          if (!active) return;
          setMsgs((m) => [...m, { from: "henry", text }]);
          setTyping(false);
          i += 1;
          timers.push(setTimeout(play, 550));
        }, i === 0 ? 700 : 1500)
      );
    };
    play();
    return () => {
      active = false;
      timers.forEach(clearTimeout);
    };
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !ready || capped) return;
    // tope de mensajes: al quinto intento, corte elegante
    if (userCount >= MAX_USER_MSGS) {
      setCapped(true);
      setMsgs((m) => [...m, { from: "henry", text: CAP_MSG }]);
      return;
    }
    setInput("");
    const history = msgs.map((m) => ({ role: m.from, text: m.text }));
    setMsgs((m) => [...m, { from: "user", text }]);
    setUserCount((n) => n + 1);
    setSending(true);
    setTyping(true);
    const started = Date.now();
    let reply = "Uy, se me cruzaron los cables 😅 Pregúntame de nuevo.";
    try {
      const res = await fetch("/api/hero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const d = await res.json();
      if (d.reply) reply = d.reply;
    } catch {
      /* fallback */
    }
    const wait = humanDelay(reply.length) - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    setMsgs((m) => [...m, { from: "henry", text: reply }]);
    setTyping(false);
    setSending(false);
  }, [input, sending, ready, capped, userCount, msgs]);

  return (
    <div className="flex h-[420px] w-full max-w-[350px] flex-col overflow-hidden rounded-[1.6rem] border border-black/5 bg-[#F4F2EC] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.7)]">
      {/* header oscuro, igual que el chat real */}
      <div className="flex items-center gap-3 bg-night px-4 py-3 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/henry.jpg" alt="Henry" className="h-9 w-9 rounded-full object-cover" />
        <div className="leading-tight">
          <div className="text-[14px] font-semibold text-white">Henry</div>
          <div className="flex items-center gap-1.5 text-[11px] text-white/55">
            <span className="h-1.5 w-1.5 rounded-full bg-local" />
            {typing ? "escribiendo…" : "en línea"}
          </div>
        </div>
      </div>

      {/* cuerpo */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3.5 py-4">
        {msgs.map((m, i) => (
          <Bubble key={i} from={m.from} text={m.text} />
        ))}
        {typing && <Typing />}
      </div>

      {/* pie: CTA al capear, o input */}
      {capped ? (
        <div className="border-t border-black/5 bg-white/60 px-3 py-3">
          <a
            href="#recorridos"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-brand-dark"
          >
            Ver los recorridos <span aria-hidden>↓</span>
          </a>
        </div>
      ) : (
        <div className="flex items-end gap-2 border-t border-black/5 bg-white/60 px-2.5 py-2.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={!ready || sending}
            placeholder={ready ? "Escríbele a Henry…" : "Henry está escribiendo…"}
            className="min-w-0 flex-1 rounded-full bg-[#F0EEE7] px-4 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink/40 disabled:opacity-60"
          />
          <button
            onClick={send}
            disabled={!ready || sending || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white transition active:scale-95 disabled:opacity-40"
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

function Bubble({ from, text }: Msg) {
  const henry = from === "henry";
  return (
    <div className={"henry-bubble flex " + (henry ? "justify-start" : "justify-end")}>
      <div
        className={
          "max-w-[82%] px-3.5 py-2 text-[13px] leading-snug shadow-bubble " +
          (henry
            ? "rounded-2xl rounded-bl-sm bg-white text-ink"
            : "rounded-2xl rounded-br-sm bg-brand text-white")
        }
      >
        {text}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="henry-bubble flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 shadow-bubble">
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
