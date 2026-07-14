/** ISO-2 (PE, AR, US...) → bandera emoji con regional indicator symbols. */
export function flagEmoji(iso2: string | null): string {
  if (!iso2 || iso2.length !== 2) return "🌎";
  const cc = iso2.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "🌎";
  return String.fromCodePoint(...[...cc].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

const NAMES: Record<string, string> = {
  PE: "Perú",
  AR: "Argentina",
  MX: "México",
  CO: "Colombia",
  CL: "Chile",
  ES: "España",
  US: "Estados Unidos",
  EC: "Ecuador",
  VE: "Venezuela",
  UY: "Uruguay",
  BO: "Bolivia",
  PY: "Paraguay",
  BR: "Brasil",
  CR: "Costa Rica",
  PA: "Panamá",
  GT: "Guatemala",
  DO: "Rep. Dominicana",
};

/** Nombre del país en español (fallback: el código). */
export function countryName(iso2: string | null): string {
  if (!iso2) return "El mundo";
  return NAMES[iso2.toUpperCase()] ?? iso2.toUpperCase();
}
