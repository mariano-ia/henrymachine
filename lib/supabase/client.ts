import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/** Cliente de Supabase para el browser (componentes client). RLS aplica. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
