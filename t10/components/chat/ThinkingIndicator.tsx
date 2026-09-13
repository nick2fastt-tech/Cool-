"use client";

import { useEffect, useState } from "react";
import { clsx } from "@/lib/utils";

const PHASES = ["Thinking", "Working through it", "Composing a response"];

/** Shown between send and first token. Announced politely to screen readers. */
export function ThinkingIndicator({ label, trace }: { label?: string; trace?: string }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (label) return;
    const timer = setInterval(() => setPhase((p) => (p + 1) % PHASES.length), 2400);
    return () => clearInterval(timer);
  }, [label]);

  const text = label ?? PHASES[phase];

  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      <div className="flex items-center gap-2.5">
        <span className="flex items-center gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-bob"
              style={{ animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </span>
        <span className={clsx("text-[13.5px] font-medium", "t10-shimmer motion-safe:animate-shimmer")}>{text}</span>
      </div>
      {trace && (
        <p className="max-h-24 overflow-hidden border-l-2 border-line pl-3 text-[12.5px] leading-relaxed text-ink-muted">
          {trace}
        </p>
      )}
    </div>
  );
}
