import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk, Caveat, Roboto_Condensed } from "next/font/google";
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

// Condensada: el logo ("LA NUEVA YORK DE HENRY") y display. Reemplaza a Oswald.
const condensed = Roboto_Condensed({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: "La Nueva York de Henry — by Resilentos",
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
      className={`${sans.variable} ${hand.variable} ${condensed.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
