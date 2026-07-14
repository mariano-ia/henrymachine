"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setReviewStatus, deleteReview } from "@/app/admin/(app)/resenas/actions";
import { flagEmoji } from "@/lib/country";

export type ReviewRow = {
  id: string;
  experience_id: string;
  experienceTitle: string;
  rating: number;
  body: string | null;
  author_name: string | null;
  country: string | null;
  verified_purchase: boolean;
  status: string;
  created_at: string;
};

const STATUSES = ["pending", "approved", "featured", "rejected"] as const;
const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  featured: "Destacada",
  rejected: "Rechazada",
};

function Row({ r }: { r: ReviewRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function set(status: (typeof STATUSES)[number]) {
    start(async () => {
      await setReviewStatus(r.id, status);
      router.refresh();
    });
  }
  function remove() {
    if (!confirm("¿Borrar esta reseña?")) return;
    start(async () => {
      await deleteReview(r.id);
      router.refresh();
    });
  }

  return (
    <li className="rounded-2xl border border-white/10 bg-neutral-900/40 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-[#D89A34]">{"★".repeat(r.rating)}<span className="text-white/15">{"★".repeat(5 - r.rating)}</span></span>
        <span className="font-medium text-white">{r.author_name || "Anónimo"}</span>
        {r.country && <span>{flagEmoji(r.country)}</span>}
        {r.verified_purchase && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            compra verificada
          </span>
        )}
        <span className="text-xs text-neutral-500">· {r.experienceTitle}</span>
        <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-neutral-400">
          {STATUS_LABEL[r.status] ?? r.status}
        </span>
      </div>
      {r.body && <p className="mt-2 text-[14px] leading-snug text-neutral-300">“{r.body}”</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {STATUSES.filter((s) => s !== r.status).map((s) => (
          <button
            key={s}
            onClick={() => set(s)}
            disabled={pending}
            className="rounded-lg border border-white/10 px-3 py-1 text-xs text-neutral-200 hover:bg-white/5 disabled:opacity-50"
          >
            {s === "featured" ? "★ Destacar" : STATUS_LABEL[s]}
          </button>
        ))}
        <button
          onClick={remove}
          disabled={pending}
          className="ml-auto text-xs text-red-400/70 transition hover:text-red-400 disabled:opacity-40"
        >
          Borrar
        </button>
      </div>
    </li>
  );
}

export default function ReviewsEditor({ rows }: { rows: ReviewRow[] }) {
  const [filter, setFilter] = useState<string>("all");
  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const count = (s: string) => rows.filter((r) => r.status === s).length;

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-white">Reseñas</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Se crean “pendientes” cuando alguien termina un recorrido. Solo las
        aprobadas o destacadas se muestran en el detalle.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {["all", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={
              "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors " +
              (filter === s ? "bg-white text-neutral-950" : "text-neutral-400 hover:bg-white/5 hover:text-white")
            }
          >
            {s === "all" ? `Todas (${rows.length})` : `${STATUS_LABEL[s]} (${count(s)})`}
          </button>
        ))}
      </div>

      <ul className="mt-5 space-y-3">
        {shown.map((r) => (
          <Row key={r.id} r={r} />
        ))}
        {shown.length === 0 && <p className="text-sm text-neutral-500">No hay reseñas en este estado.</p>}
      </ul>
    </div>
  );
}
