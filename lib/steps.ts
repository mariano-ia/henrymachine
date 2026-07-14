/**
 * Pasos estimados a partir de la distancia. ~1,3 pasos por metro (paso medio
 * ~0,76 m). Redondeado a la centena para que se lea como estimación, no dato exacto.
 */
export function metersToSteps(m: number | null): number | null {
  if (!m || m <= 0) return null;
  return Math.round((m * 1.3) / 100) * 100;
}

/** "~3.600 pasos" (o "—" si no hay dato). Separador de miles con punto (es-AR). */
export function fmtSteps(m: number | null): string {
  const s = metersToSteps(m);
  if (s == null) return "—";
  return `~${s.toLocaleString("es-AR")} pasos`;
}
