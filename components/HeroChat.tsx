"use client";

import { useEffect, useState } from "react";

type Msg = { from: "henry" | "user"; text: string };

// Charla de un recorrido EN CURSO: no hay saludo inicial, así el stream puede
// dar vueltas en loop y cualquier mensaje se ve repetido sin chirriar. Al
// terminar engancha de nuevo con el primero de forma natural (sigue caminando).
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
const KEEP = 9; // burbujas en memoria (las de más arriba ya salieron de cuadro)

export default function HeroChat() {
  // arranca con la charla ya empezada (mid-conversación), sin animar las iniciales
  const [items, setItems] = useState<Item[]>(() =>
    [0, 1, 2].map((i) => ({ id: i, msg: SCRIPT[i], animate: false }))
  );
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let active = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (d: number, fn: () => void) =>
      timers.push(setTimeout(() => active && fn(), d));

    let idx = 3; // siguiente del guion
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

    at(2200, step); // deja ver las iniciales y empieza a fluir, sin apuro
    return () => {
      active = false;
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="w-[358px] max-w-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#F1EFE9] shadow-[0_40px_80px_-40px_rgba(0,0,0,0.75)]">
      {/* header tipo app de mensajería */}
      <div className="flex items-center gap-3 border-b border-ink/10 bg-card px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-paper">
          H
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-medium text-ink">Henry</div>
          <div className="flex items-center gap-1.5 text-[10px] text-ink/45">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3C7A55]" />
            en línea
          </div>
        </div>
      </div>

      {/* cuerpo: ancla abajo; lo viejo se va por arriba (stream continuo) */}
      <div className="flex h-[300px] flex-col justify-end gap-1.5 overflow-hidden px-4 py-4">
        {items.map((it) => (
          <Bubble key={it.id} from={it.msg.from} text={it.msg.text} animate={it.animate} />
        ))}
        {typing && <Typing />}
      </div>
    </div>
  );
}

function Bubble({
  from,
  text,
  animate,
}: Msg & { animate: boolean }) {
  const henry = from === "henry";
  return (
    <div
      className={
        (animate ? "henry-bubble " : "") +
        "flex " +
        (henry ? "justify-start" : "justify-end")
      }
    >
      <div
        className={
          "max-w-[82%] px-3.5 py-2 text-[12.5px] leading-snug " +
          (henry
            ? "rounded-2xl rounded-bl-md border border-ink/[0.06] bg-white text-ink shadow-sm"
            : "rounded-2xl rounded-br-md bg-brand text-white")
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
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-ink/[0.06] bg-white px-3.5 py-2.5 shadow-sm">
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
