"use client";

import { useEffect, useState } from "react";

type Msg = { from: "henry" | "user"; text: string };

// Charla de un recorrido EN CURSO (sin saludo): loopea con sentido y cualquier
// mensaje se puede ver repetido. Placeholder hasta tener un guion real.
const SCRIPT: Msg[] = [
  { from: "henry", text: "Doblá en la esquina, vas bien 👍" },
  { from: "user", text: "¿Es la próxima cuadra o sigo derecho?" },
  { from: "henry", text: "La próxima nomás. Cuando llegues, avisame." },
  { from: "user", text: "Listo, llegué a la del cartel rojo" },
  { from: "henry", text: "Esa misma. Entrá que te atienden bárbaro." },
  { from: "henry", text: "Pedí una porción de muzza y seguimos tranquilos." },
  { from: "user", text: "Riquísima, qué buen dato 🔥" },
  { from: "henry", text: "Te dije 😄 Ahora cruzamos a un café acá cerca." },
  { from: "henry", text: "Tomate tu tiempo, no hay apuro." },
  { from: "user", text: "Dale, vamos para el café" },
];

type Item = { id: number; msg: Msg; animate: boolean };
const KEEP = 9;

export default function HeroChat() {
  const [items, setItems] = useState<Item[]>(() =>
    [0, 1, 2].map((i) => ({ id: i, msg: SCRIPT[i], animate: false }))
  );
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let active = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (d: number, fn: () => void) =>
      timers.push(setTimeout(() => active && fn(), d));

    let idx = 3;
    let id = 3;
    const add = (msg: Msg) =>
      setItems((prev) => [...prev, { id: id++, msg, animate: true }].slice(-KEEP));

    function step() {
      const msg = SCRIPT[idx % SCRIPT.length];
      idx += 1;
      if (msg.from === "henry") {
        setTyping(true);
        at(1700, () => {
          setTyping(false);
          add(msg);
          at(2600, step);
        });
      } else {
        add(msg);
        at(2400, step);
      }
    }
    at(2200, step);
    return () => {
      active = false;
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="w-full max-w-[350px] overflow-hidden rounded-[1.6rem] border border-black/5 bg-[#F4F2EC] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.7)]">
      {/* header oscuro, igual que el chat real */}
      <div className="flex items-center gap-3 bg-night px-4 py-3 text-white">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-[14px] font-bold text-white">
          H
        </div>
        <div className="leading-tight">
          <div className="text-[14px] font-semibold text-white">Henry</div>
          <div className="flex items-center gap-1.5 text-[11px] text-white/55">
            <span className="h-1.5 w-1.5 rounded-full bg-local" />
            {typing ? "escribiendo…" : "en línea"}
          </div>
        </div>
      </div>

      {/* cuerpo: stream continuo (lo viejo se va por arriba) */}
      <div className="flex h-[292px] flex-col justify-end gap-2 overflow-hidden px-3.5 py-4">
        {items.map((it) => (
          <Bubble key={it.id} from={it.msg.from} text={it.msg.text} animate={it.animate} />
        ))}
        {typing && <Typing />}
      </div>
    </div>
  );
}

function Bubble({ from, text, animate }: Msg & { animate: boolean }) {
  const henry = from === "henry";
  return (
    <div className={(animate ? "henry-bubble " : "") + "flex " + (henry ? "justify-start" : "justify-end")}>
      <div
        className={
          "max-w-[80%] px-3.5 py-2 text-[13px] leading-snug shadow-bubble " +
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
