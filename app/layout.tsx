import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk, Caveat, Oswald } from "next/font/google";
import "./globals.css";

// UI / sistema: grotesca con carácter (jerarquía por pesos).
const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Voz de Henry: manuscrita legible, SOLO para acentos (caption de fotos, tip de
// Henry, hook del hero). Nunca en botones, nav, precios ni formularios.
const hand = Caveat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hand",
  display: "swap",
});

// Condensada, se conserva para las vistas viejas (/demo).
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Henry — Nueva York a pie, por chat",
  description:
    "Micro-recorridos a pie por Nueva York guiados por chat. Henry te lleva parada por parada, como un amigo local.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#14161b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${sans.variable} ${hand.variable} ${oswald.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
