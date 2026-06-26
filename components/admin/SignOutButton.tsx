"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  async function out() {
    await createClient().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }
  return (
    <button
      onClick={out}
      className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-400 transition hover:bg-white/5 hover:text-white"
    >
      Salir
    </button>
  );
}
