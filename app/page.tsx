import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CatalogGrid, { type Exp } from "@/components/CatalogGrid";
import HeroChat from "@/components/HeroChat";
import TrackView from "@/components/TrackView";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sb = await createClient();
  const { data } = await sb
    .from("experiences_public")
    .select(
      "id, slug, title, city, neighborhood, theme, pitch, expected_minutes, distance_m, price_cents, stops_count, cover_path"
    )
    .order("published_at", { ascending: false });
  const experiences = (data ?? []) as Exp[];

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
            {/* redes de Henry */}
            <div className="flex items-center gap-4 text-white/65">
              <a href="https://www.tiktok.com/@resilentos" target="_blank" rel="noreferrer" aria-label="TikTok" className="transition-colors hover:text-white">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-[19px] w-[19px]">
                  <path d="M21 8.6a7.4 7.4 0 0 1-4.5-1.5v6.9a6.4 6.4 0 1 1-6.4-6.4c.3 0 .7 0 1 .1v3.3a3.2 3.2 0 1 0 2.3 3.1V2h3.1a4.5 4.5 0 0 0 .1.9A4.5 4.5 0 0 0 18.6 6a4.4 4.4 0 0 0 2.4.7z" />
                </svg>
              </a>
              <a href="https://www.youtube.com/@Resilentos" target="_blank" rel="noreferrer" aria-label="YouTube" className="transition-colors hover:text-white">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-[21px] w-[21px]">
                  <path d="M23 7.9a2.8 2.8 0 0 0-2-2C19.2 5.4 12 5.4 12 5.4s-7.2 0-9 .5a2.8 2.8 0 0 0-2 2A29 29 0 0 0 .6 12 29 29 0 0 0 1 16.1a2.8 2.8 0 0 0 2 2c1.8.5 9 .5 9 .5s7.2 0 9-.5a2.8 2.8 0 0 0 2-2A29 29 0 0 0 23.4 12 29 29 0 0 0 23 7.9zM9.8 14.8V9.2l6 2.8z" />
                </svg>
              </a>
              <a href="https://www.facebook.com/resilentos" target="_blank" rel="noreferrer" aria-label="Facebook" className="transition-colors hover:text-white">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-[19px] w-[19px]">
                  <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z" />
                </svg>
              </a>
              <a href="https://www.instagram.com/resilentos/" target="_blank" rel="noreferrer" aria-label="Instagram" className="transition-colors hover:text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-[19px] w-[19px]">
                  <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
                  <circle cx="12" cy="12" r="4.2" />
                  <circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" stroke="none" />
                </svg>
              </a>
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
                Caminá Nueva York con Henry
              </h1>
              {/* hook en la voz de Henry (manuscrita) */}
              <p className="mt-2 font-hand text-[clamp(1.7rem,6vw,2.6rem)] leading-none text-brand">
                la ciudad que no sale en las guías
              </p>
              <p className="mt-5 max-w-[42ch] text-[14.5px] leading-relaxed text-white/60">
                Elegí un recorrido y te voy guiando por chat, parada por parada,
                como si le escribieras a un amigo que conoce cada cuadra.
              </p>
            </div>

            <div className="flex min-w-0 justify-center lg:justify-end">
              <HeroChat />
            </div>
          </div>
        </div>
      </section>

      {/* ===================== CATÁLOGO ===================== */}
      <div className="mx-auto max-w-editorial px-5 sm:px-10">
        <CatalogGrid experiences={experiences} />
      </div>

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
          <p className="font-hand text-[19px] leading-none text-ink/50">nos vemos en la esquina</p>
        </div>
        <p className="mx-auto max-w-editorial px-5 pb-4 text-[10px] text-ink/30 sm:px-10">
          Henry virtual · IA entrenada con la personalidad de Henry
        </p>
      </footer>
    </main>
  );
}
