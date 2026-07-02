import PlayerLoader from "@/components/PlayerLoader";

export const dynamic = "force-dynamic";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PlayerLoader slug={slug} />;
}
