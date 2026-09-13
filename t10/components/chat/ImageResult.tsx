"use client";

import { useCallback, useEffect, useState } from "react";
import { IconClose, IconDownload, IconExpand, IconRefresh, IconSparkle } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import type { GeneratedImage } from "@/lib/images/types";

interface Props {
  image: GeneratedImage;
  onRegenerate?: () => void;
  onVariation?: () => void;
  busy?: boolean;
}

/** Renders a generated image with preview, fullscreen, download and re-run. */
export function ImageResult({ image, onRegenerate, onVariation, busy }: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const [failed, setFailed] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  const download = useCallback(async () => {
    try {
      const res = await fetch(image.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `t10-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      notify("Could not download that image.", "error");
    }
  }, [image.url, notify]);

  if (failed) {
    return (
      <div className="my-3 rounded-xl border border-line bg-raised p-4 text-[13.5px] text-ink-soft">
        The generated image could not be loaded. It may have expired at the provider — try regenerating.
        {onRegenerate && (
          <button onClick={onRegenerate} className="ml-2 font-medium text-accent underline underline-offset-2">
            Regenerate
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <figure className="my-3 overflow-hidden rounded-2xl border border-line bg-surface">
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="group relative block w-full"
          aria-label="View image full screen"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.prompt}
            width={image.width}
            height={image.height}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-auto w-full max-w-full bg-raised object-contain transition duration-300 group-hover:opacity-95"
            style={{ aspectRatio: `${image.width} / ${image.height}` }}
          />
          <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-lg bg-canvas/80 p-2 text-ink opacity-0 backdrop-blur transition group-hover:opacity-100">
            <IconExpand className="h-4 w-4" />
          </span>
        </button>

        <figcaption className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
          <p className="min-w-0 flex-1 truncate text-[12px] text-ink-muted" title={image.prompt}>
            {image.prompt}
          </p>
          <div className="flex items-center gap-1">
            {onVariation && (
              <ActionButton onClick={onVariation} disabled={busy} label="Create another variation">
                <IconSparkle className="h-3.5 w-3.5" /> Variation
              </ActionButton>
            )}
            {onRegenerate && (
              <ActionButton onClick={onRegenerate} disabled={busy} label="Regenerate this image">
                <IconRefresh className="h-3.5 w-3.5" /> Regenerate
              </ActionButton>
            )}
            <ActionButton onClick={download} label="Download image">
              <IconDownload className="h-3.5 w-3.5" /> Save
            </ActionButton>
          </div>
        </figcaption>
      </figure>

      {fullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onClick={() => setFullscreen(false)}
          className="fixed inset-0 z-[90] flex animate-fade-in items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            aria-label="Close preview"
            className="absolute right-4 top-4 rounded-xl bg-white/10 p-2.5 text-white transition hover:bg-white/20"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
          >
            <IconClose className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.prompt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88dvh] max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] font-medium text-ink-muted transition hover:bg-line/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Progress state shown while the image provider is working. */
export function ImageGenerating({ prompt }: { prompt: string }) {
  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-line bg-surface" role="status" aria-live="polite">
      <div className="relative aspect-square w-full max-w-sm overflow-hidden bg-raised">
        <div className="absolute inset-0 motion-safe:animate-sweep bg-gradient-to-r from-transparent via-accent/10 to-transparent" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <span className="text-[13.5px] font-medium t10-shimmer motion-safe:animate-shimmer">
            Creating your image…
          </span>
          <span className="line-clamp-2 text-[11.5px] text-ink-muted">{prompt}</span>
        </div>
      </div>
    </div>
  );
}
