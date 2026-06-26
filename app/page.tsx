import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function coverUrl(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/experience-covers/${path}`;
}
function price(cents: number | null): string {
  return !cents || cents === 0 ? "Gratis" : `$${(cents / 100).toFixed(2)}`;
}

export default async function Home() {
  const sb = await createClient();
  const { data } = await sb
    .from("experiences_public")
    .select("id, slug, title, city, pitch, cover_path, price_cents")
    .order("published_at", { ascending: false });
  const experiences = data ?? [];

  return (
    <main className="min-h-[100dvh]">
      {/* glows */}
      <div className="pointer-events-none fixed -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-indigo-600/15 blur-[140px]" />

      <header className="relative mx-auto max-w-5xl px-6 pb-10 pt-20 text-center sm:pt-28">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-neutral-500">
          Henry
        </p>
        <h1 className="mx-auto mt-4 max-w-2xl font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight text-white sm:text-6xl">
          Recorré la ciudad con <span className="text-rose-500">Henry</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-neutral-400">
          Experiencias guiadas, caminando, en su voz. Henry te lleva paso a paso
          y te responde en el camino.
        </p>
      </header>

      <section className="relative mx-auto max-w-5xl px-6 pb-24">
        {experiences.length === 0 ? (
          <p className="text-center text-neutral-500">Pronto, las primeras experiencias.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {experiences.map((e) => {
              const cover = coverUrl(e.cover_path);
              return (
                <Link
                  key={e.id}
                  href={`/e/${e.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/40 transition hover:border-white/20 hover:bg-neutral-900"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt={e.title ?? ""}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-600/30 via-neutral-800 to-rose-600/20">
                        <span className="font-display text-3xl uppercase tracking-tight text-white/30">
                          {e.city ?? "Henry"}
                        </span>
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                      {price(e.price_cents)}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    {e.city && (
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                        {e.city}
                      </p>
                    )}
                    <h2 className="mt-1 font-semibold leading-snug text-white">
                      {e.title}
                    </h2>
                    {e.pitch && (
                      <p className="mt-1.5 line-clamp-2 text-sm text-neutral-400">
                        {e.pitch}
                      </p>
                    )}
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-300 transition group-hover:gap-2 group-hover:text-white">
                      Empezar <span aria-hidden>→</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
