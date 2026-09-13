/** Minimal class-name joiner. Avoids pulling in a dependency for this. */
export function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = 60_000, hr = 3_600_000, day = 86_400_000;
  if (diff < min) return "Just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < day * 7) return `${Math.floor(diff / day)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Derives a conversation title from the first user message. */
export function titleFromMessage(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  const truncated = clean.length > 48 ? `${clean.slice(0, 48).replace(/\s\S*$/, "")}…` : clean;
  return truncated.charAt(0).toUpperCase() + truncated.slice(1);
}
