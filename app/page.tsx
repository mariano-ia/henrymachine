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
    <main className="henry-home min-h-[100dvh] bg-paper text-ink antialiased">
      {/* ===================== HERO (ciudad, neutro) ===================== */}
      <section className="relative bg-ink text-paper">
        <div className="mx-auto max-w-editorial px-6 sm:px-10">
          {/* NAV */}
          <header className="flex items-start justify-between pt-7">
            <Link href="/" className="leading-[1.1] text-paper">
              <span className="block text-[13px] font-medium tracking-tight">Henry</span>
              <span className="block text-[9px] font-medium uppercase tracking-label text-paper/40">
                New York
              </span>
            </Link>
            <ul className="flex items-center gap-7 pt-1 text-[10px] font-medium uppercase tracking-label text-paper/55">
              <li className="hidden sm:block">
                <Link href="#experiencias" className="transition-colors hover:text-paper">
                  Experiencias
                </Link>
              </li>
              <li className="hidden sm:block">
                <Link href="#como-funciona" className="transition-colors hover:text-paper">
                  Cómo funciona
                </Link>
              </li>
              <li>
                <Link href="#henry" className="transition-colors hover:text-paper">
                  Henry
                </Link>
              </li>
            </ul>
          </header>

          {/* HERO: copy a la izquierda, chat en loop a la derecha */}
          <div className="grid items-center gap-12 pb-32 pt-16 sm:pb-40 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-paper/15 px-3 py-1.5 text-[9.5px] font-medium uppercase tracking-label text-paper/65">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                Nueva York · recorridos por chat
              </span>
              <h1 className="mt-6 text-[clamp(2rem,5.2vw,3.6rem)] font-medium leading-[1.06] tracking-[-0.015em] text-paper">
                Chateá con <span className="text-brand">Henry</span> y recorré
                Nueva York a pie
              </h1>
              <p className="mt-5 max-w-[46ch] text-[13px] leading-[1.75] text-paper/60">
                Le escribís y él te va guiando parada por parada, en su propia
                voz —como un amigo que conoce cada cuadra. Elegí un recorrido y
                arrancá la charla.
              </p>
            </div>

            <div className="hidden justify-end lg:flex">
              <HeroChat />
            </div>
          </div>
        </div>
      </section>

      {/* ===================== CATÁLOGO (card de filtros + grid) ===================== */}
      <div className="mx-auto max-w-editorial px-6 sm:px-10">
        <CatalogGrid experiences={experiences} />
      </div>

      {/* ===================== PIE ===================== */}
      <footer className="mt-10 border-t border-ink/15">
        <div className="mx-auto flex max-w-editorial flex-col gap-4 px-6 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-10">
          <p className="text-[13px] font-medium tracking-tight">
            Henry <span className="font-normal text-ink/50">— New York</span>
          </p>
          <p className="text-[10px] font-medium uppercase tracking-label text-ink/40">
            Recorridos guiados a pie
          </p>
        </div>
      </footer>
    </main>
  );
}
