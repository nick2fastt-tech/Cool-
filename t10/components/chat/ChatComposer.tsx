"use client";

import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { IconArrowUp, IconCode, IconImage, IconPaperclip, IconSparkle, IconStop } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import type { PublicModel } from "@/lib/models/types";
import { clsx } from "@/lib/utils";

export interface ComposerHandle {
  focus: () => void;
  setValue: (v: string) => void;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
  model: PublicModel;
  reasoningMode: string | null;
}

const MAX_HEIGHT = 208;

export const ChatComposer = forwardRef<ComposerHandle, Props>(function ChatComposer(
  { value, onChange, onSubmit, onStop, busy, model, reasoningMode },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { notify } = useToast();

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    setValue: (v: string) => {
      onChange(v);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
  }));

  // Grow with content up to a cap, then scroll.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter and IME composition insert a newline.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!busy && value.trim()) onSubmit();
    }
  };

  const reasoningLabel = model.reasoningModes.find((m) => m.id === reasoningMode)?.label;
  const canSend = value.trim().length > 0 && !busy;

  return (
    <div className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) onSubmit();
        }}
        className={clsx(
          "flex items-end gap-2 rounded-[22px] border border-line-strong bg-surface p-2 pl-3 transition",
          "focus-within:border-accent/55 focus-within:shadow-[0_0_0_3px_rgb(var(--t10-accent)/0.14)]",
        )}
      >
        <button
          type="button"
          onClick={() => notify("File attachments are coming soon.")}
          aria-label="Attach a file"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-raised hover:text-ink"
        >
          <IconPaperclip className="h-[18px] w-[18px]" />
        </button>

        <label htmlFor="t10-composer" className="sr-only">
          Message {model.name}
        </label>
        <textarea
          id="t10-composer"
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask T10 anything..."
          enterKeyHint="send"
          autoComplete="off"
          spellCheck
          className="min-h-[44px] flex-1 resize-none self-center bg-transparent py-2.5 text-[16px] leading-6 text-ink outline-none placeholder:text-ink-muted"
          style={{ maxHeight: MAX_HEIGHT }}
        />

        <button
          type={busy ? "button" : "submit"}
          onClick={busy ? onStop : undefined}
          disabled={!busy && !canSend}
          aria-label={busy ? "Stop generating" : "Send message"}
          className={clsx(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-95",
            busy
              ? "bg-ink text-canvas hover:opacity-90"
              : canSend
                ? "bg-accent text-accent-ink hover:brightness-110"
                : "cursor-not-allowed bg-raised text-ink-muted",
          )}
        >
          {busy ? <IconStop className="h-4 w-4" /> : <IconArrowUp className="h-[18px] w-[18px]" />}
        </button>
      </form>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2 text-[11.5px] text-ink-muted">
        {reasoningLabel && (
          <Indicator icon={<IconSparkle />} label={reasoningLabel} title={`${reasoningLabel} is active`} />
        )}
        {model.capabilities.coding && <Indicator icon={<IconCode />} label="Coding" title={`${model.name} can write and debug code`} />}
        {model.capabilities.images && <Indicator icon={<IconImage />} label="Image creation" title={`${model.name} can create images`} />}
        <span className="hidden sm:inline">T10 can make mistakes — verify important information.</span>
      </div>
    </div>
  );
});

function Indicator({ icon, label, title }: { icon: React.ReactNode; label: string; title: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={title}>
      <span className="text-accent [&>svg]:h-3 [&>svg]:w-3">{icon}</span>
      {label}
    </span>
  );
}
