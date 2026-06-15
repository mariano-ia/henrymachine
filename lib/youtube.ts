/** Extrae el videoId de una URL de YouTube (watch, youtu.be, shorts, embed) o de un id pelado. */
export function parseVideoId(input: string): string | null {
  const raw = input.trim();
  try {
    const url = new URL(raw);
    if (url.hostname === "youtu.be") return url.pathname.slice(1) || null;
    if (url.hostname.replace(/^www\./, "").endsWith("youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "v") {
        return parts[1] || null;
      }
    }
    return null;
  } catch {
    return /^[\w-]{11}$/.test(raw) ? raw : null;
  }
}

/** Título del video vía oEmbed (sin API key). */
export async function fetchTitle(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { cache: "no-store" }
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as { title?: string };
    return data.title;
  } catch {
    return undefined;
  }
}
