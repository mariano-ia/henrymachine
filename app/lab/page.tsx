/* MOCKUP — dirección "LÍNEA H" (señalética de subte intervenida por Henry).
   Ruta apartada: NO toca el sitio real. Fuentes de mockup via <link> (en la
   implementación real irían por next/font). */

const Y = "#FCCC0A"; // amarillo Henry (N/Q/R + taxi)
const INK = "#0A0A0A";
const PAPER = "#EFEEE9";
const THEME = {
  comida: "#EE352E",
  vistas: "#0039A6",
  local: "#00933C",
  clasicos: "#FF6319",
  arte: "#B933AD",
};

const EXPS = [
  { n: 1, title: "Pizzas de Brooklyn", theme: "comida", color: THEME.comida, letter: "C", meta: "45 MIN · 2,1 KM · BROOKLYN", price: "US$6", free: false },
  { n: 2, title: "Cafés del Village", theme: "comida", color: THEME.comida, letter: "C", meta: "40 MIN · 1,6 KM · VILLAGE", price: "US$5", free: false },
  { n: 3, title: "Miradores de Manhattan", theme: "vistas", color: THEME.vistas, letter: "V", meta: "1 H · 3,2 KM · MANHATTAN", price: "US$7", free: false },
  { n: 4, title: "Domingo en Williamsburg", theme: "local", color: THEME.local, letter: "L", meta: "50 MIN · 2,4 KM · WILLIAMSBURG", price: "GRATIS", free: true },
  { n: 5, title: "12 horas en Nueva York", theme: "clasicos", color: THEME.clasicos, letter: "K", meta: "12 H · 14 KM · TODA LA CIUDAD", price: "US$5", free: false },
];

function Bullet({ color, letter, size = 26, dark }: { color: string; letter: string; size?: number; dark?: boolean }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-black"
      style={{
        background: color,
        color: dark ? INK : "#fff",
        width: size,
        height: size,
        fontSize: size * 0.55,
        fontFamily: "var(--lab-display)",
      }}
    >
      {letter}
    </span>
  );
}

function BalaH({ size = 30 }: { size?: number }) {
  return <Bullet color={Y} letter="H" size={size} dark />;
}

/* chip de tarifa estilo MetroCard: esquina cortada en diagonal */
function Fare({ children, free }: { children: string; free?: boolean }) {
  return (
    <span
      className="inline-block px-2.5 py-1 text-[13px] font-bold tracking-wide"
      style={{
        background: free ? "#fff" : Y,
        color: free ? "#00933C" : INK,
        clipPath: "polygon(0 0, calc(100% - 11px) 0, 100% 11px, 100% 100%, 0 100%)",
        border: free ? `1.5px solid #00933C` : "none",
        fontFamily: "var(--lab-display)",
      }}
    >
      {children}
    </span>
  );
}

