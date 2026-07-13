import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CatalogGrid, { type Exp } from "@/components/CatalogGrid";
import HeroChat from "@/components/HeroChat";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sb = await createClient();
  const { data } = await sb
    .from("experiences_public")
    .select(
      "id, slug, title, city, neighborhood, theme, pitch, expected_minutes, distance_m, price_cents, stops_count"
    )
    .order("published_at", { ascending: false });
  const experiences = (data ?? []) as Exp[];

  return (
    <main className="henry-home min-h-[100dvh] overflow-x-hidden bg-paper text-ink antialiased">
      {/* ===================== HERO (ciudad de noche) ===================== */}
      <section className="henry-grain relative overflow-hidden bg-night text-white">
        <div className="relative z-10 mx-auto max-w-editorial px-5 sm:px-10">
          {/* NAV */}
          <header className="flex items-center justify-between py-5">
            <Link href="/" className="text-[15px] font-semibold tracking-tight text-white">
              Henry <span className="font-normal text-white/40">· NY</span>
            </Link>
            <ul className="flex items-center gap-6 text-[13px] font-medium text-white/60">
              <li className="hidden sm:block">
                <Link href="#experiencias" className="transition-colors hover:text-white">
                  Experiencias
                </Link>
              </li>
              <li>
                <Link href="#experiencias" className="transition-colors hover:text-white">
                  Cómo funciona
                </Link>
              </li>
            </ul>
          </header>

          {/* HERO: copy + chat */}
          <div className="grid gap-9 pb-14 pt-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:pb-24 lg:pt-12">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-label text-white/70">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                Nueva York · a pie · por chat
              </span>
              <h1 className="mt-5 text-[clamp(1.75rem,6.5vw,3.4rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-white">
                Caminá Nueva York con un local
              </h1>
              {/* hook en la voz de Henry (manuscrita) */}
              <p className="mt-2 font-hand text-[clamp(1.7rem,6vw,2.6rem)] leading-none text-brand">
                y ese local soy yo
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
          <p className="text-[14px] font-semibold tracking-tight text-ink">
            Henry <span className="font-normal text-ink/45">· Nueva York a pie</span>
          </p>
          <p className="font-hand text-[19px] leading-none text-ink/50">nos vemos en la esquina</p>
        </div>
      </footer>
    </main>
  );
}
