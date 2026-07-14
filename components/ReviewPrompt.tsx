"use client";

import { useState } from "react";

/** Al terminar el recorrido, Henry pide una reseña (estrellas + texto + nombre). */
export default function ReviewPrompt({ slug, anonId }: { slug: string; anonId: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (rating < 1) return;
    setBusy(true);
    try {
      await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId, rating, body: text.trim(), authorName: name.trim() }),
      });
    } catch {
      /* igual agradecemos */
    }
    setDone(true);
    setBusy(false);
  }

  if (done) {
    return (
      <p className="mt-4 text-center font-hand text-[20px] text-brand">
        ¡Gracias, querubín! Tu reseña me ayuda un montón 🙏
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-ink/10 bg-[#F4F2EC] p-4">
      <p className="flex items-center justify-center gap-2 text-center text-[14px] font-semibold text-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/henry.jpg" alt="" className="h-6 w-6 rounded-full object-cover" />
        ¿Me dejas una reseña?
      </p>
      <div className="mt-2 flex justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(i)}
            className="text-[28px] leading-none transition-transform hover:scale-110"
            style={{ color: (hover || rating) >= i ? "#D89A34" : "#00000022" }}
            aria-label={`${i} estrella${i > 1 ? "s" : ""}`}
          >
            ★
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Cuéntame cómo te fue (opcional)"
            className="mt-3 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-ink/40"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre (opcional)"
            className="mt-2 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-ink/40"
          />
          <button
            onClick={submit}
            disabled={busy}
            className="mt-2.5 w-full rounded-full bg-brand py-2.5 text-[14px] font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            {busy ? "Enviando…" : "Enviar reseña"}
          </button>
        </>
      )}
    </div>
  );
}
