import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ExperienceEditor from "@/components/admin/ExperienceEditor";

export const dynamic = "force-dynamic";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = await createClient();

  const { data: exp } = await sb
    .from("experiences")
    .select("id, slug, title, pitch, city, status, price_cents")
    .eq("id", id)
    .maybeSingle();
  if (!exp) notFound();

  const { data: steps } = await sb
    .from("steps")
    .select("id, position, type, title, body, proposal, walk_to_next, place_query, address, is_paywall, paywall_message")
    .eq("experience_id", id)
    .order("position");

  return <ExperienceEditor experience={exp} steps={steps ?? []} />;
}
