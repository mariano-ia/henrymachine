import type { LeaderRow } from "@/lib/db/leaderboard";
import { flagEmoji, countryName } from "@/lib/country";

/** Top de países que más caminaron NYC con Henry. Server component (sin estado). */
export default function Leaderboard({ rows }: { rows: LeaderRow[] }) {
  if (rows.length === 0) return null; // sin datos aún: no mostrar la sección

  const max = rows[0].steps || 1;
  return (
    <section className="border-t border-ink/10 bg-paper">
      <div className="mx-auto max-w-editorial px-5 py-14 sm:px-10">
        <h2 className="text-[clamp(1.4rem,3.5vw,2rem)] font-semibold tracking-tight text-ink">
          ¿Qué país camina más Nueva York?
        </h2>
        <p className="mt-1 text-[14px] text-ink/55">
          Pasos sumados por todos los que terminaron un recorrido con Henry.
        </p>
        <ol className="mt-7 space-y-2.5">
          {rows.map((r, i) => (
            <li key={r.country} className="flex items-center gap-3">
              <span className="w-6 shrink-0 text-right text-[14px] font-bold text-ink/40">{i + 1}</span>
              <span className="text-[22px] leading-none">{flagEmoji(r.country)}</span>
              <span className="w-28 shrink-0 truncate text-[14px] font-semibold text-ink sm:w-40">
                {countryName(r.country)}
              </span>
              <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-ink/5">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-brand"
                  style={{ width: `${Math.max(4, (r.steps / max) * 100)}%` }}
                />
              </span>
              <span className="w-24 shrink-0 text-right text-[13px] font-semibold text-ink/70 sm:w-32">
                {r.steps.toLocaleString("es-AR")} pasos
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