export default function LabPage() {
  return (
    <main className="min-h-screen antialiased" style={{ background: PAPER, color: INK }}>
      {/* fuentes solo para el mockup */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;900&family=Doto:wght@800&display=swap"
        rel="stylesheet"
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .lab { --lab-display: 'Archivo', system-ui, sans-serif; font-family: 'Archivo', system-ui, sans-serif; }
        .lab-doto { font-family: 'Doto', monospace; }
        @keyframes lab-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .lab-marquee { animation: lab-marquee 55s linear infinite; }
        .lab-marquee:hover { animation-play-state: paused; }
        @keyframes lab-swipe { 0%, 18% { transform: translateX(0); } 50%, 68% { transform: translateX(calc(100% + 130px)); opacity: 1; } 69% { opacity: 0; } 70% { transform: translateX(0); opacity: 0; } 78%, 100% { transform: translateX(0); opacity: 1; } }
        .lab-card-anim { animation: lab-swipe 4.5s ease-in-out infinite; }
        .lab-tiles { background-image:
          linear-gradient(rgba(10,10,10,0.07) 1px, transparent 1px),
          linear-gradient(90deg, rgba(10,10,10,0.07) 1px, transparent 1px);
          background-size: 34px 17px; background-color: #F7F6F2; }
        .lab-grain::after { content:""; position:absolute; inset:0; pointer-events:none; opacity:.5;
          background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E"); }
      ` }}
      />

      <div className="lab">
        {/* ========== TICKER LED ========== */}
        <div className="overflow-hidden whitespace-nowrap py-1.5" style={{ background: INK }}>
          <div className="lab-marquee inline-block">
            {[0, 1].map((i) => (
              <span key={i} className="lab-doto text-[13px] font-extrabold tracking-[0.2em]" style={{ color: "#FFB000" }}>
                {" ★ HOLA QUERUBINES ★ BUEN SERVICIO EN LA LÍNEA H ★ GOLAZO: NUEVO RECORRIDO EN WILLIAMSBURG ★ NUEVA YORK A PIE, POR CHAT ★ ABIERTO 24/7 ★ QUÉ LOCO ★"}
              </span>
            ))}
          </div>
        </div>

        {/* ========== NAV ========== */}
        <header className="flex items-center justify-between px-5 py-4 sm:px-10">
          <div className="flex items-center gap-2.5">
            <BalaH size={34} />
            <span className="text-[20px] font-black tracking-tight">HENRY</span>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-60">
            Recorridos · Nueva York
          </span>
        </header>

        {/* ========== HERO: cartel de estación ========== */}
        <section className="lab-grain relative mx-4 overflow-hidden rounded-sm sm:mx-8" style={{ background: INK }}>
          {/* filete blanco MTA */}
          <div className="absolute left-0 right-0 top-[10px] h-[2px] bg-white" />
          <div className="grid gap-10 px-6 pb-10 pt-12 text-white sm:px-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pb-16 lg:pt-16">
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">
                Estación de partida · elegí tu recorrido
              </p>
              <h1 className="text-[clamp(2.4rem,7vw,5rem)] font-black uppercase leading-[0.95] tracking-[-0.01em]">
                Caminá
                <br />
                Nueva York{" "}
                <span className="inline-flex translate-y-[-0.12em] gap-1.5 align-middle">
                  <Bullet color={THEME.comida} letter="C" size={34} />
                  <Bullet color={THEME.vistas} letter="V" size={34} />
                  <Bullet color={THEME.local} letter="L" size={34} />
                </span>
                <br />
                con un local
              </h1>
              {/* intervención en fibrón */}
              <p className="mt-4 rotate-[-2deg] font-hand text-[clamp(1.8rem,4.5vw,2.6rem)] leading-none" style={{ color: Y }}>
                ese local soy yo, choche →
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  className="px-6 py-3.5 text-[15px] font-black uppercase tracking-wide"
                  style={{ background: Y, color: INK }}
                >
                  Ver recorridos
                </button>
                <span className="text-[13px] text-white/55">desde GRATIS hasta US$7 · pago único</span>
              </div>
            </div>

            {/* ventanita de chat (estática en el mockup) */}
            <div className="mx-auto w-full max-w-[340px]">
              <div className="overflow-hidden rounded-lg bg-[#F4F2EC] text-[15px] leading-snug" style={{ color: INK }}>
                <div className="flex items-center gap-2.5 px-3.5 py-2.5" style={{ background: "#161616" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/henry.jpg" alt="Henry" className="h-9 w-9 rounded-full object-cover" style={{ boxShadow: `0 0 0 2.5px ${Y}` }} />
                  <div className="leading-tight">
                    <div className="text-[14px] font-bold text-white">Henry</div>
                    <div className="text-[11px] text-white/55">en línea · Línea H</div>
                  </div>
                  <BalaH size={22} />
                </div>
                <div className="space-y-2 px-3 py-3.5">
                  <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
                    listo, ¿ya estás en la esquina de Bedford y N 7th?
                  </div>
                  <div className="ml-auto max-w-[85%] rounded-xl rounded-br-sm px-3 py-2 font-medium" style={{ background: Y }}>
                    sí!! recién bajo del subte
                  </div>
                  <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
                    golazo. mirá la vitrina del cartel rojo: pedite una porción de pepperoni y decime qué ves arriba del horno 👀
                  </div>
                  <div className="ml-auto max-w-[85%] rounded-xl rounded-br-sm px-3 py-2 font-medium" style={{ background: Y }}>
                    jajaja ¿una foto tuya?
                  </div>
                  <div className="flex items-center gap-1.5 pl-1 pt-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black/40" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black/40 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black/40 [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== MOSAICO divisor ========== */}
        <div className="mx-4 mt-10 flex h-[12px] overflow-hidden sm:mx-8">
          {Object.values(THEME).map((c) => (
            <div key={c} className="flex-1" style={{ background: c }} />
          ))}
        </div>

        {/* ========== CATÁLOGO: la Línea H ========== */}
        <section className="px-4 py-10 sm:px-8">
          {/* cartel de sección */}
          <div className="relative mb-10 flex items-center justify-between px-5 py-3.5 text-white" style={{ background: INK }}>
            <div className="absolute left-0 right-0 top-[6px] h-[1.5px] bg-white" />
            <span className="text-[15px] font-bold uppercase tracking-[0.12em]">Recorridos</span>
            <div className="flex items-center gap-1.5">
              <Bullet color={THEME.comida} letter="C" size={22} />
              <Bullet color={THEME.vistas} letter="V" size={22} />
              <Bullet color={THEME.local} letter="L" size={22} />
              <Bullet color={THEME.clasicos} letter="K" size={22} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/henry.jpg" alt="" className="h-[22px] w-[22px] rounded-full object-cover" style={{ boxShadow: `0 0 0 2px ${Y}` }} />
            </div>
          </div>

          {/* strip map horizontal: nombres a 45° POR ENCIMA de la línea, como en el vagón */}
          <div className="relative mb-14 overflow-x-auto pb-2">
            <div className="min-w-[860px] px-8">
              <div className="flex">
                {/* la bala H abre la línea */}
                <div className="w-[110px] shrink-0">
                  <div className="relative h-[150px]">
                    <span className="absolute bottom-1 left-0 whitespace-nowrap font-hand text-[18px] opacity-70">
                      arrancamos acá ↓
                    </span>
                  </div>
                  <div className="relative flex h-8 items-center">
                    <div className="absolute left-0 right-0 top-1/2 h-[6px] -translate-y-1/2" style={{ background: Y }} />
                    <BalaH size={32} />
                  </div>
                  <div className="h-8" />
                </div>
                {EXPS.map((e, i) => (
                  <div key={e.n} className={"shrink-0 " + (i === EXPS.length - 1 ? "w-[150px]" : "w-[150px]")}>
                    {/* nombre subiendo a 45° */}
                    <div className="relative h-[150px]">
                      <span className="absolute bottom-0 left-[10px] origin-bottom-left -rotate-45 whitespace-nowrap text-[13.5px] font-bold uppercase tracking-wide">
                        {e.title}
                      </span>
                    </div>
                    {/* estación sobre la línea */}
                    <div className="relative flex h-8 items-center">
                      <div className="absolute left-0 right-0 top-1/2 h-[6px] -translate-y-1/2" style={{ background: Y }} />
                      <span className="relative z-10 h-8 w-8 rounded-full bg-white" style={{ border: `4px solid ${INK}` }} />
                    </div>
                    {/* bala de tema + tarifa debajo */}
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <Bullet color={e.color} letter={e.letter} size={17} />
                      <span className="text-[11px] font-bold tracking-wide opacity-60">{e.price}</span>
                    </div>
                  </div>
                ))}
                {/* cierre de línea */}
                <div className="shrink-0">
                  <div className="h-[150px]" />
                  <div className="relative flex h-8 w-[60px] items-center">
                    <div className="absolute left-0 right-1/2 top-1/2 h-[6px] -translate-y-1/2" style={{ background: Y }} />
                    <span className="relative z-10 ml-2 h-4 w-4 rounded-full" style={{ background: Y }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* cards = carteles de estación (muestro 3) */}
          <div className="grid gap-5 md:grid-cols-3">
            {EXPS.slice(0, 3).map((e) => (
              <article key={e.n} className="group cursor-pointer border bg-white" style={{ borderColor: "rgba(10,10,10,0.18)" }}>
                <div className="relative flex items-center justify-between gap-2 px-4 py-3 text-white" style={{ background: INK }}>
                  <div className="absolute left-0 right-0 top-[5px] h-[1.5px] bg-white" />
                  <h3 className="text-[15px] font-bold uppercase leading-tight tracking-wide">{e.title}</h3>
                  <Bullet color={e.color} letter={e.letter} size={24} />
                </div>
                {/* cover mock: pared de azulejos + banda mosaico del tema */}
                <div className="lab-tiles relative h-[120px]">
                  <div className="absolute left-0 right-0 top-0 h-[10px]" style={{ background: e.color }} />
                  <span className="absolute bottom-2.5 left-3.5 font-hand text-[19px] opacity-75">
                    {e.n === 1 ? "la mejor porción de tu vida" : e.n === 2 ? "café como en Lima, te juro" : "la foto que rompe tu feed"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[11px] font-semibold tracking-[0.14em] opacity-60">{e.meta}</span>
                  <Fare free={e.free}>{e.price}</Fare>
                </div>
                {/* tren llegando */}
                <div className="h-[3px] w-0 transition-all duration-300 group-hover:w-full" style={{ background: Y }} />
              </article>
            ))}
          </div>
        </section>

        {/* ========== PREVIEW DETALLE ========== */}
        <section className="mx-4 mb-14 border-t-2 border-dashed pt-10 sm:mx-8" style={{ borderColor: "rgba(10,10,10,0.25)" }}>
          <p className="mb-6 text-center text-[11px] font-bold uppercase tracking-[0.3em] opacity-40">
            — así se vería el detalle / compra —
          </p>

          <div className="mx-auto max-w-3xl">
            {/* boca de estación */}
            <div className="relative px-6 py-6 text-white" style={{ background: INK }}>
              <div className="absolute left-0 right-0 top-[8px] h-[2px] bg-white" />
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">← Salida · todos los recorridos</p>
              <div className="flex items-center gap-3">
                <Bullet color={THEME.comida} letter="C" size={34} />
                <h2 className="text-[clamp(1.7rem,4.5vw,2.6rem)] font-black uppercase leading-none">Pizzas de Brooklyn</h2>
              </div>
              <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-white/60">
                Williamsburg → Dumbo · 45 min → 2,1 km → 5 paradas
              </p>
            </div>

            {/* tip de Henry */}
            <div className="flex items-start gap-4 px-2 py-7">
              <div className="relative shrink-0 rotate-[-3deg]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/henry.jpg" alt="Henry" className="h-16 w-16 border-2 border-white object-cover shadow-md" />
                <span className="absolute -top-2 left-1/2 h-4 w-10 -translate-x-1/2 rotate-3 bg-white/60 shadow-sm" />
              </div>
              <p className="rotate-[-1deg] font-hand text-[26px] leading-tight">
                “vení con hambre, choche — acá se almuerza caminando”
                <span className="mt-1 block text-[18px] opacity-60">— Henry <BalaH size={16} /></span>
              </p>
            </div>

            {/* strip map vertical con paywall */}
            <div className="px-2">
              {[
                { t: "El horno original", open: true },
                { t: "La porción del cartel rojo", open: true },
                { t: "Parada exclusiva", open: false },
                { t: "Parada exclusiva", open: false },
              ].map((s, i) => (
                <div key={i} className="relative flex items-center gap-4 pb-7">
                  {i < 3 && (
                    <span className="absolute left-[13px] top-7 h-full w-[5px]" style={{ background: s.open ? Y : "rgba(10,10,10,0.12)" }} />
                  )}
                  <span
                    className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-black"
                    style={s.open ? { background: "#fff", border: `4px solid ${INK}` } : { background: "rgba(10,10,10,0.08)", border: "2px dashed rgba(10,10,10,0.3)", color: "rgba(10,10,10,0.4)" }}
                  >
                    {s.open ? i + 1 : "🔒"}
                  </span>
                  <span className={"text-[15px] font-bold uppercase tracking-wide " + (s.open ? "" : "opacity-40")}>
                    {s.t}
                  </span>
                  {!s.open && <span className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-40">con tu pase</span>}
                </div>
              ))}
            </div>

            {/* molinete: swipe para comprar */}
            <div className="relative mt-4 overflow-hidden px-6 py-7" style={{ background: INK }}>
              <div className="absolute left-0 right-0 top-[6px] h-[1.5px] bg-white" />
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Tu pase · pago único</p>
                  <p className="text-[30px] font-black leading-none" style={{ color: Y }}>US$6</p>
                </div>
                {/* ranura del molinete */}
                <div className="relative h-[52px] w-[260px] overflow-hidden rounded-sm border border-white/25 bg-white/5">
                  <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-white/15" />
                  <div
                    className="lab-card-anim absolute left-2 top-1/2 flex h-[34px] w-[110px] -translate-y-1/2 items-center px-2 text-[9px] font-black uppercase leading-[1.1]"
                    style={{ background: Y, color: INK, clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)" }}
                  >
                    Línea H<br />un viaje
                  </div>
                  <span className="absolute bottom-1 right-2 text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
                    deslizá tu pase →
                  </span>
                </div>
              </div>
              <p className="mt-3 font-hand text-[19px]" style={{ color: Y }}>
                las 2 primeras paradas van por mi cuenta, querubín
              </p>
            </div>
          </div>
        </section>

        {/* ========== FOOTER ========== */}
        <footer className="relative px-6 py-8 text-white" style={{ background: INK }}>
          <div className="absolute left-0 right-0 top-[8px] h-[2px] bg-white" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BalaH size={26} />
              <span className="text-[14px] font-black uppercase tracking-wide">Henry · Línea H</span>
            </div>
            <span className="rotate-[-1.5deg] font-hand text-[20px]" style={{ color: Y }}>
              nos vemos en el andén
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}
