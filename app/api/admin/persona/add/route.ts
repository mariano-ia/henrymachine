import { NextRequest, NextResponse } from "next/server";
import { isAuthedAuthor } from "@/lib/admin-guard";
import { createPersonalitySource, type PersonalitySource } from "@/lib/db/persona";
import { parseVideoId } from "@/lib/youtube";

export const runtime = "nodejs";

const KINDS = ["youtube", "video", "audio", "pdf", "image", "text"] as const;

export async function POST(req: NextRequest) {
  if (!(await isAuthedAuthor())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as {
    kind?: string;
    title?: string;
    storagePath?: string;
    externalUrl?: string;
    rawText?: string;
    mimeType?: string;
  };
  const kind = KINDS.includes(b.kind as never) ? (b.kind as PersonalitySource["kind"]) : null;
  if (!kind) return NextResponse.json({ error: "Tipo de fuente inválido." }, { status: 400 });

  // validaciones por tipo
  if (kind === "youtube") {
    if (!b.externalUrl || !parseVideoId(b.externalUrl)) {
      return NextResponse.json({ error: "Link de YouTube inválido." }, { status: 400 });
    }
  } else if (kind === "text") {
    if (!b.rawText || b.rawText.trim().length < 10) {
      return NextResponse.json({ error: "Pega un texto un poco más largo." }, { status: 400 });
    }
  } else {
    if (!b.storagePath) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  }

  const id = await createPersonalitySource({
    kind,
    title: b.title?.slice(0, 200) ?? null,
    storagePath: kind === "youtube" || kind === "text" ? null : b.storagePath ?? null,
    externalUrl: kind === "youtube" ? b.externalUrl ?? null : null,
    rawText: kind === "text" ? (b.rawText ?? "").slice(0, 100000) : null,
    mimeType: b.mimeType ?? null,
  });
  if (!id) return NextResponse.json({ error: "No se pudo crear la fuente." }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}
