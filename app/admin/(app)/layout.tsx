import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/admin/SignOutButton";

export const dynamic = "force-dynamic";

export default async function AdminAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/admin/login");

  // Asegura la fila de author (sin pisar is_henry/is_admin si ya existe).
  await sb
    .from("authors")
    .upsert(
      { id: user.id, display_name: user.email?.split("@")[0] ?? "Autor" },
      { onConflict: "id", ignoreDuplicates: true }
    );

  return (
    <div className="min-h-[100dvh] bg-neutral-950">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-5">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-white">
                Henry Machine
              </span>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                Constructor
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-neutral-400">
              <Link href="/admin" className="transition hover:text-white">
                Experiencias
              </Link>
              <Link href="/admin/personalidad" className="transition hover:text-white">
                Personalidad
              </Link>
              <Link href="/admin/utilidades" className="transition hover:text-white">
                Guía útil
              </Link>
              <Link href="/admin/cupones" className="transition hover:text-white">
                Cupones
              </Link>
              <Link href="/admin/resenas" className="transition hover:text-white">
                Reseñas
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-neutral-500 sm:inline">
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
