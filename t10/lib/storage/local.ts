import type { Conversation, ConversationStore } from "./types";

const KEY = "t10:conversations:v1";
const MAX_CONVERSATIONS = 200;

/**
 * Browser-storage implementation of ConversationStore.
 *
 * Only conversation content is stored here - never credentials or tokens.
 * Every access is guarded: storage can be unavailable (private mode, disabled
 * cookies, quota exceeded) and that must never break the app.
 */
export class LocalConversationStore implements ConversationStore {
  private available(): boolean {
    try {
      if (typeof window === "undefined") return false;
      const probe = "__t10__";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }

  private readAll(): Conversation[] {
    if (!this.available()) return [];
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isConversation);
    } catch {
      return [];
    }
  }

  private writeAll(items: Conversation[]) {
    if (!this.available()) return;
    try {
      const trimmed = [...items].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVERSATIONS);
      window.localStorage.setItem(KEY, JSON.stringify(trimmed));
    } catch {
      /* quota exceeded - keep running with in-memory state */
    }
  }

  async list(): Promise<Conversation[]> {
    return this.readAll().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string): Promise<Conversation | null> {
    return this.readAll().find((c) => c.id === id) ?? null;
  }

  async save(conversation: Conversation): Promise<void> {
    const all = this.readAll().filter((c) => c.id !== conversation.id);
    all.push(conversation);
    this.writeAll(all);
  }

  async remove(id: string): Promise<void> {
    this.writeAll(this.readAll().filter((c) => c.id !== id));
  }

  async clear(): Promise<void> {
    if (!this.available()) return;
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}

function isConversation(v: unknown): v is Conversation {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return typeof c.id === "string" && typeof c.title === "string" && Array.isArray(c.messages);
}

export const conversationStore: ConversationStore = new LocalConversationStore();
