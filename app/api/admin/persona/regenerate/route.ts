import { NextResponse } from "next/server";
import { isAuthedAuthor } from "@/lib/admin-guard";
import { getDoneNotes, saveGlobalDossier } from "@/lib/db/persona";
import { synthesizePersonaDossier } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Re-sintetiza el dossier {bio, voice} juntando las notas de todas las fuentes. */
export async function POST() {
  if (!(await isAuthedAuthor())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const allNotes = await getDoneNotes();
  if (allNotes.length === 0) {
    return NextResponse.json({ error: "Todavía no hay fuentes procesadas." }, { status: 400 });
  }
  const dossier = await synthesizePersonaDossier(allNotes);
  await saveGlobalDossier(dossier);
  return NextResponse.json({ ok: true, ...dossier });
}
