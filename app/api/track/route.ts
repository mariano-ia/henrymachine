import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

export const runtime = "nodejs";

const ALLOWED = new Set(["view_home", "view_detail", "open_chat", "begin_checkout", "finish_tour"]);

export async function POST(req: NextRequest) {
  try {
    const b = (await req.json()) as { name?: string; slug?: string; anonId?: string; props?: unknown };
    if (!b.name || !ALLOWED.has(b.name)) return NextResponse.json({ ok: false }, { status: 400 });
    await createAdminClient().from("events").insert({
      name: b.name,
      slug: typeof b.slug === "string" ? b.slug.slice(0, 80) : null,
      anon_id: typeof b.anonId === "string" ? b.anonId.slice(0, 80) : null,
      country: req.headers.get("x-vercel-ip-country"),
      props: (b.props && typeof b.props === "object" ? b.props : {}) as Json,
    });
  } catch {}
  return NextResponse.json({ ok: true });
}
