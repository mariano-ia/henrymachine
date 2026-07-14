"use client";

import { useState } from "react";

/** "Avisame del próximo recorrido" — captura de email para no-compradores. */
export default function LeadCapture({
  source,
  slug,
  variant = "light",
}: {
  source: string;
  slug?: string;
  variant?: "light" | "dark";
}) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const dark = variant === "dark";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return;
    setBusy(true);
    try {
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source, slug }),
      });
    } catch {
      /* igual mostramos el gracias */
    }
    setDone(true);
    setBusy(false);
  }

  if (done) {
    return (
      <p className={"font-hand text-[20px] " + (dark ? "text-brand" : "text-brand")}>
        ¡Listo! Te aviso cuando sume un recorrido nuevo, querubín 🤙
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        placeholder="tu@email.com"
        className={
          "flex-1 rounded-full px-4 py-2.5 text-[15px] outline-none " +
          (dark
            ? "border border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-white/50"
            : "border border-ink/15 bg-white text-ink placeholder:text-ink/40 focus:border-ink/40")
        }
      />
      <button
        type="submit"
        disabled={busy}
        className="shrink-0 rounded-full bg-brand px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
      >
        {busy ? "…" : "Avisame"}
      </button>
    </form>
  );
}
