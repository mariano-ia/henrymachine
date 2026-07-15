"use client";

import { useState } from "react";
import { shareOrCopy } from "@/lib/share";

export default function ShareButton({
  text,
  url,
  label,
  className,
}: {
  text: string;
  url: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        const r = await shareOrCopy(text, url);
        if (r === "copied") {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }}
      className={className}
    >
      {copied ? "¡Link copiado!" : label}
    </button>
  );
}
