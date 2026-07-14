/* MOCKUP — dirección «HENRY TE ESTÁ ESCRIBIENDO»: el sitio entero ES el chat.
   Ruta apartada, estático (la coreografía de mensajes apareciendo es de la
   versión real). Voz de Henry en peruano (tú/tienes), muletillas reales. */

const Y = "#FCCC0A";
const INK = "#1A1A1A";
const PAPER = "#FCFBF9";
const THEME = { comida: "#EE352E", local: "#00933C", vistas: "#0039A6", clasicos: "#FF6319" };

function Time({ t, check }: { t: string; check?: boolean }) {
  return (
    <span className="ml-2 inline-flex translate-y-[2px] items-center gap-0.5 text-[10px] opacity-45">
      {t}
      {check && <span style={{ color: "#53BDEB" }}>✓✓</span>}
    </span>
  );
}

function Henry({ children, t = "10:42" }: { children: React.ReactNode; t?: string }) {
  return (
    <div
      className="max-w-[85%] rounded-2xl rounded-tl-[4px] bg-white px-3.5 py-2 text-[15px] leading-snug shadow-sm"
      style={{ borderLeft: `3px solid ${Y}`, color: INK }}
    >
      {children}
      <Time t={t} />
    </div>
  );
}

function User({ children, t = "10:43" }: { children: React.ReactNode; t?: string }) {
  return (
    <div
      className="ml-auto max-w-[85%] rounded-2xl rounded-br-[4px] px-3.5 py-2 text-[15px] leading-snug shadow-sm"
      style={{ background: INK, color: PAPER }}
    >
      {children}
      <Time t={t} check />
    </div>
  );
}

function Chips({ items }: { items: { label: string; solid?: boolean }[] }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 py-1">
      {items.map((c) => (
        <button
          key={c.label}
          className="rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold transition-transform hover:scale-[1.03]"
          style={
            c.solid
              ? { background: Y, color: INK }
              : { background: "transparent", color: INK, border: `1.5px solid ${INK}33` }
          }
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

const tiles = {
  backgroundImage:
    "linear-gradient(rgba(10,10,10,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(10,10,10,0.08) 1px, transparent 1px)",
  backgroundSize: "30px 15px",
  backgroundColor: "#F1EFE8",
};

function Attachment({
  color,
  title,
  meta,
  price,
  free,
  note,
}: {
  color: string;
  title: string;
  meta: string;
  price: string;
  free?: boolean;
  note: string;
}) {
  return (
    <div className="max-w-[88%] rounded-2xl rounded-tl-[4px] bg-white p-1.5 shadow-sm">
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: "rgba(10,10,10,0.12)" }}>
        <div className="h-[4px]" style={{ background: color }} />
        <div className="relative h-[118px]" style={tiles}>
          <span className="absolute left-3 top-2.5 font-hand text-[20px] leading-tight" style={{ color: INK }}>
            {note}
          </span>
          <span
            className="absolute bottom-2 right-2 px-2 py-0.5 text-[12px] font-bold"
            style={
              free
                ? { background: "#fff", color: THEME.local, border: `1.5px solid ${THEME.local}` }
                : { background: Y, color: INK }
            }
          >
            {price}
          </span>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-[15px] font-bold leading-tight" style={{ color: INK }}>{title}</p>
          <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] opacity-55" style={{ fontFamily: "'Roboto Condensed', sans-serif", color: INK }}>
            {meta}
          </p>
          <p className="mt-1.5 text-[13px] font-semibold" style={{ color: "#B48F00" }}>
            Ver el plan →
          </p>
        </div>
      </div>
      <Time t="10:44" />
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-4 opacity-50">
      <span className="h-px flex-1 border-t border-dashed" style={{ borderColor: INK }} />
      <span className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: INK }}>{label}</span>
      <span className="h-px flex-1 border-t border-dashed" style={{ borderColor: INK }} />
    </div>
  );
}

