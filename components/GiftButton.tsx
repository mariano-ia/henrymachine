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
      <div className="mt-2">
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-full border border-ink/15 py-3 text-[14px] font-semibold text-ink/70 transition-colors hover:border-ink/40 hover:text-ink"
        >
          Comprar para otro día
        </button>
        <p className="mt-1.5 px-1 text-center text-[12px] leading-relaxed text-ink/45">
          Comprás ahora y lo usás cuando quieras. Lo guardamos en el email que pongas —
          entrás desde cualquier dispositivo en “Mis recorridos”. También sirve para regalárselo a alguien.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-ink/12 bg-paper p-3.5">
      <p className="text-[13px] font-semibold text-ink">Comprar para otro día</p>
      <p className="mb-2.5 mt-0.5 text-[12px] leading-relaxed text-ink/50">
        Poné el email donde querés tenerlo (el tuyo, o el de quien se lo regalás). Con ese
        email se accede al recorrido, cuando quieran.
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email para acceder"
        className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-[15px] text-ink outline-none focus:border-ink/40"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        placeholder="Un mensaje (opcional, si es un regalo)"
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
          {busy ? "Abriendo el pago…" : "Comprar y pagar"}
        </button>
      </div>
    </div>
  );
}
