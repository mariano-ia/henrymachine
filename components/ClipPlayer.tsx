"use client";

import { useState } from "react";
import type { Clip } from "@/lib/types";

export default function ClipPlayer({ clip }: { clip: Clip }) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <div className="mt-2 aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube.com/embed/${clip.videoId}?start=${clip.startSec}&autoplay=1&rel=0`}
          title="Clip"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-neutral-200 transition hover:bg-white/10 active:scale-[0.98]"
    >
      <span>🎧</span>
      <span>{clip.label}</span>
    </button>
  );
}
