import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ExperienceEditor from "@/components/admin/ExperienceEditor";
import type { MediaItem } from "@/components/admin/MediaSection";

export const dynamic = "force-dynamic";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = await createClient();

  // select * : tolera columnas nuevas aún no migradas (p. ej. henry_tip / 0007)
  const { data: exp } = await sb
    .from("experiences")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!exp) notFound();

  const { data: steps } = await sb
    .from("steps")
    .select("id, position, type, title, body, proposal, walk_to_next, place_query, address, is_paywall, paywall_message")
    .eq("experience_id", id)
    .order("position");

  // media por paso, con signed URLs (bucket privado)
  const { data: media } = await sb
    .from("step_media")
    .select("id, step_id, kind, storage_path, caption")
    .eq("experience_id", id);

  const admin = createAdminClient();
  const mediaByStep: Record<string, MediaItem[]> = {};
  for (const m of media ?? []) {
    let url: string | null = null;
    if (m.storage_path) {
      const { data: signed } = await admin.storage
        .from("experience-media")
        .createSignedUrl(m.storage_path, 3600);
      url = signed?.signedUrl ?? null;
    }
    (mediaByStep[m.step_id] ??= []).push({
      id: m.id,
      kind: m.kind,
      storagePath: m.storage_path,
      caption: m.caption,
      url,
    });
  }

  // otras experiencias (para el upsell "al terminar"): publicadas, menos esta
  const { data: others } = await sb
    .from("experiences_public")
    .select("id, title")
    .neq("id", id)
    .order("title");

  // key por lista de pasos: al agregar/borrar un paso, el editor se remonta con datos frescos
  const stepsKey = (steps ?? []).map((s) => s.id).join("|");
  return (
    <ExperienceEditor
      key={stepsKey}
      experience={exp}
      steps={steps ?? []}
      media={mediaByStep}
      otherExperiences={(others ?? []) as { id: string; title: string }[]}
    />
  );
}
