import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, Oswald } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Fraunces: serif editorial de alto contraste con itálicas caligráficas.
// Variable (sin `weight`) para que opsz/font-optical-sizing dé el contraste
// "display" automáticamente en los titulares grandes y los pesos vía CSS.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-display",
  display: "swap",
});

// Oswald (condensada) se conserva para las vistas oscuras heredadas (/demo).
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Henry — Recorré la ciudad",
  description:
    "Experiencias-recorrido guiadas por Henry. Caminá Nueva York paso a paso, en su voz.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f6f5",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${fraunces.variable} ${oswald.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
