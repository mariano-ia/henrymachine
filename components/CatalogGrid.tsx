"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ThemeBadge from "@/components/ThemeBadge";
import { themeInfo } from "@/lib/themes";
import { fmtSteps } from "@/lib/steps";

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
  cover_path: string | null;
  card_image_path: string | null;
};

const ALL = "__all__";

function coverUrl(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/experience-covers/${path}`;
}
function fmtDuration(min: number | null): string {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
function priceLabel(cents: number | null): string {
  return !cents || cents === 0 ? "Gratis" : `$${(cents / 100).toFixed(2)}`;
}
const uniq = (vals: (string | null)[]) => [...new Set(vals.filter(Boolean) as string[])];

function Meta({ e }: { e: Exp }) {
  const bits = [
    fmtDuration(e.expected_minutes),
    fmtSteps(e.distance_m),
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
  const [freeOnly, setFreeOnly] = useState(false);

  const themes = useMemo(() => uniq(experiences.map((e) => e.theme)), [experiences]);

  const filtered = experiences.filter((e) => {
    if (theme !== ALL && e.theme !== theme) return false;
    if (freeOnly && (e.price_cents ?? 0) !== 0) return false;
    return true;
  });

  return (
    <section id="experiencias" className="pb-20 pt-8">
      {/* ---- FILTROS: una sola fila, sin card flotante ---- */}
      <div className="mb-7 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => setTheme(ALL)}
          className={
            "shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors " +
            (theme === ALL ? "bg-ink text-paper" : "text-ink/60 hover:bg-ink/5 hover:text-ink")
          }
        >
          Todos
        </button>
        {themes.map((t) => {
          const active = theme === t;
          return (
            <button
              key={t}
              onClick={() => setTheme(active ? ALL : t)}
              className={
                "inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors " +
                (active ? "bg-ink text-paper" : "text-ink/60 hover:bg-ink/5 hover:text-ink")
              }
            >
              <ThemeBadge theme={t} size={16} />
              {t}
            </button>
          );
        })}
        <span className="mx-1 h-5 w-px shrink-0 bg-ink/15" />
        <button
          onClick={() => setFreeOnly(!freeOnly)}
          className={
            "shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors " +
            (freeOnly ? "bg-local text-white" : "text-ink/60 hover:bg-ink/5 hover:text-ink")
          }
        >
          Gratis
        </button>
      </div>

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
            // la card prefiere su imagen cuadrada; si no, el cover del detalle
            const cover = coverUrl(e.card_image_path ?? e.cover_path);
            return (
              <Link
                key={e.id}
                href={`/e/${e.slug}`}
                className="group flex overflow-hidden rounded-2xl border border-ink/10 bg-card shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-card-hover sm:flex-col"
              >
                {/* cover: foto real (o bloque de color como fallback) */}
                <div
                  className="relative aspect-square w-[104px] shrink-0 overflow-hidden sm:aspect-[4/3] sm:w-full"
                  style={cover ? undefined : { background: ti.color }}
                >
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover}
                      alt={e.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center opacity-90">
                      <ThemeBadge theme={e.theme} size={46} className="ring-2 ring-white/25" />
                    </span>
                  )}
                  {/* badge del tema SOBRE la imagen */}
                  <span className="absolute left-2 top-2">
                    <ThemeBadge
                      theme={e.theme}
                      size={26}
                      className="shadow-[0_1px_6px_rgba(0,0,0,0.35)] ring-2 ring-white"
                    />
                  </span>
                  <span className="absolute right-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
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
