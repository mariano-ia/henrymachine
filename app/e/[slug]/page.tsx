import Link from "next/link";
import { notFound } from "next/navigation";
import { getExperienceDetail } from "@/lib/db/detail";
import BuyBar from "@/components/BuyBar";

export const dynamic = "force-dynamic";

const THEME_COLOR: Record<string, string> = {
  Comida: "#B8492E",
  Vistas: "#3A6B97",
  "Vida local": "#3C7A55",
  Clásicos: "#A87C2E",
};
const themeColor = (t: string | null) => THEME_COLOR[t ?? ""] ?? "#7A7268";
const STAR = "#D89A34";

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
function fmtDistance(m: number | null): string {
  if (!m) return "—";
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}
function fmtPrice(cents: number): string {
  return !cents || cents === 0 ? "Gratis" : `$${(cents / 100).toFixed(2)}`;
}

/* ---- íconos ---- */
const Clock = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="h-4 w-4">
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.8V8l2.2 1.3" />
  </svg>
);
const Route = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="4" r="1.4" fill="currentColor" stroke="none" />
    <path d="M5.2 11.4C8 11 7.4 5.4 10.8 4.8" />
  </svg>
);
const PinIco = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className="h-4 w-4">
    <path d="M8 14s4.4-4.1 4.4-7.2A4.4 4.4 0 0 0 3.6 6.8C3.6 9.9 8 14 8 14Z" />
    <circle cx="8" cy="6.6" r="1.5" />
  </svg>
);
const Lock = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-3.5 w-3.5">
    <rect x="3.5" y="7" width="9" height="6.5" rx="1.4" />
    <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" />
  </svg>
);
const Star = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill={on ? STAR : "none"} stroke={on ? STAR : "#00000030"} strokeWidth="1.2">
    <path d="M10 1.6l2.5 5.2 5.7.8-4.1 4 1 5.6L10 14.6l-5.1 2.6 1-5.6-4.1-4 5.7-.8z" />
  </svg>
);
const Stars = ({ value }: { value: number }) => (
  <span className="inline-flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} on={i <= Math.round(value)} />
    ))}
  </span>
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
    default:
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={c}>
          <path d="M6 2v7a2.2 2.2 0 0 0 1.3 2V22h1.4V11A2.2 2.2 0 0 0 10 9V2H8.8v5.2H8V2H6.7v5.2H6V2Z" />
          <path d="M16.5 2c-1.4 0-2.4 2.4-2.4 5.4 0 2 .9 3.3 2 3.6V22h1.5V2h-1.1Z" />
        </svg>
      );
  }
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span className="text-ink/45">{icon}</span>
      <span className="text-[14px] font-medium leading-none text-ink">{value}</span>
      <span className="text-[9.5px] font-medium uppercase tracking-label text-ink/40">{label}</span>
    </div>
  );
}

const STEPS = [
  { t: "Elegí el recorrido", d: "Uno gratis o pago. Lo empezás cuando quieras." },
  { t: "Henry te guía por chat", d: "Te escribe como un amigo y te lleva parada por parada." },
  { t: "Caminás a tu ritmo", d: "Sin apuro. Le preguntás lo que quieras en el camino." },
];

// Reseñas MOCK (placeholder hasta tener reales)
const REVIEWS = [
  { name: "Camila R.", initial: "C", rating: 5, meta: "Hace 2 semanas", text: "Sentí que un amigo me estaba mostrando la ciudad. Me llevó a lugares que sola jamás hubiera encontrado." },
  { name: "Diego M.", initial: "D", rating: 5, meta: "Hace 1 mes", text: "La mejor forma de conocer Nueva York. Íbamos charlando y cada parada era mejor que la anterior." },
  { name: "Sofía L.", initial: "S", rating: 4, meta: "Hace 1 mes", text: "Muy copada. Henry responde todo y te hace sentir local. Recontra recomendable." },
];
const RATING = 4.9;
const RATING_COUNT = 128;

