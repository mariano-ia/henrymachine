import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://caminaconhenry.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/cuenta", "/mis-recorridos"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
