"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type Exp = {
  id: string;
  slug: string;
  title: string;
  city: string | null;
  neighborhood: string | null;
  theme: string | null;
  pitch: string | null;
  expected_minutes: number | null;
  distance_m: number | null;
  price_cents: number | null;
  stops_count: number | null;
};

const ALL = "__all__";

/* ----------------------------- color por tema ----------------------------- */
const THEME_COLOR: Record<string, string> = {
  Comida: "#B8492E",
  Vistas: "#3A6B97",
  "Vida local": "#3C7A55",
  Clásicos: "#A87C2E",
};
const themeColor = (t: string | null) => THEME_COLOR[t ?? ""] ?? "#7A7268";

/* ------------------------------- formatters ------------------------------- */
function fmtDuration(min: number | null): string {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
function fmtDistance(m: number | null): string {
  if (!m) return "—";
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}
function fmtPrice(cents: number | null): string {
  return !cents || cents === 0 ? "Gratis" : `$${(cents / 100).toFixed(2)}`;
}
const uniq = (vals: (string | null)[]) => [...new Set(vals.filter(Boolean) as string[])];

/* --------------------------------- íconos --------------------------------- */
const ico = "h-2.5 w-2.5 shrink-0";
const Clock = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className={ico}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.8V8l2.2 1.3" />
  </svg>
);
const Route = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={ico}>
    <circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="4" r="1.4" fill="currentColor" stroke="none" />
    <path d="M5.2 11.4C8 11 7.4 5.4 10.8 4.8" />
  </svg>
);
const Pin = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className={ico}>
    <path d="M8 14s4.4-4.1 4.4-7.2A4.4 4.4 0 0 0 3.6 6.8C3.6 9.9 8 14 8 14Z" />
    <circle cx="8" cy="6.6" r="1.5" />
  </svg>
);
function ThemeGlyph({ theme, className }: { theme: string | null; className?: string }) {
  const c = className ?? "";
  switch (theme) {
    case "Vistas":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={c}>
          <circle cx="17.5" cy="6.5" r="2.4" />
          <path d="M1 21l6.5-10 4 5.5L15 11l8 10z" />
        </svg>
      );
    case "Vida local":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={c}>
          <path d="M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Z" />
          <path d="M16 9h2.5a2 2 0 0 1 0 4H16" />
        </svg>
      );
    case "Clásicos":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={c}>
          <path d="M12 3l2.6 5.6 6.1.7-4.5 4.1 1.2 6L12 16.7 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3z" />
        </svg>
      );
    default: // Comida
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={c}>
          <path d="M6 2v7a2.2 2.2 0 0 0 1.3 2V22h1.4V11A2.2 2.2 0 0 0 10 9V2H8.8v5.2H8V2H6.7v5.2H6V2Z" />
          <path d="M16.5 2c-1.4 0-2.4 2.4-2.4 5.4 0 2 .9 3.3 2 3.6V22h1.5V2h-1.1Z" />
        </svg>
      );
  }
}

