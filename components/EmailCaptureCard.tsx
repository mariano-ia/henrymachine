"use client";

import { useState } from "react";
import { setCapturedEmail } from "@/lib/email-capture";

/** Tarjeta de captura de email reutilizable (momento de arranque y paywall). */
export default function EmailCaptureCard({
  title,
  source,
  slug,
  onDone,
  onSkip,
}: {
  title: string;
  source: string;
  slug?: string;
  onDone: () => void;
  onSkip?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return;
    setBusy(true);
    setCapturedEmail(v);
    try {
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: v, source, slug }),
      });
    } catch {
      /* no romper la UX por un lead */
    }
    setBusy(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-ink/10 bg-white p-3 shadow-bubble">
      <p className="text-[14px] leading-snug text-ink">{title}</p>
      <div className="mt-2 flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="tu@email.com"
          aria-label="Tu email"
          className="min-w-0 flex-1 rounded-full border border-ink/15 px-3.5 py-2 text-[16px] text-ink outline-none focus:border-ink/40"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {busy ? "…" : "Guardar"}
        </button>
      </div>
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-1.5 text-[12px] text-ink/45 underline underline-offset-2"
        >
          Ahora no
        </button>
      )}
    </form>
  );
}
