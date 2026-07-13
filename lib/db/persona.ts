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
