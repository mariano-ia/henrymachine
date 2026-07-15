import { NextRequest, NextResponse } from "next/server";
import { isAuthedAuthor } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPersonalitySource,
  updatePersonalitySource,
  getDoneNotes,
  saveGlobalDossier,
} from "@/lib/db/persona";
import { extractPersonaNotes, synthesizePersonaDossier, type PersonaSourceInput } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 300; // video/audio pueden tardar (File API de Gemini)

/** Procesa UNA fuente: extrae notas con Gemini y re-sintetiza el dossier global. */
export async function POST(req: NextRequest) {
  if (!(await isAuthedAuthor())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const src = await getPersonalitySource(id);
  if (!src) return NextResponse.json({ error: "Fuente no encontrada." }, { status: 404 });

  await updatePersonalitySource(id, { status: "processing", error: null });

  try {
    let input: PersonaSourceInput;
    if (src.kind === "youtube") {
      input = { kind: "youtube", url: src.external_url ?? "" };
    } else if (src.kind === "text") {
      input = { kind: "text", text: src.raw_text ?? "" };
    } else {
      // descargar el archivo del bucket privado → Blob para el File API de Gemini
      if (!src.storage_path) throw new Error("La fuente no tiene archivo.");
      const { data: blob, error } = await createAdminClient()
        .storage.from("personality-sources")
        .download(src.storage_path);
      if (error || !blob) throw new Error("No pude leer el archivo del storage.");
      input = {
        kind: "file",
        bytes: blob,
        mimeType: src.mime_type || blob.type || "application/octet-stream",
        displayName: src.title ?? undefined,
      };
    }

    const notes = await extractPersonaNotes(input);
    if (!notes) throw new Error("Gemini no devolvió notas de esta fuente.");
    await updatePersonalitySource(id, { status: "done", notes, error: null });

    // re-síntesis automática del dossier con TODAS las fuentes procesadas
    let dossierOk = false;
    try {
      const allNotes = await getDoneNotes();
      const dossier = await synthesizePersonaDossier(allNotes);
      if (dossier.bio || dossier.voice) {
        await saveGlobalDossier(dossier);
        dossierOk = true;
      }
    } catch {
      /* si falla la síntesis, la nota igual quedó guardada; se puede regenerar a mano */
    }

    return NextResponse.json({ ok: true, status: "done", notes, dossierUpdated: dossierOk });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).slice(0, 300);
    await updatePersonalitySource(id, { status: "error", error: msg });
    return NextResponse.json({ ok: false, status: "error", error: msg }, { status: 200 });
  }
}
