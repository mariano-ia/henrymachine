import { NextRequest, NextResponse } from "next/server";
import { runInsights, countFinishedSince, lastAnalysisTs, purgeOldUserMessages } from "@/lib/insights";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron diario (vercel.json). Dos tareas:
 *  1) Retención: borra mensajes de usuario > 90 días.
 *  2) Disparo automático: si hubo ≥100 jugadas TERMINADAS desde el último
 *     análisis, corre uno nuevo. Protegido por CRON_SECRET (Vercel lo manda como
 *     Authorization: Bearer <CRON_SECRET> cuando la env está seteada).
 */
export async function GET(req: NextRequest) {
  // fail-CLOSED: si no hay CRON_SECRET configurada, rechaza TODO (si no, un
  // "Bearer undefined" pasaría el guard y dispararía la purga/análisis).
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("no", { status: 401 });
  }
  try {
    await purgeOldUserMessages(90);
    const since = (await lastAnalysisTs()) ?? new Date(Date.now() - 30 * 86400000).toISOString();
    const finished = await countFinishedSince(since);
    if (finished < 100) {
      return NextResponse.json({ ok: true, ran: false, finishedSince: finished });
    }
    const id = await runInsights("auto");
    return NextResponse.json({ ok: true, ran: true, id, finishedSince: finished });
  } catch (e) {
    console.error("[insights] falló el cron", e);
    return NextResponse.json({ error: "cron falló" }, { status: 500 });
  }
}
