import { createAdminClient } from "@/lib/supabase/admin";

export type HenryPersona = { bio: string | null; voice: string | null };

/**
 * Dossier global de Henry (voice_profiles.is_global):
 *   profile = { bio: "quién es / su historia", voice: "perfil de voz destilado" }
 * Se inyecta en el prompt del motor. Si todavía no existe, el prompt usa un
 * interino que prohíbe inventar datos personales concretos.
 */
export async function getGlobalPersona(): Promise<HenryPersona | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("voice_profiles")
    .select("profile")
    .eq("is_global", true)
    .limit(1)
    .maybeSingle();
  const p = (data?.profile ?? null) as { bio?: string; voice?: string } | null;
  if (!p) return null;
  return { bio: p.bio?.trim() || null, voice: p.voice?.trim() || null };
}

// ---------------------------------------------------------------------------
// Alimentación multimodal ACUMULATIVA de la personalidad
// ---------------------------------------------------------------------------

export type PersonalitySource = {
  id: string;
  kind: "youtube" | "video" | "audio" | "pdf" | "image" | "text";
  title: string | null;
  storage_path: string | null;
  external_url: string | null;
  raw_text: string | null;
  mime_type: string | null;
  status: "pending" | "processing" | "done" | "error";
  notes: string | null;
  error: string | null;
  created_at: string;
};

export async function listPersonalitySources(): Promise<PersonalitySource[]> {
  const { data } = await createAdminClient()
    .from("personality_sources")
    .select("id, kind, title, storage_path, external_url, raw_text, mime_type, status, notes, error, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as PersonalitySource[];
}

export async function getPersonalitySource(id: string): Promise<PersonalitySource | null> {
  const { data } = await createAdminClient()
    .from("personality_sources")
    .select("id, kind, title, storage_path, external_url, raw_text, mime_type, status, notes, error, created_at")
    .eq("id", id)
    .maybeSingle();
  return (data as PersonalitySource) ?? null;
}

export async function createPersonalitySource(input: {
  kind: PersonalitySource["kind"];
  title?: string | null;
  storagePath?: string | null;
  externalUrl?: string | null;
  rawText?: string | null;
  mimeType?: string | null;
}): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("personality_sources")
    .insert({
      kind: input.kind,
      title: input.title ?? null,
      storage_path: input.storagePath ?? null,
      external_url: input.externalUrl ?? null,
      raw_text: input.rawText ?? null,
      mime_type: input.mimeType ?? null,
      status: "pending",
    })
    .select("id")
    .single();
  return data?.id ?? null;
}

export async function updatePersonalitySource(
  id: string,
  patch: Partial<Pick<PersonalitySource, "status" | "notes" | "error" | "title">>
): Promise<void> {
  await createAdminClient()
    .from("personality_sources")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function deletePersonalitySource(id: string): Promise<string | null> {
  const sb = createAdminClient();
  const { data } = await sb.from("personality_sources").select("storage_path").eq("id", id).maybeSingle();
  await sb.from("personality_sources").delete().eq("id", id);
  return data?.storage_path ?? null;
}

/** Notas de todas las fuentes ya procesadas (para sintetizar el dossier). */
export async function getDoneNotes(): Promise<string[]> {
  const { data } = await createAdminClient()
    .from("personality_sources")
    .select("notes")
    .eq("status", "done")
    .not("notes", "is", null)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => (r.notes ?? "").trim()).filter(Boolean);
}

/** Guarda el dossier {bio, voice} en la fila global de voice_profiles. */
export async function saveGlobalDossier(dossier: { bio: string; voice: string }): Promise<void> {
  const sb = createAdminClient();
  const { data: existing } = await sb
    .from("voice_profiles")
    .select("id")
    .eq("is_global", true)
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    await sb
      .from("voice_profiles")
      .update({ profile: dossier, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await sb
      .from("voice_profiles")
      .insert({ name: "Henry (global)", is_global: true, profile: dossier });
  }
}
