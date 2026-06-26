import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-amber-400/10 text-amber-300",
  published: "bg-emerald-400/10 text-emerald-300",
  archived: "bg-neutral-500/10 text-neutral-400",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  published: "Publicada",
  archived: "Archivada",
};

export default async function AdminDashboard() {
  const sb = await createClient();
  const { data: experiences } = await sb
    .from("experiences")
    .select("id, slug, title, status, price_cents, updated_at")
    .order("updated_at", { ascending: false });

  const list = experiences ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Tus experiencias</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {list.length} {list.length === 1 ? "experiencia" : "experiencias"}
          </p>
        </div>
        <Link
          href="/admin/nuevo"
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200 active:scale-[0.99]"
        >
          Nueva experiencia
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
          <p className="text-neutral-300">Todavía no creaste ninguna experiencia.</p>
          <p className="mt-1 text-sm text-neutral-500">
            Escribí un relato en lenguaje natural y dejá que Henry arme el recorrido.
          </p>
          <Link
            href="/admin/nuevo"
            className="mt-6 inline-block rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950"
          >
            Crear la primera
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10">
          {list.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-4 bg-neutral-900/40 px-5 py-4 transition hover:bg-neutral-900"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="truncate font-medium text-white">{e.title}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      STATUS_STYLE[e.status] ?? ""
                    }`}
                  >
                    {STATUS_LABEL[e.status] ?? e.status}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-neutral-500">
                  /{e.slug} · {e.price_cents === 0 ? "Gratis" : `$${(e.price_cents / 100).toFixed(2)}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {e.status === "published" && (
                  <Link
                    href={`/e/${e.slug}`}
                    target="_blank"
                    className="rounded-lg px-3 py-1.5 text-sm text-neutral-400 transition hover:bg-white/5 hover:text-white"
                  >
                    Jugar
                  </Link>
                )}
                <Link
                  href={`/admin/e/${e.id}`}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-200 transition hover:bg-white/5"
                >
                  Editar
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
