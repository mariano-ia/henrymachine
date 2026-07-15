import { NextRequest, NextResponse } from "next/server";
import { isAuthedAuthor } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { deletePersonalitySource, getDoneNotes, saveGlobalDossier } from "@/lib/db/persona";
import { synthesizePersonaDossier } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (!(await isAuthedAuthor())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const storagePath = await deletePersonalitySource(id);
  if (storagePath) {
    try {
      await createAdminClient().storage.from("personality-sources").remove([storagePath]);
    } catch {
      /* el archivo puede no existir: no rompe el borrado de la fila */
    }
  }

  // el dossier deja de incluir esa fuente → re-sintetizar con lo que queda
  try {
    const allNotes = await getDoneNotes();
    const dossier = await synthesizePersonaDossier(allNotes);
    await saveGlobalDossier(dossier);
  } catch {
    /* se puede regenerar a mano */
  }

  return NextResponse.json({ ok: true });
}