export default async function DetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const exp = await getExperienceDetail(slug);
  if (!exp) notFound();

  const tc = themeColor(exp.theme);
  const cover = coverUrl(exp.coverPath);

  return (
    <main className="henry-home min-h-[100dvh] bg-paper text-ink antialiased">
      {/* ---- barra superior ---- */}
      <header className="bg-ink text-paper">
        <div className="mx-auto flex max-w-editorial items-center justify-between px-6 py-4 sm:px-10">
          <Link href="/" className="text-[13px] font-medium tracking-tight text-paper">
            Henry <span className="font-normal text-paper/45">· New York</span>
          </Link>
          <Link
            href="/"
            className="text-[10.5px] font-medium uppercase tracking-label text-paper/55 transition-colors hover:text-paper"
          >
            ← Volver
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-editorial px-6 py-8 sm:px-10 sm:py-10">
        {/* ---- FOTO DE PORTADA (slot; placeholder hasta cargar la real) ---- */}
        <div className="relative mb-8 h-[clamp(190px,26vw,320px)] overflow-hidden rounded-2xl border border-ink/8">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={exp.title} className="h-full w-full object-cover" />
          ) : (
            <div
              className="relative h-full w-full"
              style={{ background: `linear-gradient(135deg, ${tc}26, #E7E4DC 58%, #D9D5CB)` }}
            >
              <ThemeGlyph
                theme={exp.theme}
                className="absolute -bottom-8 -right-6 h-48 w-48 text-ink/[0.06]"
              />
              <span
                className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-label backdrop-blur-sm"
                style={{ color: tc }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: tc }} />
                {exp.theme ?? "Recorrido"}
              </span>
            </div>
          )}
        </div>

        {/* ---- encabezado de la experiencia ---- */}
        <div className="max-w-2xl">
          <h1 className="text-[clamp(1.9rem,4.4vw,3rem)] font-medium leading-[1.08] tracking-[-0.02em] text-ink">
            {exp.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-label text-ink/50">
              <PinIco />
              {[exp.neighborhood, exp.city].filter(Boolean).join(" · ") || "Nueva York"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink/55">
              <Stars value={RATING} />
              <span className="tabular-nums">{RATING.toString().replace(".", ",")}</span>
              <span className="text-ink/35">({RATING_COUNT})</span>
            </span>
          </div>
          {exp.pitch && (
            <p className="mt-6 text-[15px] leading-[1.7] text-ink/70">{exp.pitch}</p>
          )}
        </div>

        {/* ---- dos columnas: contenido + card de compra ---- */}
        <div className="mt-12 grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
          {/* IZQUIERDA */}
          <div>
            {/* cómo funciona */}
            <section>
              <h2 className="text-[11px] font-semibold uppercase tracking-label text-ink/45">
                Cómo funciona
              </h2>
              <ol className="mt-5 space-y-5">
                {STEPS.map((s, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-medium text-paper">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[14px] font-medium text-ink">{s.t}</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-ink/55">{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* itinerario */}
            <section className="mt-12 border-t border-ink/10 pt-10">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-label text-ink/45">
                  El recorrido
                </h2>
                <span className="text-[11px] font-medium uppercase tracking-label text-ink/40">
                  {exp.stopsCount} paradas
                </span>
              </div>

              <ol className="mt-6">
                {exp.itinerary.map((s, i) => (
                  <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
                    {i < exp.itinerary.length - 1 && (
                      <span className="absolute left-[13px] top-7 h-full w-px bg-ink/12" />
                    )}
                    <span
                      className={
                        "relative z-10 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-medium " +
                        (s.locked ? "bg-ink/5 text-ink/35" : "bg-ink text-paper")
                      }
                    >
                      {s.locked ? <Lock /> : s.n}
                    </span>
                    <div className="pt-1">
                      <p className={"text-[14.5px] font-medium " + (s.locked ? "text-ink/40" : "text-ink")}>
                        {s.locked ? "Parada exclusiva" : s.title}
                      </p>
                      {s.locked && (
                        <p className="mt-0.5 text-[12px] text-ink/40">Se desbloquea con la compra</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* DERECHA: card de compra sticky */}
          <aside className="lg:sticky lg:top-8 h-fit">
            <div className="rounded-2xl border border-ink/12 bg-card p-6 shadow-[0_24px_50px_-38px_rgba(28,27,24,0.5)]">
              <div className="flex items-baseline justify-between">
                <span className="text-[1.9rem] font-medium tracking-tight text-ink">
                  {fmtPrice(exp.priceCents)}
                </span>
                {exp.priceCents > 0 && exp.freeStops > 0 && (
                  <span className="text-[11px] font-medium uppercase tracking-label text-ink/45">
                    {exp.freeStops} gratis
                  </span>
                )}
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3 border-y border-ink/10 py-5">
                <Stat label="Duración" value={fmtDuration(exp.expectedMinutes)} icon={<Clock />} />
                <Stat label="Caminata" value={fmtDistance(exp.distanceM)} icon={<Route />} />
                <Stat label="Paradas" value={String(exp.stopsCount)} icon={<PinIco />} />
              </div>

              <div className="mt-6">
                <BuyBar slug={exp.slug} priceCents={exp.priceCents} />
              </div>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-ink/45">
                {exp.priceCents > 0
                  ? "Pago único · lo hacés cuando quieras, a tu ritmo"
                  : "Sin costo · empezás cuando quieras, a tu ritmo"}
              </p>
            </div>
          </aside>
        </div>

        {/* ---- RESEÑAS (mock) ---- */}
        <section className="mt-16 border-t border-ink/10 pt-12">
          <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-label text-ink/45">
              Lo que dice la gente
            </h2>
            <span className="inline-flex items-center gap-2 text-[13px] font-medium text-ink">
              <Stars value={RATING} />
              <span className="tabular-nums">{RATING.toString().replace(".", ",")}</span>
              <span className="text-ink/40">· {RATING_COUNT} reseñas</span>
            </span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {REVIEWS.map((r, i) => (
              <div key={i} className="rounded-2xl border border-ink/10 bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/[0.06] text-[13px] font-medium text-ink/70">
                    {r.initial}
                  </span>
                  <div>
                    <p className="text-[13px] font-medium text-ink">{r.name}</p>
                    <Stars value={r.rating} />
                  </div>
                </div>
                <p className="mt-3.5 text-[13px] leading-relaxed text-ink/65">“{r.text}”</p>
                <p className="mt-3 text-[10px] font-medium uppercase tracking-label text-ink/35">
                  {r.meta}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ---- pie ---- */}
      <footer className="border-t border-ink/15">
        <div className="mx-auto flex max-w-editorial flex-col gap-4 px-6 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-10">
          <p className="text-[13px] font-medium tracking-tight">
            Henry <span className="font-normal text-ink/50">— New York</span>
          </p>
          <Link
            href="/"
            className="text-[10.5px] font-medium uppercase tracking-label text-ink/40 transition-colors hover:text-ink"
          >
            Ver todos los recorridos
          </Link>
        </div>
      </footer>
    </main>
  );
}
