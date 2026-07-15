"use client";

// Países del picker (orden pensado para la audiencia: LatAm primero). Los nombres
// y banderas salen de lib/country.ts.
export const COUNTRY_OPTIONS = [
  "PE", "MX", "AR", "CO", "US", "CL", "EC", "VE", "ES", "BO", "UY", "PY", "BR", "CR", "PA", "GT", "DO",
];

const KEY = "henry_country";

export function getCountry(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setCountry(iso2: string) {
  try {
    localStorage.setItem(KEY, iso2);
  } catch {
    /* storage bloqueado */
  }
}
