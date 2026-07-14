/** Formato de precio unificado en TODO el sitio: "US$6", "US$6,50", "Gratis". */
export function fmtUsd(cents: number | null): string {
  if (!cents || cents <= 0) return "Gratis";
  const whole = cents % 100 === 0;
  const n = whole ? String(cents / 100) : (cents / 100).toFixed(2).replace(".", ",");
  return `US$${n}`;
}
