"use client";

import { useState } from "react";
import Hero from "./Hero";
import ChatScreen from "./ChatScreen";

export default function DemoApp({
  videoTitles,
  videoCount,
}: {
  videoTitles: string[];
  videoCount: number;
}) {
  const [started, setStarted] = useState(false);

  if (!started) {
    return <Hero videoCount={videoCount} onStart={() => setStarted(true)} />;
  }
  return <ChatScreen videoTitles={videoTitles} videoCount={videoCount} />;
}
