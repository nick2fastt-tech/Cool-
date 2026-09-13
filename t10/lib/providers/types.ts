import type { ModelDefinition } from "../models/types";

export interface ChatMessageInput {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: ModelDefinition;
  messages: ChatMessageInput[];
  reasoningMode: string | null;
  /** Set when the router classified the turn as a software-engineering task. */
  codingTask: boolean;
  signal?: AbortSignal;
}

/** A single streamed event from a provider adapter. */
export type ProviderEvent =
  | { type: "thinking"; text: string }
  | { type: "delta"; text: string }
  | { type: "done" };

export interface ChatProvider {
  readonly id: string;
  readonly label: string;
  /** False when the required credentials are absent. */
  isConfigured(): boolean;
  /** Names the env var an operator must set. Shown in configuration errors. */
  requiredEnvVar(): string;
  streamChat(req: ChatRequest): AsyncGenerator<ProviderEvent>;
}
