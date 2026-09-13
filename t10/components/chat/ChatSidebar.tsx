"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { IconClose, IconPencil, IconPlus, IconSearch, IconSettings, IconTrash } from "@/components/ui/icons";
import type { Conversation } from "@/lib/storage/types";
import { clsx, formatRelativeTime } from "@/lib/utils";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
}

export function ChatSidebar({
  conversations,
  activeId,
  open,
  onClose,
  onNewChat,
  onSelect,
  onRename,
  onDelete,
  onOpenSettings,
}: Props) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const panelRef = useRef<HTMLElement>(null);

  // Close the mobile drawer on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }, [conversations, query]);

  const commitRename = (id: string) => {
    const next = draft.trim();
    if (next) onRename(id, next);
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile scrim */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={clsx(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        ref={panelRef}
        aria-label="Chat history"
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-line bg-surface",
          "transition-transform duration-250 ease-out lg:static lg:z-auto lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center gap-2 px-3 py-3">
          <Link
            href="/"
            className="rounded-lg px-1.5 py-1 text-[17px] transition hover:bg-raised"
            aria-label="T10 home"
          >
            <Wordmark />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition hover:bg-raised hover:text-ink lg:hidden"
          >
            <IconClose className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="px-3">
          <button
            type="button"
            onClick={onNewChat}
            className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border border-line-strong bg-raised px-3.5 text-[14px] font-medium text-ink transition hover:border-accent/45 active:scale-[0.99]"
          >
            <IconPlus className="h-4 w-4 text-accent" />
            New chat
          </button>
        </div>

        <div className="relative px-3 pt-2.5">
          <IconSearch className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <label htmlFor="t10-search" className="sr-only">
            Search chats
          </label>
          <input
            id="t10-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="h-10 w-full rounded-xl border border-transparent bg-canvas/60 pl-9 pr-3 text-[13.5px] text-ink outline-none transition placeholder:text-ink-muted focus:border-line-strong focus:bg-canvas"
          />
        </div>

        <nav aria-label="Recent conversations" className="mt-2 flex-1 overflow-y-auto px-2 pb-3">
          <p className="px-2 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-muted">
            Recent
          </p>

          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-[13px] leading-relaxed text-ink-muted">
              {query ? "No chats match that search." : "No conversations yet. Start a new chat to begin."}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((c) => {
                const active = c.id === activeId;
                const editing = editingId === c.id;
                return (
                  <li key={c.id}>
                    {editing ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => commitRename(c.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(c.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        aria-label="Conversation title"
                        className="w-full rounded-lg border border-accent/50 bg-canvas px-2.5 py-2 text-[13.5px] text-ink outline-none"
                      />
                    ) : (
                      <div
                        className={clsx(
                          "group flex items-center rounded-lg transition",
                          active ? "bg-raised" : "hover:bg-raised/60",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onSelect(c.id)}
                          aria-current={active ? "true" : undefined}
                          title={`${c.title} · ${formatRelativeTime(c.updatedAt)}`}
                          className="min-w-0 flex-1 px-2.5 py-2.5 text-left"
                        >
                          <span
                            className={clsx(
                              "block truncate text-[13.5px]",
                              active ? "font-medium text-ink" : "text-ink-soft",
                            )}
                          >
                            {c.title}
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center pr-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 md:opacity-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(c.id);
                              setDraft(c.title);
                            }}
                            aria-label={`Rename ${c.title}`}
                            className="rounded-md p-1.5 text-ink-muted transition hover:text-ink"
                          >
                            <IconPencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(c.id)}
                            aria-label={`Delete ${c.title}`}
                            className="rounded-md p-1.5 text-ink-muted transition hover:text-danger"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        <div className="border-t border-line p-2">
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 text-[13.5px] text-ink-soft transition hover:bg-raised hover:text-ink"
          >
            <IconSettings className="h-4 w-4" />
            Settings
          </button>
        </div>
      </aside>
    </>
  );
}
