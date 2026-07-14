import Link from "next/link";
import SocialLinks from "@/components/SocialLinks";

/**
 * Header compartido: logo (→ home), redes de Henry y acceso a "Mis recorridos".
 * `tone` adapta los colores al fondo (oscuro sobre night/hero, claro sobre paper).
 * El `<header>` no trae fondo: lo pone quien lo usa vía `className`.
 */
export default function SiteHeader({
  tone = "light",
  className = "",
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  const pill = dark
    ? "border-white/25 text-white/85 hover:bg-white/10"
    : "border-ink/15 text-ink/70 hover:bg-ink/5";
  return (
    <header className={className}>
      <div className="mx-auto flex max-w-editorial items-center justify-between gap-3 px-5 py-4 sm:px-10">
        <Link href="/" className="block shrink-0 leading-none">
          <span
            className={
              "block font-condensed text-[18px] font-bold uppercase tracking-[-0.015em] sm:text-[20px] " +
              (dark ? "text-white" : "text-ink")
            }
          >
            La Nueva York de Henry
          </span>
          <span className={"mt-0.5 block font-hand text-[15px] leading-none " + (dark ? "text-white/75" : "text-ink/55")}>
            by Resilentos
          </span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden sm:block">
            <SocialLinks tone={tone} />
          </div>
          <Link
            href="/mis-recorridos"
            className={"rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition " + pill}
          >
            Mis recorridos
          </Link>
        </div>
      </div>
    </header>
  );
}