/* -------------------------------- filtros --------------------------------- */
function Field({
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  label: string;
  value: string;
  allLabel: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex-1 px-5 py-3.5">
      <span className="block text-[9.5px] font-medium uppercase tracking-label text-ink/40">
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full cursor-pointer appearance-none bg-transparent pr-6 text-[13.5px] font-medium text-ink focus:outline-none"
        >
          <option value={ALL}>{allLabel}</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

export default function CatalogGrid({ experiences }: { experiences: Exp[] }) {
  const [theme, setTheme] = useState(ALL);
  const [city, setCity] = useState(ALL);
  const [price, setPrice] = useState(ALL);

  const themes = useMemo(() => uniq(experiences.map((e) => e.theme)), [experiences]);
  const cities = useMemo(() => uniq(experiences.map((e) => e.city)), [experiences]);

  const filtered = experiences.filter((e) => {
    if (theme !== ALL && e.theme !== theme) return false;
    if (city !== ALL && e.city !== city) return false;
    if (price === "Gratis" && (e.price_cents ?? 0) !== 0) return false;
    if (price === "De pago" && (e.price_cents ?? 0) === 0) return false;
    return true;
  });

  return (
    <section id="experiencias" className="pb-24">
      {/* --------- CARD PRINCIPAL: filtros, flotando sobre el hero --------- */}
      <div className="relative z-10 -mt-16 sm:-mt-20">
        <div className="rounded-2xl border border-ink/10 bg-white p-2 shadow-[0_30px_70px_-40px_rgba(28,27,24,0.6)]">
          <div className="flex flex-col divide-y divide-ink/10 sm:flex-row sm:items-stretch sm:divide-x sm:divide-y-0">
            <Field label="Tema" allLabel="Todos" value={theme} options={themes} onChange={setTheme} />
            <Field label="Zona" allLabel="Todas" value={city} options={cities} onChange={setCity} />
            <Field
              label="Precio"
              allLabel="Todas"
              value={price}
              options={["Gratis", "De pago"]}
              onChange={setPrice}
            />
            <div className="flex items-center gap-2 px-5 py-3.5">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              <span className="text-[10px] font-medium uppercase tracking-label text-ink/55">
                {filtered.length} {filtered.length === 1 ? "recorrido" : "recorridos"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------- GRID 4 COLUMNAS ------------------------- */}
      {filtered.length === 0 ? (
        <p className="py-24 text-center text-sm font-medium text-ink/40">
          No hay recorridos con esos filtros.
        </p>
      ) : (
        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((e) => {
            const tc = themeColor(e.theme);
            return (
              <Link
                key={e.id}
                href={`/e/${e.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-card shadow-[0_2px_10px_-6px_rgba(28,27,24,0.16)] transition-all duration-200 hover:-translate-y-1 hover:border-ink/20 hover:shadow-[0_24px_50px_-30px_rgba(28,27,24,0.45)]"
              >
                {/* COVER neutro con acento de tema */}
                <div className="relative h-32 overflow-hidden bg-gradient-to-br from-[#EAE7DF] to-[#D7D3C9]">
                  <ThemeGlyph
                    theme={e.theme}
                    className="absolute -bottom-4 -right-3 h-28 w-28 text-ink/[0.07]"
                  />
                  <span
                    className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-[3px] text-[8px] font-medium uppercase tracking-label backdrop-blur-sm"
                    style={{ color: tc }}
                  >
                    <span className="h-1 w-1 rounded-full" style={{ background: tc }} />
                    {e.theme ?? "Recorrido"}
                  </span>
                  <span className="absolute right-3 top-3 rounded-full bg-ink px-2.5 py-1 text-[10.5px] font-medium tracking-wide text-paper">
                    {fmtPrice(e.price_cents)}
                  </span>
                  <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 text-[8.5px] font-medium uppercase tracking-label text-ink/65 transition-opacity duration-200 group-hover:opacity-0">
                    <Pin />
                    {e.neighborhood ?? e.city ?? "—"}
                  </span>
                  {/* hover: botón "más info" */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/0 opacity-0 transition-all duration-200 group-hover:bg-ink/25 group-hover:opacity-100">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-[9.5px] font-semibold uppercase tracking-label text-ink shadow-md">
                      Más info <span aria-hidden>→</span>
                    </span>
                  </div>
                </div>

                {/* CONTENIDO */}
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-[1.05rem] font-medium leading-[1.22] tracking-[-0.01em] text-ink">
                    {e.title}
                  </h3>
                  {e.pitch && (
                    <p className="mt-2 line-clamp-2 flex-1 text-[12px] leading-[1.65] text-ink/50">
                      {e.pitch}
                    </p>
                  )}

                  <div className="mt-5 flex items-center gap-4 border-t border-ink/10 pt-4 text-[12px] font-medium text-ink/70">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock />
                      {fmtDuration(e.expected_minutes)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Route />
                      {fmtDistance(e.distance_m)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Pin />
                      {e.stops_count ?? "—"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
