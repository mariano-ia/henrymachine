import type { LeaderRow } from "@/lib/db/leaderboard";
import { flagEmoji, countryName } from "@/lib/country";
import LeaderboardShare from "@/components/LeaderboardShare";

/**
 * Ranking de países (sidebar delicada, a la derecha de las experiencias).
 * Server component sin estado. `sample` marca los datos como ejemplo.
 */
export default function Leaderboard({ rows, sample = false }: { rows: LeaderRow[]; sample?: boolean }) {
  if (rows.length === 0) return null; // sin datos aún: no mostrar nada

  return (
    <div id="ranking" className="rounded-2xl border border-ink/10 bg-card p-5 shadow-card">
      <div className="flex items-center gap-2">
        <h2 className="text-[14px] font-semibold tracking-tight text-ink">Los que más caminan</h2>
        {sample && (
          <span className="rounded-full bg-ink/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-label text-ink/45">
            Ejemplo
          </span>
        )}
      </div>
      <p className="mt-1 text-[11.5px] leading-snug text-ink/50">
        {sample
          ? "Así se verá cuando arranquen los recorridos."
          : "Pasos sumados por quienes terminaron un recorrido."}
      </p>
      <ol className="mt-4 space-y-2">
        {rows.map((r, i) => (
          <li key={r.country} className="flex items-center gap-2.5">
            <span className="w-3.5 shrink-0 text-right text-[12px] font-bold text-ink/30">{i + 1}</span>
            <span className="text-[16px] leading-none">{flagEmoji(r.country)}</span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">
              {countryName(r.country)}
            </span>
            <span className="shrink-0 text-[11px] font-semibold tabular-nums text-ink/45">
              {r.steps.toLocaleString("es-AR")}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3.5 border-t border-ink/8 pt-3 text-[10px] uppercase tracking-label text-ink/30">
        pasos caminados
      </p>
      <LeaderboardShare />
    </div>
  );
}
