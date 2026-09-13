"use client";

import { useEffect, useId, useRef, useState } from "react";
import { IconBrain, IconCheck, IconChevronDown, IconCode, IconImage, IconSparkle } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import type { PublicModel, ReasoningMode } from "@/lib/models/types";
import { clsx } from "@/lib/utils";

interface Props {
  models: PublicModel[];
  activeModelId: string;
  reasoningMode: string | null;
  onSelectModel: (id: string) => void;
  onSelectReasoning: (modeId: string | null) => void;
}

/**
 * Model + reasoning-mode selector.
 *
 * Implements the listbox keyboard pattern: Arrow keys move, Enter/Space select,
 * Escape closes and restores focus, Tab closes. Unreleased reasoning modes are
 * exposed as aria-disabled so assistive tech announces them without allowing
 * selection.
 */
export function ModelSelector({ models, activeModelId, reasoningMode, onSelectModel, onSelectReasoning }: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { notify } = useToast();
  const listboxId = useId();

  const active = models.find((m) => m.id === activeModelId) ?? models[0];
  const activeReasoning = active?.reasoningModes.find((r) => r.id === reasoningMode) ?? null;

  // Anchor to the viewport rather than the trigger: on a narrow screen the
  // trigger sits far enough right that a left-aligned panel would overflow.
  useEffect(() => {
    if (!open) return;

    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 12;
      const width = Math.min(352, window.innerWidth - margin * 2);
      const left = Math.min(Math.max(rect.left, margin), window.innerWidth - width - margin);
      setCoords({ top: rect.bottom + 8, left, width });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setActiveIndex(Math.max(0, models.findIndex((m) => m.id === activeModelId)));
      // Focus the list so arrow keys work immediately.
      requestAnimationFrame(() => listRef.current?.focus());
    }
  }, [open, models, activeModelId]);

  const choose = (model: PublicModel) => {
    onSelectModel(model.id);
    // Reset reasoning to the new model's default so state stays coherent.
    onSelectReasoning(model.defaultReasoningMode);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % models.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + models.length) % models.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(models.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const model = models[activeIndex];
      if (model) choose(model);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const pickReasoning = (mode: ReasoningMode) => {
    if (mode.status !== "available") {
      notify(`${mode.label} is coming soon.`);
      return;
    }
    onSelectReasoning(mode.id);
  };

  if (!active) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={`Model: ${active.name}${activeReasoning ? `, reasoning: ${activeReasoning.label}` : ""}. Change model`}
        className={clsx(
          "group flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-1.5 text-left transition",
          "hover:border-line-strong hover:bg-raised",
          open ? "border-line-strong bg-raised" : "border-transparent",
        )}
      >
        <span className="flex flex-col leading-tight">
          <span className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight text-ink">
            {active.name}
            <IconChevronDown
              className={clsx("h-4 w-4 text-ink-muted transition-transform duration-200", open && "rotate-180")}
            />
          </span>
          {activeReasoning && (
            <span className="text-[11.5px] font-medium text-ink-muted">{activeReasoning.label}</span>
          )}
        </span>
      </button>

      {open && (
        <div
          style={
            coords
              ? { position: "fixed", top: coords.top, left: coords.left, width: coords.width }
              : { visibility: "hidden", position: "fixed" }
          }
          className={clsx(
            "z-50 max-h-[min(78dvh,40rem)] origin-top animate-pop-in overflow-y-auto",
            "rounded-2xl border border-line-strong bg-surface shadow-2xl shadow-black/40",
          )}
        >
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Available models"
            aria-activedescendant={`${listboxId}-opt-${activeIndex}`}
            tabIndex={-1}
            onKeyDown={onListKeyDown}
            className="p-1.5 outline-none"
          >
            <p className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-muted">
              Models
            </p>

            {models.map((model, i) => {
              const selected = model.id === activeModelId;
              return (
                <div
                  key={model.id}
                  id={`${listboxId}-opt-${i}`}
                  role="option"
                  aria-selected={selected}
                  onClick={() => choose(model)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={clsx(
                    "cursor-pointer rounded-xl px-2.5 py-2.5 transition",
                    i === activeIndex ? "bg-raised" : "hover:bg-raised/60",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[14px] font-semibold tracking-tight text-ink">{model.name}</span>
                        {model.isNew && (
                          <span className="rounded-[5px] bg-accent/15 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider text-accent">
                            New
                          </span>
                        )}
                        {model.recommended && (
                          <span className="rounded-[5px] border border-line-strong px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wider text-ink-muted">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">{model.tagline}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {model.reasoningModes.length > 0 && <CapabilityPill icon={<IconBrain />} label="Reasoning" />}
                        {model.capabilities.coding && <CapabilityPill icon={<IconCode />} label="Coding" />}
                        {model.capabilities.images && <CapabilityPill icon={<IconImage />} label="Images" />}
                      </div>
                    </div>
                    {selected && <IconCheck className="mt-1 h-4 w-4 shrink-0 text-accent" />}
                  </div>
                </div>
              );
            })}
          </div>

          {active.reasoningModes.length > 0 && (
            <div className="border-t border-line p-1.5">
              <p className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-muted">
                Reasoning
              </p>
              <div role="group" aria-label="Reasoning mode">
                {active.reasoningModes.map((mode) => {
                  const disabled = mode.status !== "available";
                  const selected = mode.id === reasoningMode;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => pickReasoning(mode)}
                      aria-disabled={disabled}
                      aria-pressed={selected}
                      className={clsx(
                        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
                        disabled ? "cursor-not-allowed opacity-55" : "hover:bg-raised",
                      )}
                    >
                      <IconSparkle className={clsx("h-4 w-4 shrink-0", selected ? "text-accent" : "text-ink-muted")} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[13.5px] font-medium text-ink">{mode.label}</span>
                          {disabled ? (
                            <span className="rounded-[5px] border border-line-strong px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wider text-ink-muted">
                              Coming Soon
                            </span>
                          ) : (
                            <span className="text-[10.5px] font-medium uppercase tracking-wider text-ok">Available</span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-muted">
                          {mode.description}
                        </span>
                      </span>
                      {selected && !disabled && <IconCheck className="h-4 w-4 shrink-0 text-accent" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CapabilityPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-line bg-canvas/60 px-1.5 py-0.5 text-[10.5px] font-medium text-ink-muted">
      <span className="[&>svg]:h-3 [&>svg]:w-3">{icon}</span>
      {label}
    </span>
  );
}