export default function LabPage() {
  return (
    <main className="relative min-h-screen" style={{ background: "#14161B" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@700&display=swap"
        rel="stylesheet"
      />
      {/* grano de ciudad sobre el fondo oscuro */}
      <div
        className="pointer-events-none fixed inset-0 opacity-60"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* garabatos de margen — solo desktop */}
      <div className="pointer-events-none fixed inset-0 hidden lg:block">
        <p className="absolute left-[8%] top-[18%] rotate-[-6deg] font-hand text-[26px]" style={{ color: Y }}>
          no hay menús ni grids:
          <br />
          todo pasa acá adentro →
        </p>
        <p className="absolute right-[7%] top-[38%] rotate-[3deg] font-hand text-[24px]" style={{ color: Y }}>
          ← los recorridos te los
          <br />
          manda él, como en whatsapp
        </p>
        <p className="absolute left-[9%] top-[62%] rotate-[-4deg] font-hand text-[24px]" style={{ color: Y }}>
          lo bloqueado se ve borroso…
          <br />
          igual que las ganas →
        </p>
        <p className="absolute right-[8%] top-[78%] rotate-[2deg] font-hand text-[24px]" style={{ color: Y }}>
          ← y el recibo es una nota
          <br />
          manuscrita de Henry
        </p>
      </div>

      {/* ============ EL HILO ============ */}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[440px] flex-col shadow-2xl" style={{ background: PAPER }}>
        {/* barra de contacto */}
        <header className="sticky top-0 z-20 flex items-center gap-3 px-3.5 py-2.5" style={{ background: "#161616" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/henry.jpg" alt="Henry" className="h-10 w-10 rounded-full object-cover" style={{ boxShadow: `0 0 0 2.5px ${Y}` }} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[15px] font-bold text-white">Henry</p>
            <p className="flex items-center gap-1.5 text-[11.5px] text-white/55">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#2BD94F" }} />
              en línea · Nueva York
            </p>
          </div>
          <button className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white/80">
            ☰ Lista
          </button>
        </header>

        {/* mensajes */}
        <div className="flex-1 space-y-2 px-3 py-4">
          <div className="flex justify-center pb-2">
            <span className="rounded-full bg-black/5 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-wider opacity-60" style={{ color: INK }}>
              Hoy
            </span>
          </div>

          <Henry t="10:41">¡Querubines! Llegaste. 👋</Henry>
          <Henry t="10:41">
            Soy Henry. Vivo acá y te muestro Nueva York por chat, cuadra por cuadra, caminando conmigo.
          </Henry>
          <Chips items={[{ label: "¿Cómo funciona?" }, { label: "Muéstrame los recorridos", solid: true }, { label: "¿Quién eres?" }]} />
          <User t="10:42">muéstrame los recorridos 👀</User>
          <Henry t="10:42">Buenísimo. ¿Con hambre o con ganas de caminar?</Henry>
          <Chips items={[{ label: "🍕 Con hambre" }, { label: "👟 A caminar" }, { label: "Todo, dale" }]} />
          <User t="10:43">con hambre jaja</User>
          <Henry t="10:43">Golazo. Mira, este lo armé el año que llegué, choche:</Henry>

          <Attachment
            color={THEME.comida}
            title="Pizzas de Brooklyn"
            meta="45 min · 2,1 km · Williamsburg"
            price="US$6"
            note="la mejor porción de tu vida →"
          />

          <Henry t="10:44">y si quieres algo tranquilo, un domingo perfecto:</Henry>

          <Attachment
            color={THEME.local}
            title="Domingo en Williamsburg"
            meta="50 min · 2,4 km · Williamsburg"
            price="GRATIS"
            free
            note="mercadito, vinilos y río"
          />

          <User t="10:45">¿y cómo es? ¿me guías tú?</User>
          <Henry t="10:45">
            Te escribo yo, como ahora, pero caminando de verdad. Qué loco, ¿no? Mira cómo se ve adentro:
          </Henry>

          {/* mensaje de media con fibrón */}
          <div className="max-w-[80%] rounded-2xl rounded-tl-[4px] bg-white p-1.5 shadow-sm">
            <div className="relative h-[150px] overflow-hidden rounded-xl" style={tiles}>
              <div className="absolute left-0 top-0 h-[4px] w-full" style={{ background: THEME.comida }} />
              <span className="absolute left-3 top-6 rotate-[-2deg] font-hand text-[22px]" style={{ color: INK }}>
                pide la de pepperoni
                <br />y mira arriba del horno →
              </span>
              <span className="absolute bottom-2 right-2.5 text-[10px] font-bold uppercase tracking-[0.16em] opacity-40" style={{ color: INK }}>
                foto que te manda Henry
              </span>
            </div>
            <Time t="10:46" />
          </div>

          {/* paywall: borroso adentro de la ficción */}
          <div className="max-w-[85%] select-none rounded-2xl rounded-tl-[4px] bg-white px-3.5 py-2 text-[15px] shadow-sm blur-[5px]" style={{ borderLeft: `3px solid ${Y}`, color: INK }}>
            La tercera parada es un sótano donde hacen la mejor
          </div>
          <div className="max-w-[70%] select-none rounded-2xl rounded-tl-[4px] bg-white px-3.5 py-2 text-[15px] shadow-sm blur-[5px]" style={{ borderLeft: `3px solid ${Y}`, color: INK }}>
            y ahí le dices al de la puerta que
          </div>
          <p className="flex items-center gap-2 pl-1 font-hand text-[19px] opacity-70" style={{ color: INK }}>
            🔒 esto te lo cuento allá, querubín
          </p>

          <Henry t="10:47">
            Las primeras paradas van por mi cuenta. Si te gusta, desbloqueas el resto por lo que sale una porción. 🍕
          </Henry>
          <Chips items={[{ label: "Empezar gratis", solid: true }, { label: "Dale, lo quiero · US$6" }, { label: "☰ Ver la lista" }]} />

          <Divider label="y cuando compras, te llega esto" />

          {/* LA NOTA AMARILLA — el recibo manuscrito */}
          <div className="mx-auto w-[86%] rotate-[-1.5deg] p-4 shadow-lg" style={{ background: Y }}>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.22em] opacity-60" style={{ color: INK }}>
              Nota de Henry · tu entrada
            </p>
            <p className="mt-2 font-hand text-[24px] leading-[1.15]" style={{ color: INK }}>
              Pizzas de Brooklyn — pagado ✓
              <br />
              Nos vemos en Bedford y N 7th.
              <br />
              Trae hambre. — H.
            </p>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] opacity-50" style={{ color: INK }}>
              ↓ guardar · compartir
            </p>
          </div>
          <Henry t="10:48">¡Golazo! Ya es tuyo. ¿Arrancamos ahora o te lo guardo?</Henry>
          <Chips items={[{ label: "Arrancar ahora", solid: true }, { label: "Guárdamelo" }]} />

          <Divider label="la válvula de escape: la lista (botón ☰ arriba)" />

          {/* bottom sheet de la lista completa */}
          <div className="overflow-hidden rounded-t-2xl border bg-white shadow-lg" style={{ borderColor: "rgba(10,10,10,0.12)" }}>
            <div className="flex justify-center py-2">
              <span className="h-1 w-10 rounded-full bg-black/15" />
            </div>
            <p className="px-4 pb-2 text-[13px] font-bold" style={{ color: INK }}>
              Todos los recorridos <span className="font-normal opacity-50">· 5</span>
            </p>
            {[
              { c: THEME.comida, t: "Pizzas de Brooklyn", m: "45 min · Williamsburg", p: "US$6" },
              { c: THEME.comida, t: "Cafés del Village", m: "40 min · Village", p: "US$5" },
              { c: THEME.vistas, t: "Miradores de Manhattan", m: "1 h · Manhattan", p: "US$7" },
              { c: THEME.local, t: "Domingo en Williamsburg", m: "50 min · Williamsburg", p: "GRATIS" },
              { c: THEME.clasicos, t: "12 horas en Nueva York", m: "12 h · toda la ciudad", p: "US$5" },
            ].map((r) => (
              <div key={r.t} className="flex items-center gap-3 border-t px-4 py-3" style={{ borderColor: "rgba(10,10,10,0.08)" }}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.c }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold" style={{ color: INK }}>{r.t}</p>
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] opacity-50" style={{ fontFamily: "'Roboto Condensed', sans-serif", color: INK }}>{r.m}</p>
                </div>
                <span className="text-[13px] font-bold" style={{ color: r.p === "GRATIS" ? THEME.local : INK }}>{r.p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* barra de chips fija (el "input" del storefront) */}
        <footer className="sticky bottom-0 z-20 border-t px-3 py-2.5" style={{ background: PAPER, borderColor: "rgba(10,10,10,0.1)" }}>
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
            <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-bold" style={{ background: Y, color: INK }}>
              Muéstrame los recorridos
            </span>
            {["¿Cómo funciona?", "¿Quién eres?", "☰ Lista"].map((c) => (
              <span key={c} className="whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold" style={{ border: `1.5px solid ${INK}30`, color: INK }}>
                {c}
              </span>
            ))}
          </div>
        </footer>
      </div>
    </main>
  );
}
