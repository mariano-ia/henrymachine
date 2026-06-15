"use client";

import { useState } from "react";
import IngestScreen from "@/components/IngestScreen";
import ChatScreen from "@/components/ChatScreen";
import type { IngestResult } from "@/lib/types";

export default function Home() {
  const [session, setSession] = useState<IngestResult | null>(null);

  if (session) {
    return <ChatScreen session={session} onReset={() => setSession(null)} />;
  }
  return <IngestScreen onReady={setSession} />;
}
