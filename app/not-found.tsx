import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col bg-paper text-ink">
      <SiteHeader tone="light" className="border-b border-ink/10" />
      <div className="flex flex-1 items-center justify-center px-6 py-16 text-center">
        <div className="max-w-sm">
          <p className="font-hand text-[26px] leading-tight text-brand">Uy, querubín…</p>
          <h1 className="mt-2 font-condensed text-[30px] font-bold uppercase tracking-[-0.015em]">
            Esta esquina no existe
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-ink/55">
            Puede que el recorrido se haya mudado o el link esté cortado.
            Volvé al inicio y elegí por dónde caminamos.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-brand-dark"
          >
            Ver los recorridos <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
