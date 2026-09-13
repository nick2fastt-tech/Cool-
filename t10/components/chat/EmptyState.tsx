"use client";

import { IconCode, IconImage, IconSparkle } from "@/components/ui/icons";
import type { PublicModel } from "@/lib/models/types";

const SUGGESTIONS = [
  { icon: <IconSparkle />, label: "Explain something to me", prompt: "Explain how large language models actually work, in plain language." },
  { icon: <IconCode />, label: "Build a website", prompt: "Build me a responsive landing page in HTML and CSS for a small coffee shop." },
  { icon: <IconCode />, label: "Help me debug code", prompt: "Help me debug this JavaScript — it throws 'Cannot read properties of undefined'." },
  { icon: <IconImage />, label: "Create an image", prompt: "Create an image of a futuristic city at night." },
];

export function EmptyState({ model, onPick }: { model: PublicModel; onPick: (prompt: string) => void }) {
  const available = SUGGESTIONS.filter((s) => {
    if (s.label === "Create an image") return model.capabilities.images;
    return true;
  });

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10 text-center">
      <h1 className="text-[clamp(1.6rem,4.5vw,2.1rem)] font-semibold tracking-tight text-ink">{model.name}</h1>
      <p className="mt-2 text-[15.5px] text-ink-muted">How can I help?</p>

      <div className="mt-8 grid w-full max-w-2xl gap-2.5 sm:grid-cols-2">
        {available.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onPick(s.prompt)}
            className="group flex min-h-[56px] items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left transition hover:border-line-strong hover:bg-raised active:scale-[0.99]"
          >
            <span className="text-ink-muted transition group-hover:text-accent [&>svg]:h-[18px] [&>svg]:w-[18px]">
              {s.icon}
            </span>
            <span className="text-[14px] font-medium text-ink-soft transition group-hover:text-ink">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
