"use client";

// Dedupe de la captura de email: si ya lo tenemos (lo dejó antes), no re-pedir,
// y sirve para pre-completar Stripe.
const KEY = "henry_email";

export function getCapturedEmail(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setCapturedEmail(email: string) {
  try {
    localStorage.setItem(KEY, email);
  } catch {
    /* storage bloqueado */
  }
}
