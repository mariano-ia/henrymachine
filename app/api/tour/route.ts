import { NextResponse } from "next/server";

// Prototipo retirado (/nyc12horas). Se des-rutea para no dejar un endpoint de LLM
// público sin rate limit. Los archivos del stack legacy (TourChat, tour-prompt,
// lib/tours) quedan en el repo hasta borrarlos del todo.
export const runtime = "nodejs";

const gone = () =>
  NextResponse.json({ error: "Este recorrido de prueba ya no está disponible." }, { status: 410 });

export const GET = gone;
export const POST = gone;
