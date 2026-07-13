import { themeInfo } from "@/lib/themes";

// Badge tipo "bala" del subte: círculo de color sólido con un símbolo blanco.
// Sirve en Server y Client Components (sin hooks).
function Glyph({ theme, px }: { theme?: string | null; px: number }) {
  const s = Math.round(px * 0.54);
  const common = { width: s, height: s, viewBox: "0 0 24 24", "aria-hidden": true };
  switch (theme) {
    case "Vistas":
      return (
        <svg {...common} fill="currentColor">
          <circle cx="17.5" cy="6.5" r="2.4" />
          <path d="M1 21l6.5-10 4 5.5L15 11l8 10z" />
        </svg>
      );
    case "Vida local":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Z" />
          <path d="M16 9h2.5a2 2 0 0 1 0 4H16" />
        </svg>
      );
    case "Clásicos":
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 3l2.6 5.6 6.1.7-4.5 4.1 1.2 6L12 16.7 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3z" />
        </svg>
      );
    case "Comida":
      return (
        <svg {...common} fill="currentColor">
          <path d="M6 2v7a2.2 2.2 0 0 0 1.3 2V22h1.4V11A2.2 2.2 0 0 0 10 9V2H8.8v5.2H8V2H6.7v5.2H6V2Z" />
          <path d="M16.5 2c-1.4 0-2.4 2.4-2.4 5.4 0 2 .9 3.3 2 3.6V22h1.5V2h-1.1Z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function ThemeBadge({
  theme,
  size = 28,
  className = "",
}: {
  theme?: string | null;
  size?: number;
  className?: string;
}) {
  const { color, on, label } = themeInfo(theme);
  const glyph = <Glyph theme={theme} px={size} />;
  return (
    <span
      className={"inline-flex shrink-0 items-center justify-center rounded-full " + className}
      style={{ width: size, height: size, background: color, color: on }}
      aria-label={label}
    >
      {glyph ?? (
        <span style={{ fontSize: Math.round(size * 0.44), fontWeight: 700, lineHeight: 1 }}>
          {(label[0] ?? "•").toUpperCase()}
        </span>
      )}
    </span>
  );
}
