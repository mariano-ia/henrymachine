"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SiteHeader from "@/components/SiteHeader";

export default function CuentaPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code" | "done">("email");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sb = createClient();

  async function sendCode() {
    setBusy(true); setErr(null);
    const res = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) setErr(d.error ?? "No pudimos mandarte el código. Revisa el email.");
    else setStage("code");
  }

  async function verify() {
    setBusy(true); setErr(null);
    // 1) verificamos NUESTRO código; el server devuelve un token para la sesión
    const res = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), code: code.trim() }),
    });
    const d = await res.json();
    if (!d.ok || !d.tokenHash) { setErr(d.error ?? "Código incorrecto o vencido."); setBusy(false); return; }
    // 2) establecemos la sesión con ese token (Supabase no mandó ningún email)
    const { error } = await sb.auth.verifyOtp({ token_hash: d.tokenHash, type: "email" });
    if (error) { setErr("No se pudo iniciar sesión. Inténtalo de nuevo."); setBusy(false); return; }
    // 3) unir lo anónimo de este dispositivo + compras por email
    // (si falla el merge, igual entramos: no bloqueamos el login por esto)
    try {
      const anonId = localStorage.getItem("henry_anon");
      await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonId }),
      });
    } catch {
      /* el merge puede reintentarse; la sesión ya está establecida */
    }
    setBusy(false);
    router.push("/mis-recorridos");
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-paper text-ink">
      <SiteHeader tone="light" className="border-b border-ink/10" />
      <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="font-condensed text-[26px] font-bold uppercase tracking-[-0.015em]">Tus recorridos</h1>
        <p className="mt-1 text-sm text-ink/60">
          Pon el email con el que compraste y te mandamos un código. Sin contraseñas.
        </p>
        {stage === "email" && (
          <div className="mt-6 space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com"
              className="w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-[16px] outline-none focus:border-ink/40" />
            <button onClick={sendCode} disabled={busy || !email.includes("@")}
              className="w-full rounded-full bg-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-50">
              {busy ? "Enviando…" : "Mándame el código"}
            </button>
          </div>
        )}
        {stage === "code" && (
          <div className="mt-6 space-y-3">
            <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código de 6 dígitos"
              className="w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-center text-[20px] tracking-[0.3em] outline-none focus:border-ink/40" />
            <button onClick={verify} disabled={busy || code.trim().length < 6}
              className="w-full rounded-full bg-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-50">
              {busy ? "Verificando…" : "Entrar"}
            </button>
          </div>
        )}
        {err && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{err}</p>}
      </div>
      </main>
    </div>
  );
}
