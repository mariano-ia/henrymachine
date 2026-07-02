"use client";

export default function Hero({
  onStart,
  videoCount,
}: {
  onStart: () => void;
  videoCount: number;
}) {
  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* glows de fondo */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-indigo-600/25 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-rose-600/20 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-80 w-80 rounded-full bg-fuchsia-600/10 blur-[130px]" />

      <div className="relative z-10 flex max-w-lg flex-col items-center">
        <span className="mb-6 inline-block rounded-full border border-white/15 px-3 py-1 text-xs font-medium uppercase tracking-widest text-neutral-400">
          Primera prueba
        </span>

        <h1 className="font-condensed text-[3.25rem] font-bold uppercase leading-[0.92] tracking-tight text-white sm:text-7xl">
          Chatear con Henry sobre su viaje a{" "}
          <span className="text-rose-500">Japón</span>
        </h1>

        <p className="mt-7 max-w-md text-balance text-[15px] leading-relaxed text-neutral-400">
          Es una prueba simple: un chat que responde como Henry a partir de{" "}
          {videoCount} de sus videos de Tokio. Habla natural, pero solo sabe lo
          que está en esos videos — si le preguntas algo que no salió ahí, no te
          lo inventa.
        </p>

        <button
          onClick={onStart}
          className="group mt-10 flex items-center gap-2.5 rounded-full bg-white px-9 py-4 text-base font-semibold text-neutral-950 shadow-xl shadow-white/10 transition hover:scale-[1.03] active:scale-95"
        >
          Empezar a chatear
          <span className="transition group-hover:translate-x-1">→</span>
        </button>
      </div>
    </main>
  );
}
