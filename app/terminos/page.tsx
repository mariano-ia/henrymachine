import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export const metadata = {
  title: "Términos, reembolsos y privacidad — La Nueva York de Henry",
  description:
    "Qué incluye tu recorrido, cómo funciona el reembolso y qué hacemos con tu correo.",
};

// Página legal breve y honesta. La garantía de reembolso que se promete en el
// paywall del chat vive acá. Contacto: se responde al correo con el que se compró
// (el email de acceso sale de EMAIL_FROM); cuando Henry tenga correo de soporte
// propio, agregarlo abajo.
export default function TerminosPage() {
  return (
    <main className="henry-home min-h-[100dvh] bg-paper text-ink antialiased">
      <SiteHeader tone="dark" className="bg-night text-white" />
      <article className="mx-auto max-w-editorial px-5 py-10 sm:px-10">
        <h1 className="text-[26px] font-bold tracking-tight">Términos, reembolsos y privacidad</h1>
        <p className="mt-2 text-[14px] text-ink/60">
          En simple, sin letra chica. Cualquier duda, respóndele al correo con el que compraste.
        </p>

        <section className="mt-8 space-y-2">
          <h2 className="text-[17px] font-semibold">Qué es esto</h2>
          <p className="text-[15px] leading-relaxed text-ink/75">
            Micro-recorridos a pie por Nueva York guiados por chat. Te acompaña “Henry
            virtual”: una IA entrenada con los videos reales de Henry (@resilentos). No es
            una persona escribiéndote en vivo; es su forma de guiarte, parada por parada.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-[17px] font-semibold">Qué incluye tu compra</h2>
          <p className="text-[15px] leading-relaxed text-ink/75">
            Al comprar un recorrido, desbloqueas todas sus paradas. <b>Una vez que lo empiezas,
            es tuyo para siempre</b>: entras cuando quieras desde{" "}
            <Link href="/cuenta" className="font-semibold text-brand underline underline-offset-2">
              tu cuenta
            </Link>
            , desde cualquier dispositivo. Si lo compras para otro día y no llegas a empezarlo,
            tienes <b>90 días</b> para hacerlo. Mientras juegas, guardamos dónde quedaste por{" "}
            <b>7 días</b> en tu teléfono (o siempre, si entras con tu correo). Los recorridos
            gratis no necesitan compra.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-[17px] font-semibold">Reembolsos</h2>
          <p className="text-[15px] leading-relaxed text-ink/75">
            Si no te gustó, te devolvemos tu dinero. Solo respóndele al correo con el que
            compraste, dentro de los 14 días, y lo resolvemos. Sin vueltas.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="text-[17px] font-semibold">Tu correo y tu privacidad</h2>
          <p className="text-[15px] leading-relaxed text-ink/75">
            Usamos tu correo para darte acceso a lo que compraste y, si aceptas, para
            contarte cuando haya recorridos nuevos. Nada de spam y nunca vendemos tus datos.
            El pago lo procesa Stripe; nosotros no guardamos los datos de tu tarjeta.
          </p>
        </section>

        <p className="mt-10 text-[13px] text-ink/50">
          <Link href="/" className="font-semibold text-brand underline underline-offset-2">
            ← Volver al inicio
          </Link>
        </p>
      </article>
    </main>
  );
}
