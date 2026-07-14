"use client";

// Captura UTM/referrer del primer aterrizaje y manda eventos por beacon.
const UTM_KEY = "henry_utm";

export function captureUtm() {
  try {
    if (localStorage.getItem(UTM_KEY)) return;
    const p = new URLSearchParams(location.search);
    const utm: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "ref"]) {
      const v = p.get(k);
      if (v) utm[k] = v.slice(0, 100);
    }
    if (document.referrer) utm.referrer = document.referrer.slice(0, 200);
    if (Object.keys(utm).length) localStorage.setItem(UTM_KEY, JSON.stringify(utm));
  } catch {}
}

export function getUtm(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(UTM_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function track(name: string, slug?: string, props?: Record<string, unknown>) {
  try {
    const anonId = localStorage.getItem("henry_anon");
    const body = JSON.stringify({ name, slug, anonId, props: { ...getUtm(), ...props } });
    navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" })) ||
      fetch("/api/track", { method: "POST", body, keepalive: true });
  } catch {}
}
