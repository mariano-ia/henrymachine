import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        // Titulares (serif Fraunces)
        display: ["var(--font-display)", "Georgia", "serif"],
        serif: ["var(--font-display)", "Georgia", "serif"],
        // Etiquetas tipo "ticket / sello urbano" (condensada Oswald)
        condensed: ["var(--font-condensed)", "Oswald", "Impact", "sans-serif"],
      },
      colors: {
        // Base urbana neutra (blanco / tinta)
        paper: "#FFFFFF",
        card: "#FFFFFF",
        ink: "#1C1B18",
        // Acento contenido (ladrillo / NYC sin gritar)
        brand: "#CC4E2A",
        "brand-dark": "#A93E20",
        // Color por tema (sutil, se va sumando de a poco)
        comida: "#B8492E",
        vistas: "#3A6B97",
        "vida-local": "#3C7A55",
        clasicos: "#A87C2E",
      },
      letterSpacing: {
        label: "0.18em",
      },
      maxWidth: {
        editorial: "78rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
