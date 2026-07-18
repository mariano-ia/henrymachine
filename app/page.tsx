import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import CatalogGrid, { type Exp } from "@/components/CatalogGrid";
import SocialLinks from "@/components/SocialLinks";
import HeroChat from "@/components/HeroChat";
import LeadCapture from "@/components/LeadCapture";
import Leaderboard from "@/components/Leaderboard";
import TrackView from "@/components/TrackView";
import { getCountryLeaderboard, SAMPLE_LEADERBOARD } from "@/lib/db/leaderboard";

// ISR: el catálogo y el leaderboard cambian lento. En vez de pegar a Supabase en
// CADA visita (crítico en el pico del lanzamiento), se sirve cacheado y se
// revalida cada 60 s. Datos 100% públicos → admin client sin cookies (no fuerza
// render dinámico). country_leaderboard deja de correr por request.
export const revalidate = 60;

export default async function Home() {
  const sb = createAdminClient();
  const { data } = await sb
    .from("experiences_public")
    .select(
      "id, slug, title, city, neighborhood, theme, pitch, expected_minutes, distance_m, price_cents, stops_count, cover_path, card_image_path"
    )
    .order("published_at", { ascending: false });
  const experiences = (data ?? []) as Exp[];
  const realLeaderboard = await getCountryLeaderboard(10);
  // mientras no haya recorridos terminados reales, mostramos datos de ejemplo
  // (marcados como tales) para que se vea el diseño del ranking.
  const leaderboard = realLeaderboard.length ? realLeaderboard : SAMPLE_LEADERBOARD;
  const leaderboardIsSample = realLeaderboard.length === 0;

  return (
    <main className="henry-home min-h-[100dvh] overflow-x-hidden bg-paper text-ink antialiased">
      <TrackView name="view_home" />
      {/* ===================== HERO (skyline al atardecer) ===================== */}
      <section className="henry-grain relative overflow-hidden bg-night text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero_background.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
        />
        {/* velo para legibilidad: más oscuro donde vive el texto */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25" />
        <div className="relative z-10 mx-auto max-w-editorial px-5 sm:px-10">
          {/* NAV */}
          <header className="flex items-center justify-between py-5">
            <Link href="/" className="block leading-none">
              <span className="block font-condensed text-[20px] font-bold uppercase tracking-[-0.015em] text-white sm:text-[23px]">
                La Nueva York de Henry
              </span>
              <span className="mt-0.5 block font-hand text-[16px] leading-none text-white/75 sm:text-[18px]">
                by Resilentos
              </span>
            </Link>
            {/* redes de Henry + acceso a recorridos */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:block">
                <SocialLinks tone="light" />
              </div>
              <Link href="/mis-recorridos" className="rounded-full border border-white/25 px-3.5 py-1.5 text-[12px] font-semibold text-white/85 transition hover:bg-white/10">
                Mis recorridos
              </Link>
            </div>
          </header>

          {/* HERO: copy + chat */}
          <div className="grid gap-9 pb-14 pt-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:pb-24 lg:pt-12">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-label text-white/70">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                Nueva York · a pie · por chat
              </span>
              <h1 className="mt-5 text-[clamp(1.75rem,6.5vw,3.4rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-white">
                Camina Nueva York con Henry
              </h1>
              {/* hook en la voz de Henry (manuscrita) */}
              <p className="mt-2 font-hand text-[clamp(1.7rem,6vw,2.6rem)] leading-none text-brand">
                la ciudad que no sale en las guías
              </p>
              <p className="mt-5 max-w-[42ch] text-[14.5px] leading-relaxed text-white/60">
                Elige un recorrido y te voy guiando por chat, parada por parada,
                como si le escribieras a un amigo que conoce cada cuadra.
              </p>
            </div>

            <div className="flex min-w-0 justify-center lg:justify-end">
              <HeroChat />
            </div>
          </div>
        </div>
      </section>

      {/* ===================== CATÁLOGO + RANKING (sidebar) ===================== */}
      <div id="recorridos" className="mx-auto max-w-editorial px-5 sm:px-10">
        <div className="grid gap-8 lg:grid-cols-4 lg:gap-10">
          <div className="lg:col-span-3">
            <CatalogGrid experiences={experiences} />
          </div>
          <aside className="lg:col-span-1 lg:pt-[88px]">
            <div className="lg:sticky lg:top-6">
              <Leaderboard rows={leaderboard} sample={leaderboardIsSample} />
            </div>
          </aside>
        </div>
      </div>

      {/* ===================== NOVEDADES (captura de leads) ===================== */}
      <section className="border-t border-ink/10 bg-card">
        <div className="mx-auto flex max-w-editorial flex-col gap-4 px-5 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div className="max-w-md">
            <h2 className="text-[20px] font-semibold tracking-tight text-ink">
              Todavía no vienes a Nueva York?
            </h2>
            <p className="mt-1 text-[14px] leading-relaxed text-ink/55">
              Déjame tu mail y te aviso cuando sume un recorrido nuevo. Sin spam, palabra de Henry.
            </p>
          </div>
          <LeadCapture source="home" />
        </div>
      </section>

      {/* ===================== PIE ===================== */}
      <footer className="border-t border-ink/10">
        <div className="mx-auto flex max-w-editorial flex-col gap-3 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <p className="leading-none">
            <span className="block font-condensed text-[17px] font-bold uppercase tracking-[-0.015em] text-ink">
              La Nueva York de Henry
            </span>
            <span className="mt-0.5 block font-hand text-[15px] leading-none text-ink/55">
              by Resilentos
            </span>
          </p>
          <div className="flex items-center gap-5">
            <SocialLinks tone="dark" />
            <p className="hidden font-hand text-[19px] leading-none text-ink/50 sm:block">nos vemos en la esquina</p>
          </div>
        </div>
        <div className="mx-auto flex max-w-editorial items-center gap-3 px-5 pb-4 text-[10px] text-ink/30 sm:px-10">
          <span>Henry virtual · IA entrenada con la personalidad de Henry</span>
          <span aria-hidden>·</span>
          <Link href="/terminos" className="underline underline-offset-2 hover:text-ink/60">
            Términos y reembolsos
          </Link>
        </div>
      </footer>
    </main>
  );
}
