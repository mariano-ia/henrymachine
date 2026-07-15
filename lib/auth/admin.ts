import { createClient } from "@/lib/supabase/server";

/**
 * true si el usuario logueado es admin (authors.is_admin). El flag solo lo
 * escribe el service_role (RLS 0001), así que un comprador que se loguea por OTP
 * NO puede auto-asignárselo. Producto single-tenant: solo Henry/Mariano publican.
 */
export async function isAdmin(): Promise<boolean> {
  const sb = await createClient();
  const { data } = await sb.rpc("is_admin");
  return data === true;
}
