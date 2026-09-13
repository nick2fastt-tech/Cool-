import type { GeneratedImage } from "../images/types";

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  /** Model that produced an assistant turn. */
  modelId?: string;
  modelName?: string;
  reasoningMode?: string | null;
  /** Reasoning trace, when the provider emitted one. */
  thinking?: string;
  /** Populated for image-generation turns. */
  image?: GeneratedImage;
  imagePrompt?: string;
  /** Set when this turn was served by the local demo adapter. */
  demo?: boolean;
  /** Set when the turn failed; rendered as an error card. */
  error?: { code: string; message: string; hint?: string; docs?: string };
}

export interface Conversation {
  id: string;
  title: string;
  modelId: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

/**
 * Storage contract.
 *
 * LocalConversationStore implements this against browser storage today; a
 * ServerConversationStore can implement the same interface against a database
 * once accounts exist, without touching the UI.
 */
export interface ConversationStore {
  list(): Promise<Conversation[]>;
  get(id: string): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}
