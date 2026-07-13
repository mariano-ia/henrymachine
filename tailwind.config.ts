import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Sistema (grotesca)
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        // Voz de Henry (manuscrita, solo acentos)
        hand: ["var(--font-hand)", "ui-rounded", "cursive"],
        // Condensada (/demo viejo)
        condensed: ["var(--font-condensed)", "Impact", "sans-serif"],
      },
      colors: {
        // Base clara + tinta casi negra
        paper: "#FCFBF9",
        card: "#FFFFFF",
        ink: "#1A1A1A",
        // Hero / chat: gris muy oscuro azulado (no negro puro)
        night: "#14161B",
        "night-soft": "#1E212A",
        // Acento ladrillo
        brand: "#CC4E2A",
        "brand-dark": "#A93E20",
        // Temas — señalética del subte de NYC
        comida: "#EE352E",
        vistas: "#0039A6",
        local: "#00933C",
        clasicos: "#FF6319",
        arte: "#B933AD",
        historia: "#996633",
        noche: "#14161B",
        compras: "#FCCC0A",
      },
      boxShadow: {
        card: "0 2px 14px -8px rgba(26,26,26,0.16)",
        "card-hover": "0 18px 40px -22px rgba(26,26,26,0.38)",
        bar: "0 -6px 26px -16px rgba(26,26,26,0.28)",
        bubble: "0 1px 2px rgba(26,26,26,0.10)",
      },
      letterSpacing: {
        label: "0.14em",
      },
      maxWidth: {
        editorial: "78rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
