import "server-only";
import { createClient } from "@/lib/supabase/server";

/** true si hay un usuario autenticado (admin/autor). Las rutas /api/admin lo exigen. */
export async function isAuthedAuthor(): Promise<boolean> {
  try {
    const { data } = await (await createClient()).auth.getUser();
    return !!data.user;
  } catch {
    return false;
  }
}
