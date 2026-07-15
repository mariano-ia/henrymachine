import { listPersonalitySources, getGlobalPersona } from "@/lib/db/persona";
import PersonalityManager from "@/components/admin/PersonalityManager";

export const dynamic = "force-dynamic";

export default async function PersonalidadPage() {
  const [sources, dossier] = await Promise.all([listPersonalitySources(), getGlobalPersona()]);
  return <PersonalityManager sources={sources} dossier={dossier} />;
}
