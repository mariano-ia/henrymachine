import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Cliente con service_role: BYPASEA RLS. Usar SOLO en server para tareas
 * privilegiadas (webhook de Stripe, generador, fulfillment). Nunca en el browser.
 * Requiere SUPABASE_SERVICE_ROLE_KEY (secreto del dashboard).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY (dashboard → Project Settings → API)."
    );
  }
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
