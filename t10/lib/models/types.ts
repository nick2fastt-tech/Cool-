/**
 * Model + capability types.
 *
 * Everything the UI knows about a model comes from this shape, so adding
 * T10 1.2 / T10 2 / T10 Vision later is a data change, not a code change.
 */

export type ModelId = string;

export type CapabilityId = "chat" | "reasoning" | "coding" | "images" | "vision" | "files";

export type AvailabilityStatus = "available" | "coming-soon" | "deprecated";

export interface ReasoningMode {
  id: string;
  label: string;
  description: string;
  status: AvailabilityStatus;
  /** Provider-level hint; adapters map this onto their own reasoning controls. */
  budget?: "none" | "standard" | "extended";
}

export interface ModelCapabilities {
  chat: boolean;
  coding: boolean;
  images: boolean;
  vision: boolean;
  files: boolean;
  streaming: boolean;
}

/** Which upstream adapter serves this model, and under what upstream name. */
export interface ProviderBinding {
  /** Adapter key registered in lib/providers/index.ts */
  provider: "anthropic" | "openai" | "demo";
  /**
   * Upstream model identifier, read from an env var at request time so the
   * real T10 weights can be pointed at any host without a code change.
   */
  upstreamEnvVar: string;
  /** Used only when the env var above is unset. */
  upstreamFallback?: string;
}

export interface ModelDefinition {
  id: ModelId;
  /** Exact brand-facing name. Do not alter. */
  name: string;
  tagline: string;
  description: string;
  status: AvailabilityStatus;
  recommended: boolean;
  isNew: boolean;
  order: number;
  capabilities: ModelCapabilities;
  reasoningModes: ReasoningMode[];
  defaultReasoningMode: string | null;
  binding: ProviderBinding;
  limits: {
    maxOutputTokens: number;
    contextWindowNote: string;
  };
}

/** Model shape sent to the browser - never includes provider/env details. */
export interface PublicModel {
  id: ModelId;
  name: string;
  tagline: string;
  description: string;
  status: AvailabilityStatus;
  recommended: boolean;
  isNew: boolean;
  capabilities: ModelCapabilities;
  reasoningModes: ReasoningMode[];
  defaultReasoningMode: string | null;
}
