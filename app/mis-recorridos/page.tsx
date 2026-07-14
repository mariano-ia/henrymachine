import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SiteHeader from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

export default async function MisRecorridosPage() {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) redirect("/cuenta");

  const admin = createAdminClient();
  const { data: ents } = await admin
    .from("entitlements")
    .select("experience_id, created_at")
    .eq("user_id", user.id)
    .is("revoked_at", null);
  const ids = (ents ?? []).map((e) => e.experience_id);
  const { data: exps } = ids.length
    ? await admin.from("experiences").select("id, slug, title, theme, expected_minutes, distance_m").in("id", ids)
    : { data: [] as never[] };
  const { data: sessions } = await admin
    .from("play_sessions")
    .select("experience_id, status, current_step_position")
    .eq("user_id", user.id);

  const stateOf = (id: string) => sessions?.find((s) => s.experience_id === id);
  const pasos = (m: number | null) => (m ? `~${Math.round((m * 1.3) / 100) * 100} pasos` : "");

  return (
    <main className="min-h-[100dvh] bg-paper text-ink">
      <SiteHeader tone="light" className="border-b border-ink/10" />
      <div className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="font-condensed text-[28px] font-bold uppercase tracking-[-0.015em]">Mis recorridos</h1>
        <p className="mt-1 text-sm text-ink/55">{user.email}</p>
        <ul className="mt-8 space-y-3">
          {(exps ?? []).map((e) => {
            const s = stateOf(e.id);
            const done = s?.status === "TERMINADO";
            return (
              <li key={e.id} className="flex items-center justify-between rounded-2xl border border-ink/10 bg-card p-4">
                <div>
                  <p className="text-[15px] font-semibold">{e.title}</p>
                  <p className="text-[12px] text-ink/50">
                    {done ? `Terminado · ${pasos(e.distance_m)}` : s ? `En curso · parada ${s.current_step_position}` : "Sin empezar"}
                  </p>
                </div>
                <Link href={`/e/${e.slug}/chat`} className="rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-white">
                  {done ? "Revivir" : s ? "Seguir" : "Empezar"}
                </Link>
              </li>
            );
          })}
          {(exps ?? []).length === 0 && (
            <p className="rounded-2xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
              Todavía no hay recorridos con este email. Si compraste con otro, entrá con ese.
            </p>
          )}
        </ul>
      </div>
    </main>
  );
}
