import Link from "next/link";
import { notFound } from "next/navigation";
import { getExperienceDetail } from "@/lib/db/detail";
import BuyBar from "@/components/BuyBar";
import GiftButton from "@/components/GiftButton";
import GiftSentBanner from "@/components/GiftSentBanner";
import ThemeBadge from "@/components/ThemeBadge";
import SiteHeader from "@/components/SiteHeader";
import TrackView from "@/components/TrackView";
import { themeInfo } from "@/lib/themes";
import { metersToSteps } from "@/lib/steps";
import { flagEmoji } from "@/lib/country";
import { fmtUsd } from "@/lib/price";

export const dynamic = "force-dynamic";
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

const Clock = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="h-4 w-4">
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.8V8l2.2 1.3" />
  </svg>
);
const Route = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="4" r="1.4" fill="currentColor" stroke="none" />
    <path d="M5.2 11.4C8 11 7.4 5.4 10.8 4.8" />
  </svg>
);
const PinIco = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="h-4 w-4">
    <path d="M8 14s4.4-4.1 4.4-7.2A4.4 4.4 0 0 0 3.6 6.8C3.6 9.9 8 14 8 14Z" />
    <circle cx="8" cy="6.6" r="1.5" />
  </svg>
);
const Lock = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3.5 w-3.5">
    <rect x="3.5" y="7" width="9" height="6.5" rx="1.4" />
    <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" />
  </svg>
);
const Star = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill={on ? STAR : "none"} stroke={on ? STAR : "#00000026"} strokeWidth="1.2">
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

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-ink/40">{icon}</span>
      <div>
        <div className="text-[14px] font-semibold leading-none text-ink">{value}</div>
        <div className="mt-1 text-[10px] font-medium uppercase tracking-label text-ink/40">{label}</div>
      </div>
    </div>
  );
}

const STEPS = [
  { t: "Elige el recorrido", d: "Uno gratis o pago. Lo empiezas cuando quieras." },
  { t: "Te escribo y te guío", d: "Como un amigo. Te llevo parada por parada." },
  { t: "Caminas a tu ritmo", d: "Sin apuro. Pregúntame lo que quieras en el camino." },
];


export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exp = await getExperienceDetail(slug);
  if (!exp) return {};
  const price = fmtUsd(exp.priceCents);
  const cover = coverUrl(exp.coverPath); // helper ya existente en este archivo
  return {
    title: `${exp.title} · ${price} — La Nueva York de Henry`,
    description: exp.pitch ?? "Un recorrido a pie por Nueva York, guiado por chat por Henry.",
    openGraph: {
      title: `${exp.title} · ${price}`,
      description: exp.pitch ?? "",
      images: cover ? [cover] : ["/hero_background.jpg"],
    },
  };
}

