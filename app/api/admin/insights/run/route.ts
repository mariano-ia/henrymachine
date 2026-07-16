import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { runInsights } from "@/lib/insights";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Botón "Analizar ahora" del admin. Solo admin. */
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  try {
    const id = await runInsights("manual");
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[insights] falló el análisis manual", e);
    return NextResponse.json({ error: "No se pudo generar el análisis." }, { status: 500 });
  }
}
