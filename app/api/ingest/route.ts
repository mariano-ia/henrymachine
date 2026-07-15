import { NextResponse } from "next/server";

// Ingesta de YouTube del prototipo /demo: endpoint sin auth ni rate limit que
// llamaba a Gemini con corpus de ~120k chars. Des-ruteado. El dossier de Henry
// hoy se regenera por script (scripts/ingest-persona.mjs), no por esta ruta.
export const runtime = "nodejs";

const gone = () =>
  NextResponse.json({ error: "Esta ruta ya no está disponible." }, { status: 410 });

export const GET = gone;
export const POST = gone;
