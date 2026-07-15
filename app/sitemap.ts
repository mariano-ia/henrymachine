import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://caminaconhenry.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data } = await createAdminClient()
    .from("experiences_public")
    .select("slug, published_at");
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...(data ?? []).map((e) => ({
      url: `${SITE_URL}/e/${e.slug}`,
      lastModified: e.published_at ?? undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
