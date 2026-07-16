import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InsightItem } from "@/lib/insights";
import { computeImpact, type Impact, type Baseline } from "@/lib/insight-metrics";
import InsightsRunButton from "@/components/admin/InsightsRunButton";
import InsightApplyButton from "@/components/admin/InsightApplyButton";

export const dynamic = "force-dynamic";

type InsightRow = {
  id: string;
  created_at: string;
  kind: string;
  plays_analyzed: number;
  summary: string | null;
  items: InsightItem[];
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
}

const TIPO_COLOR: Record<string, string> = {
  guia_util: "bg-emerald-500/15 text-emerald-300",
  experiencia: "bg-indigo-500/15 text-indigo-300",
  general: "bg-white/10 text-neutral-300",
};

const pct = (x: number) => `${Math.round(x * 100)}%`;
const perWeek = (x: number) => `${x.toFixed(1)}/sem`;

function ImpactBlock({ impact }: { impact: Impact }) {
  if (impact.status === "midiendo") {
    return <p className="mt-2 text-[13px] text-amber-300/80">✓ Aplicado · midiendo impacto… (faltan jugadas)</p>;
  }
  return (
    <div className="mt-2 rounded-lg bg-emerald-500/10 p-2.5 text-[13px]">
      <p className="font-semibold text-emerald-300">Impacto ✓</p>
      {impact.structural && (
        <p className="text-neutral-300">
          {impact.structural.metric === "abandono" ? "Abandono" : "Conversión"}:{" "}
          {impact.structural.before == null ? "s/d" : pct(impact.structural.before)} → {pct(impact.structural.after)}
        </p>
      )}
      {impact.volume && (
        <p className="text-neutral-300">
          Volumen de la pregunta: {impact.volume.before == null ? "s/d" : perWeek(impact.volume.before)} →{" "}
          {perWeek(impact.volume.after)}
        </p>
      )}
    </div>
  );
}

export default async function InsightsPage() {
  const sb = createAdminClient();
  const [{ data: rows }, { data: exps }] = await Promise.all([
    sb.from("insights").select("id, created_at, kind, plays_analyzed, summary, items").order("created_at", { ascending: false }).limit(20),
    sb.from("experiences").select("id, slug"),
  ]);
  const list = (rows ?? []) as unknown as InsightRow[];
  const idBySlug = new Map((exps ?? []).map((e) => [e.slug, e.id]));
  const latest = list[0] ?? null;
  const history = list.slice(1);

  // acciones ya aplicadas del último análisis + su impacto medido
  const actions = latest
    ? (await sb.from("insight_actions").select("*").eq("insight_id", latest.id)).data ?? []
    : [];
  const impacts = await Promise.all(
    actions.map((a) =>
      computeImpact({
        created_at: a.created_at,
        metric_slug: a.metric_slug,
        metric_step: a.metric_step,
        keywords: (a.keywords as string[]) ?? [],
        baseline: a.baseline as Baseline,
      })
    )
  );
  const byItem = new Map<number, Impact>();
  actions.forEach((a, i) => byItem.set(a.item_index, impacts[i]));

  function linkFor(it: InsightItem): { href: string; label: string } | null {
    if (it.target === "guia_util") return { href: "/admin/utilidades", label: "→ Guía útil" };
    if (it.target === "experiencia" && it.slug) {
      const id = idBySlug.get(it.slug);
      if (id) return { href: `/admin/e/${id}`, label: `→ Editar ${it.slug}` };
    }
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Insights</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Lo que aprendemos de las jugadas: fricción, abandono, qué preguntan, qué convierte.
          </p>
        </div>
        <InsightsRunButton />
      </div>

      {!latest ? (
        <div className="rounded-xl border border-white/10 bg-neutral-900 p-6 text-sm text-neutral-400">
          Todavía no hay ningún análisis. Tocá <b className="text-neutral-200">Analizar ahora</b>, o esperá a que se
          junten 100 jugadas terminadas (el análisis se corre solo).
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span>Último análisis · {fmtDate(latest.created_at)}</span>
            <span>·</span>
            <span>{latest.plays_analyzed} jugadas</span>
            <span>·</span>
            <span>{latest.kind === "auto" ? "automático" : "manual"}</span>
          </div>
          {latest.summary && (
            <p className="rounded-xl border border-white/10 bg-neutral-900 p-4 text-[15px] leading-relaxed text-neutral-200">
              {latest.summary}
            </p>
          )}
          <ol className="space-y-3">
            {latest.items.map((it, i) => {
              const link = linkFor(it);
              return (
                <li key={i} className="rounded-xl border border-white/10 bg-neutral-900 p-4">
                  <div className="flex items-start gap-3">
                    <span className={"mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium " + (TIPO_COLOR[it.target] ?? TIPO_COLOR.general)}>
                      {it.tipo}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{it.hallazgo}</p>
                      {it.evidencia && <p className="mt-1 text-[13px] text-neutral-400">{it.evidencia}</p>}
                      <p className="mt-2 text-[14px] text-neutral-200">
                        <span className="text-neutral-500">Acción: </span>
                        {it.accionable}
                      </p>
                      {link && (
                        <Link href={link.href} className="mt-2 inline-block text-[13px] font-semibold text-indigo-300 hover:text-indigo-200">
                          {link.label}
                        </Link>
                      )}
                      {byItem.has(i) ? (
                        <ImpactBlock impact={byItem.get(i)!} />
                      ) : it.target === "guia_util" && it.utility ? (
                        <InsightApplyButton
                          insightId={latest.id}
                          itemIndex={i}
                          utility={it.utility}
                          metricSlug={it.slug ?? null}
                          metricStep={it.step ?? null}
                          keywords={it.keywords ?? []}
                        />
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {history.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-neutral-400">Análisis anteriores</h2>
          <ul className="space-y-1.5">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 text-[13px] text-neutral-500">
                <span>{fmtDate(h.created_at)}</span>
                <span>·</span>
                <span>{h.plays_analyzed} jugadas</span>
                <span>·</span>
                <span>{h.items.length} insights</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
