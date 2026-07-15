import { NextResponse } from "next/server";

// Prototipo /demo retirado. Se des-rutea: era un endpoint de LLM público sin rate
// limit y con las transcripciones completas en el prompt (el más caro por token).
export const runtime = "nodejs";

const gone = () =>
  NextResponse.json({ error: "Esta demo ya no está disponible." }, { status: 410 });

export const GET = gone;
export const POST = gone;
