"use client";

import { useEffect } from "react";
import { captureUtm, track } from "@/lib/track";

export default function TrackView({ name, slug }: { name: string; slug?: string }) {
  useEffect(() => {
    captureUtm();
    track(name, slug);
  }, [name, slug]);
  return null;
}
