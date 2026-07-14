"use client";

import { useEffect, useState } from "react";

/** Regalar un recorrido: el acceso va al email del regalado, no al comprador. */
export default function GiftButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [anonId, setAnonId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let id = localStorage.getItem("henry_anon");
    if (!id) {
      id = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
      localStorage.setItem("henry_anon", id);
    }
    setAnonId(id);
  }, []);

  async function send() {
    setErr(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setErr("Poné un email válido.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId, gift: true, recipientEmail: email.trim(), giftMessage: message.trim() }),
      });
      const d = await res.json();
      if (d.url) window.location.href = d.url;
      else {
        setErr(d.error ?? "No se pudo iniciar el regalo.");
        setBusy(false);
      }
    } catch {
      setErr("No se pudo iniciar el regalo.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-full border border-ink/15 py-3 text-[14px] font-semibold text-ink/70 transition-colors hover:border-ink/40 hover:text-ink"
      >
        🎁 Regalarlo a alguien
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-ink/12 bg-paper p-3.5">
      <p className="mb-2 text-[13px] font-semibold text-ink">Regalar este recorrido</p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email de quien lo recibe"
        className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-[15px] text-ink outline-none focus:border-ink/40"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        placeholder="Un mensaje (opcional)"
        className="mt-2 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-ink/40"
      />
      {err && <p className="mt-2 text-[12px] text-red-600">{err}</p>}
      <div className="mt-2.5 flex gap-2">
        <button
          onClick={() => setOpen(false)}
          className="rounded-full px-4 py-2 text-[13px] font-semibold text-ink/50 hover:text-ink"
        >
          Cancelar
        </button>
        <button
          onClick={send}
          disabled={busy || !anonId}
          className="flex-1 rounded-full bg-brand py-2.5 text-[14px] font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          {busy ? "Abriendo el pago…" : "Regalar y pagar"}
        </button>
      </div>
    </div>
  );
}
