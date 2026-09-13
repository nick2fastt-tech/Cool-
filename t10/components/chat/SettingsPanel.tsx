"use client";

import { useEffect, useState } from "react";
import { IconClose, IconMoon, IconSun } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import type { PublicModel } from "@/lib/models/types";

interface Props {
  open: boolean;
  onClose: () => void;
  model: PublicModel;
  onClearAll: () => void;
  conversationCount: number;
}

export function SettingsPanel({ open, onClose, model, onClearAll, conversationCount }: Props) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const { notify } = useToast();

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const applyTheme = (next: "dark" | "light") => {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("t10:theme", next);
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="t10-settings-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] w-full max-w-md animate-pop-in overflow-y-auto rounded-2xl border border-line-strong bg-surface shadow-2xl"
      >
        <header className="flex items-center gap-3 border-b border-line px-5 py-4">
          <h2 id="t10-settings-title" className="text-[16px] font-semibold tracking-tight">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="ml-auto rounded-lg p-2 text-ink-muted transition hover:bg-raised hover:text-ink"
          >
            <IconClose className="h-[18px] w-[18px]" />
          </button>
        </header>

        <div className="space-y-5 p-5">
          <section>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-muted">Appearance</h3>
            <div className="flex gap-2">
              <ThemeButton active={theme === "dark"} onClick={() => applyTheme("dark")} icon={<IconMoon />} label="Dark" />
              <ThemeButton active={theme === "light"} onClick={() => applyTheme("light")} icon={<IconSun />} label="Light" />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-muted">Active model</h3>
            <div className="rounded-xl border border-line bg-raised p-3.5">
              <p className="text-[14px] font-medium text-ink">{model.name}</p>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">{model.description}</p>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-muted">Data</h3>
            <div className="rounded-xl border border-line bg-raised p-3.5">
              <p className="text-[13.5px] text-ink-soft">
                {conversationCount} {conversationCount === 1 ? "conversation" : "conversations"} saved in this browser.
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                Chats are stored locally on this device. Account-synced history becomes available once a database and
                authentication are configured.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (confirm("Delete every saved conversation? This cannot be undone.")) {
                    onClearAll();
                    notify("All conversations deleted.", "success");
                    onClose();
                  }
                }}
                className="mt-3 rounded-lg border border-danger/40 px-3 py-1.5 text-[13px] font-medium text-danger transition hover:bg-danger/10"
              >
                Delete all chats
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ThemeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border text-[13.5px] font-medium transition ${
        active ? "border-accent/55 bg-accent/10 text-ink" : "border-line bg-raised text-ink-muted hover:text-ink"
      }`}
    >
      <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      {label}
    </button>
  );
}
