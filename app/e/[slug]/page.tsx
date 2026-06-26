import { notFound } from "next/navigation";
import { getPlayableExperience } from "@/lib/db/experiences";
import PlayerChat from "@/components/PlayerChat";

export const dynamic = "force-dynamic";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const exp = await getPlayableExperience(slug);
  if (!exp || exp.stops.length === 0) notFound();

  return (
    <PlayerChat
      slug={exp.slug}
      title={exp.title}
      openingMessage={exp.openingMessage}
      closingMessage={exp.closingMessage}
      stops={exp.stops.map((s) => ({
        title: s.title,
        placeQuery: s.placeQuery,
        media: s.media,
      }))}
    />
  );
}
