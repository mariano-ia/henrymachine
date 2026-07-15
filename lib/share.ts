"use client";

/** Comparte con el share nativo del cel; en desktop cae a copiar el link. */
export async function shareOrCopy(
  text: string,
  url: string
): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ text, url });
      return "shared";
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "copied";
  } catch {
    return "failed";
  }
}
