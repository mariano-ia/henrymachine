import "server-only";
import { isAdmin } from "@/lib/auth/admin";

/**
 * true SOLO si el usuario logueado es ADMIN. Lo usan las rutas
 * /api/admin/persona/* que mutan el dossier GLOBAL de Henry (voice_profiles.is_global,
 * inyectado en el prompt de TODAS las experiencias). Antes hacía solo `!!user`, lo
 * que dejaba a cualquier comprador (login por OTP en /cuenta) envenenar la persona
 * global y quemar tokens de Gemini. Ahora exige rol admin, como el resto del admin.
 */
export async function isAuthedAuthor(): Promise<boolean> {
  return isAdmin();
}
