// Sistema de temas inspirado en la señalética del subte de NYC: un color sólido
// por tema (tomados de las líneas del subte). Fuente de verdad compartida por el
// catálogo, el detalle y el chat.
export type ThemeInfo = { color: string; on: string; label: string };

export const THEMES: Record<string, ThemeInfo> = {
  Comida: { color: "#EE352E", on: "#ffffff", label: "Comida" }, // 1/2/3 rojo
  Vistas: { color: "#0039A6", on: "#ffffff", label: "Vistas" }, // A/C/E azul
  "Vida local": { color: "#00933C", on: "#ffffff", label: "Vida local" }, // 4/5/6 verde
  Clásicos: { color: "#FF6319", on: "#ffffff", label: "Clásicos" }, // B/D/F naranja
  Arte: { color: "#B933AD", on: "#ffffff", label: "Arte" }, // 7 violeta
  Historia: { color: "#996633", on: "#ffffff", label: "Historia" }, // J/Z marrón
  Noche: { color: "#14161B", on: "#ffffff", label: "Noche" }, // negro
  Compras: { color: "#FCCC0A", on: "#1A1A1A", label: "Compras" }, // N/Q/R amarillo (texto oscuro)
};

export const themeInfo = (t?: string | null): ThemeInfo =>
  THEMES[t ?? ""] ?? { color: "#5B6169", on: "#ffffff", label: t ?? "Recorrido" };
