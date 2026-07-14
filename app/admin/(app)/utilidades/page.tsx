import { createClient } from "@/lib/supabase/server";
import UtilitiesEditor, { type UtilityRow } from "@/components/admin/UtilitiesEditor";

export const dynamic = "force-dynamic";

export default async function UtilidadesPage() {
  const sb = await createClient();
  const { data, error } = await sb
    .from("utilities")
    .select("id, category, name, neighborhood, address, place_query, hours, is_free, henry_note, active, position")
    .order("category")
    .order("position");

  // tabla inexistente = migración 0008 sin aplicar
  if (error) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold text-white">Guía útil</h1>
        <p className="mt-4 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Falta aplicar la migración <code>0008_utilities_card_image.sql</code> en la base
          (SQL editor del dashboard de Supabase). Después recargá esta página.
        </p>
      </div>
    );
  }

  return <UtilitiesEditor rows={(data ?? []) as UtilityRow[]} />;
}
