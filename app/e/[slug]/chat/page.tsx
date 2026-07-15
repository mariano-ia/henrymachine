import PlayerLoader from "@/components/PlayerLoader";

export const dynamic = "force-dynamic";
// pantalla privada de juego: que Google no indexe el "Cargando…".
export const metadata = { robots: { index: false } };

export default async function PlayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PlayerLoader slug={slug} />;
}