export default async function DetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const exp = await getExperienceDetail(slug);
  if (!exp) notFound();

  const ti = themeInfo(exp.theme);
  const cover = coverUrl(exp.coverPath);

  return (
    <main className="henry-home min-h-[100dvh] bg-paper pb-24 text-ink antialiased lg:pb-0">
      <TrackView name="view_detail" slug={exp.slug} />
      {/* ---- barra superior ---- */}
      <SiteHeader tone="dark" className="bg-night text-white" />

      <div className="mx-auto max-w-editorial px-5 py-6 sm:px-10 sm:py-10">
        <GiftSentBanner title={exp.title} />
        {/* ---- PORTADA (imagen o video; placeholder = bloque de color del tema) ---- */}
        <div className="relative mb-7 h-[clamp(180px,30vw,320px)] overflow-hidden rounded-2xl">
          {cover && exp.coverKind === "video" ? (
            <video
              src={cover}
              autoPlay
              muted
              loop
              playsInline
              className="h-full w-full object-cover"
            />
          ) : cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={exp.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center" style={{ background: ti.color }}>
              <ThemeBadge theme={exp.theme} size={72} className="ring-4 ring-white/25" />
            </div>
          )}
        </div>

        {/* ---- encabezado ---- */}
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-label" style={{ color: ti.color }}>
            <ThemeBadge theme={exp.theme} size={18} />
            {ti.label}
          </span>
          <h1 className="mt-3 text-[clamp(1.8rem,5vw,2.9rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-ink">
            {exp.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink/55">
              <PinIco />
              {[exp.neighborhood, exp.city].filter(Boolean).join(" · ") || "Nueva York"}
            </span>
            {exp.ratingAvg != null && (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink/60">
                <Stars value={exp.ratingAvg} />
                {exp.ratingAvg.toString().replace(".", ",")}
                <span className="text-ink/35">({exp.ratingCount})</span>
              </span>
            )}
          </div>
          {exp.pitch && <p className="mt-5 text-[16px] leading-[1.65] text-ink/75">{exp.pitch}</p>}
          {/* tip de Henry — voz manuscrita (editable en el admin; default si no hay) */}
          <p className="mt-4 font-hand text-[22px] leading-tight text-brand">
            “{exp.henryTip ?? "Ven con hambre y zapatillas cómodas."}”
          </p>
        </div>

        {/* ---- stats strip ---- */}
        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4 rounded-2xl border border-ink/10 bg-card px-5 py-4 shadow-card">
          <Stat label="Duración" value={fmtDuration(exp.expectedMinutes)} icon={<Clock />} />
          <Stat
            label={exp.distanceM ? `Pasos · ${fmtDistance(exp.distanceM)}` : "Pasos"}
            value={metersToSteps(exp.distanceM)?.toLocaleString("es-AR") ?? "—"}
            icon={<Route />}
          />
          <Stat label="Paradas" value={String(exp.stopsCount)} icon={<PinIco />} />
        </div>

        {/* ---- dos columnas ---- */}
        <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
          <div>
            {/* cómo funciona */}
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-label text-ink/45">Cómo funciona</h2>
              <ol className="mt-5 space-y-5">
                {STEPS.map((s, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-paper">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[15px] font-semibold text-ink">{s.t}</p>
                      <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink/55">{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* itinerario — timeline con bullets tipo subte */}
            <section className="mt-11 border-t border-ink/10 pt-9">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[11px] font-bold uppercase tracking-label text-ink/45">El recorrido</h2>
                <span className="text-[11px] font-medium uppercase tracking-label text-ink/40">
                  {exp.stopsCount} paradas
                </span>
              </div>
              <ol className="mt-6">
                {exp.itinerary.map((s, i) => (
                  <li key={i} className="relative flex gap-4 pb-7 last:pb-0">
                    {i < exp.itinerary.length - 1 && (
                      <span className="absolute left-[15px] top-8 h-full w-[2px]" style={{ background: s.locked ? "#1A1A1A14" : `${ti.color}44` }} />
                    )}
                    <span
                      className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                      style={s.locked ? { background: "#1A1A1A12", color: "#1A1A1A55" } : { background: ti.color }}
                    >
                      {s.locked ? <Lock /> : s.n}
                    </span>
                    <div className="pt-1.5">
                      <p className={"text-[15px] font-semibold " + (s.locked ? "text-ink/40" : "text-ink")}>
                        {s.locked ? "Parada exclusiva" : s.title}
                      </p>
                      {s.locked && <p className="mt-0.5 text-[12.5px] text-ink/40">Se desbloquea con la compra</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* reseñas — protagonismo bajo */}
            <section className="mt-11 border-t border-ink/10 pt-9">
              <div className="mb-5 flex items-center gap-2.5">
                <h2 className="text-[11px] font-bold uppercase tracking-label text-ink/45">Reseñas</h2>
                {exp.ratingAvg != null && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink/55">
                    <Stars value={exp.ratingAvg} />
                    {exp.ratingAvg.toString().replace(".", ",")} · {exp.ratingCount}
                  </span>
                )}
              </div>
              {exp.reviews.length === 0 ? (
                <p className="text-[13.5px] text-ink/45">
                  Todavía no hay reseñas. Sé de los primeros en caminarlo y cuéntanos cómo te fue.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  {exp.reviews.slice(0, 6).map((r, i) => (
                    <figure key={i} className="rounded-xl border border-ink/8 bg-card p-4">
                      <div className="flex items-center justify-between">
                        <Stars value={r.rating} />
                        {r.country && <span className="text-[15px]">{flagEmoji(r.country)}</span>}
                      </div>
                      {r.body && (
                        <blockquote className="mt-2 text-[12.5px] leading-relaxed text-ink/60">“{r.body}”</blockquote>
                      )}
                      <figcaption className="mt-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-label text-ink/35">
                        {r.authorName ?? "Anónimo"}
                        {r.verified && <span className="text-local">✓</span>}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* card de compra sticky (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-8 rounded-2xl border border-ink/12 bg-card p-6 shadow-card-hover">
              <div className="flex items-baseline justify-between">
                <span className="text-[2rem] font-bold tracking-tight text-ink">{fmtUsd(exp.priceCents)}</span>
                {exp.priceCents > 0 && exp.freeStops > 0 && (
                  <span className="text-[11px] font-medium uppercase tracking-label text-ink/45">
                    {exp.freeStops} paradas gratis
                  </span>
                )}
              </div>
              <div className="mt-6">
                <BuyBar slug={exp.slug} priceCents={exp.priceCents} freeStops={exp.freeStops} />
              </div>
              {exp.priceCents > 0 && <GiftButton slug={exp.slug} />}
              <p className="mt-3 text-center text-[12px] leading-relaxed text-ink/45">
                {exp.priceCents > 0 ? "Pago único · lo haces cuando quieras" : "Sin costo · empiezas cuando quieras"}
              </p>
            </div>
          </aside>
        </div>

        {/* ---- opciones de compra (mobile) — la barra fija solo tiene el CTA principal ---- */}
        <div className="mt-10 border-t border-ink/10 pt-6 lg:hidden">
          {exp.priceCents > 0 && <GiftButton slug={exp.slug} />}
          <p className="mt-3 text-center text-[12px] leading-relaxed text-ink/45">
            {exp.priceCents > 0 ? "Pago único · lo haces cuando quieras" : "Sin costo · empiezas cuando quieras"}
          </p>
        </div>
      </div>

      <p className="mx-auto max-w-editorial px-5 pb-6 text-[10px] text-ink/30 sm:px-10">
        Henry virtual · IA entrenada con la personalidad de Henry
      </p>

      {/* ---- BARRA DE COMPRA FIJA (mobile) ---- */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-card/95 shadow-bar backdrop-blur lg:hidden"
        style={{ paddingBottom: "max(0.6rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-editorial items-center gap-3 px-5 pt-2.5">
          <div className="shrink-0">
            <div className="text-[10px] font-medium uppercase tracking-label text-ink/40">Precio</div>
            <div className="text-[18px] font-bold leading-tight text-ink">{fmtUsd(exp.priceCents)}</div>
          </div>
          <div className="flex-1">
            <BuyBar slug={exp.slug} priceCents={exp.priceCents} freeStops={exp.freeStops} />
          </div>
        </div>
      </div>

      {/* ---- pie ---- */}
      <footer className="hidden border-t border-ink/10 lg:block">
        <div className="mx-auto flex max-w-editorial items-center justify-between px-5 py-8 sm:px-10">
          <p className="leading-none">
            <span className="block font-condensed text-[17px] font-bold uppercase tracking-[-0.015em] text-ink">
              La Nueva York de Henry
            </span>
            <span className="mt-0.5 block font-hand text-[15px] leading-none text-ink/55">
              by Resilentos
            </span>
          </p>
          <Link href="/" className="text-[13px] font-medium text-ink/45 transition-colors hover:text-ink">
            Ver todos los recorridos
          </Link>
        </div>
      </footer>
    </main>
  );
}
