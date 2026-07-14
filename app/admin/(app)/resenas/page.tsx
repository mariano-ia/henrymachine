import { createClient } from "@/lib/supabase/server";
import ReviewsEditor, { type ReviewRow } from "@/components/admin/ReviewsEditor";

export const dynamic = "force-dynamic";

export default async function ResenasPage() {
  const sb = await createClient();
  const { data, error } = await sb
    .from("reviews")
    .select("id, experience_id, rating, body, author_name, country, verified_purchase, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold text-white">Reseñas</h1>
        <p className="mt-4 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Falta aplicar la migración <code>0012_reviews.sql</code>. Después recargá.
        </p>
      </div>
    );
  }

  // títulos de experiencias para mostrar
  const ids = [...new Set((data ?? []).map((r) => r.experience_id))];
  const { data: exps } = ids.length
    ? await sb.from("experiences").select("id, title").in("id", ids)
    : { data: [] as { id: string; title: string }[] };
  const titleOf = new Map((exps ?? []).map((e) => [e.id, e.title]));

  const rows: ReviewRow[] = (data ?? []).map((r) => ({
    ...r,
    experienceTitle: titleOf.get(r.experience_id) ?? "—",
  }));

  return <ReviewsEditor rows={rows} />;
}
