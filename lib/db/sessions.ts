import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Registra un turno del recorrido en play_sessions (fuente de verdad server-side
 * del progreso) + un renglón en session_messages con el costo en tokens.
 * Fire-and-forget: cualquier error se traga, NUNCA rompe el chat.
 *
 * Enums reales de la DB: session_status = EN_CURSO|TERMINADO|... ;
 * session_messages.role = user|henry|system, .text NOT NULL.
 */
export async function recordTurn(opts: {
  experienceId: string;
  anonId: string | null;
  userId?: string | null; // si el que juega está logueado: linkea la sesión (cross-device)
  stopIndex: number; // 0-based del cliente
  phase: string; // CAMINANDO | EN_PARADA | EN_PAUSA
  intent: string;
  finished: boolean;
  replyText: string;
  userMessage?: string | null; // texto del usuario (para insights); se guarda como role='user'
  country: string | null;
  promptTokens: number | null;
  outputTokens: number | null;
}): Promise<void> {
  // constraint session_anon_entropy: anon_id debe medir >= 24 chars
  if (!opts.anonId || opts.anonId.length < 24) return;
  try {
    const sb = createAdminClient();
    const position = opts.stopIndex + 1;
    // constraint session_active_has_expiry: EN_CURSO exige expires_at (ventana
    // deslizante de 7 días, igual que el resume del cliente).
    const expiresAt = new Date(Date.now() + 168 * 3600 * 1000).toISOString();

    const { data: existing } = await sb
      .from("play_sessions")
      .select("id, total_turns")
      .eq("experience_id", opts.experienceId)
      .eq("anon_id", opts.anonId)
      .eq("status", "EN_CURSO")
      .maybeSingle();

    let sessionId = existing?.id ?? null;
    if (!sessionId) {
      const { data: created } = await sb
        .from("play_sessions")
        .insert({
          experience_id: opts.experienceId,
          anon_id: opts.anonId,
          status: opts.finished ? "TERMINADO" : "EN_CURSO",
          phase: opts.phase as never,
          current_step_position: position,
          total_turns: 1,
          country: opts.country,
          user_id: opts.userId ?? null,
          started_at: new Date().toISOString(),
          expires_at: expiresAt,
        })
        .select("id")
        .single();
      sessionId = created?.id ?? null;
    } else {
      await sb
        .from("play_sessions")
        .update({
          phase: opts.phase as never,
          current_step_position: position,
          total_turns: (existing?.total_turns ?? 0) + 1,
          last_active_at: new Date().toISOString(),
          expires_at: expiresAt,
          ...(opts.finished ? { status: "TERMINADO" as never } : {}),
          // country NO se re-escribe por turno: se fija al crear la sesión, y si el
          // usuario declara su nacionalidad al terminar, no queremos pisársela.
          ...(opts.userId ? { user_id: opts.userId } : {}),
        })
        .eq("id", sessionId);
    }

    if (sessionId) {
      // mensaje del usuario (para insights): fila role='user'
      const userText = (opts.userMessage ?? "").trim();
      if (userText) {
        await sb.from("session_messages").insert({
          session_id: sessionId,
          role: "user",
          text: userText.slice(0, 4000),
          step_position: position,
          phase: opts.phase as never,
        });
      }
      await sb.from("session_messages").insert({
        session_id: sessionId,
        role: "henry",
        text: opts.replyText.slice(0, 4000), // NOT NULL
        intent: opts.intent,
        step_position: position,
        phase: opts.phase as never,
        prompt_tokens: opts.promptTokens,
        output_tokens: opts.outputTokens,
      });
    }
  } catch {
    /* telemetría nunca rompe el chat */
  }
}

/** Turnos totales de la sesión EN_CURSO (para el límite duro server-side). */
export async function sessionTotalTurns(experienceId: string, anonId: string): Promise<number> {
  try {
    const { data } = await createAdminClient()
      .from("play_sessions")
      .select("total_turns")
      .eq("experience_id", experienceId)
      .eq("anon_id", anonId)
      .eq("status", "EN_CURSO")
      .maybeSingle();
    return data?.total_turns ?? 0;
  } catch {
    return 0;
  }
}
