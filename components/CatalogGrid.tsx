"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ThemeBadge from "@/components/ThemeBadge";
import { themeInfo } from "@/lib/themes";

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
function priceLabel(cents: number | null): string {
  return !cents || cents === 0 ? "Gratis" : `$${(cents / 100).toFixed(2)}`;
}
const uniq = (vals: (string | null)[]) => [...new Set(vals.filter(Boolean) as string[])];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors " +
        (active
          ? "bg-ink text-paper"
          : "border border-ink/15 text-ink/70 hover:border-ink/40 hover:text-ink")
      }
    >
      {children}
    </button>
  );
}

function FilterRow({
  label,
  value,
  options,
  onChange,
  withBadge = false,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  withBadge?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-12 shrink-0 text-[10px] font-semibold uppercase tracking-label text-ink/40">
        {label}
      </span>
      <div className="flex flex-1 gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip active={value === ALL} onClick={() => onChange(ALL)}>
          Todos
        </Chip>
        {options.map((o) => (
          <Chip key={o} active={value === o} onClick={() => onChange(o)}>
            {withBadge && <ThemeBadge theme={o} size={16} />}
            {o}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Meta({ e }: { e: Exp }) {
  const bits = [
    fmtDuration(e.expected_minutes),
    fmtDistance(e.distance_m),
    e.neighborhood ?? e.city,
  ].filter(Boolean);
  return (
    <p className="text-[12.5px] leading-snug text-ink/55">
      {bits.map((b, i) => (
        <span key={i}>
          {i > 0 && <span className="px-1.5 text-ink/25">·</span>}
          {b}
        </span>
      ))}
    </p>
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
    <section id="experiencias" className="pb-20">
      {/* ---- CARD DE FILTROS (flota sobre el hero) ---- */}
      <div className="relative z-10 -mt-12 sm:-mt-16">
        <div className="space-y-2.5 rounded-2xl border border-ink/10 bg-card p-3.5 shadow-card sm:p-4">
          <FilterRow label="Tema" value={theme} options={themes} onChange={setTheme} withBadge />
          <FilterRow label="Zona" value={city} options={cities} onChange={setCity} />
          <FilterRow label="Precio" value={price} options={["Gratis", "De pago"]} onChange={setPrice} />
        </div>
      </div>

      {/* ---- contador ---- */}
      <p className="mb-4 mt-7 text-[13px] text-ink/45">
        {filtered.length} {filtered.length === 1 ? "recorrido" : "recorridos"} para caminar
      </p>

      {/* ---- GRILLA (mobile: 1 col horizontal · desktop: 4 col vertical) ---- */}
      {filtered.length === 0 ? (
        <p className="py-16 text-center text-[15px] text-ink/45">
          Henry todavía no tiene un recorrido con esos filtros.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {filtered.map((e) => {
            const ti = themeInfo(e.theme);
            const free = !e.price_cents || e.price_cents === 0;
            return (
              <Link
                key={e.id}
                href={`/e/${e.slug}`}
                className="group flex overflow-hidden rounded-2xl border border-ink/10 bg-card shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-card-hover sm:flex-col"
              >
                {/* cover: bloque de color del tema (placeholder — nunca stock) */}
                <div
                  className="relative aspect-square w-[104px] shrink-0 overflow-hidden sm:aspect-[4/3] sm:w-full"
                  style={{ background: ti.color }}
                >
                  <span className="absolute inset-0 flex items-center justify-center opacity-90">
                    <ThemeBadge theme={e.theme} size={46} className="ring-2 ring-white/25" />
                  </span>
                  <span className="absolute right-2 top-2 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                    {priceLabel(e.price_cents)}
                  </span>
                  {/* hover (desktop): más info */}
                  <div className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-black/25 opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:flex">
                    <span className="rounded-full bg-white px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-label text-ink">
                      Ver recorrido →
                    </span>
                  </div>
                </div>

                {/* body */}
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-3.5 sm:justify-start sm:p-4">
                  <span
                    className="text-[10px] font-bold uppercase tracking-label"
                    style={{ color: ti.color }}
                  >
                    {ti.label}
                  </span>
                  <h3 className="text-[16px] font-semibold leading-[1.2] tracking-[-0.01em] text-ink sm:text-[17px]">
                    {e.title}
                  </h3>
                  <Meta e={e} />
                  <span
                    className={
                      "mt-0.5 text-[13px] font-bold sm:hidden " + (free ? "text-local" : "text-ink")
                    }
                  >
                    {priceLabel(e.price_cents)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
