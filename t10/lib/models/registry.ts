import type { ModelDefinition, ModelId, PublicModel } from "./types";

/**
 * The T10 model registry.
 *
 * Adding a future model (T10 1.2, T10 2, T10 Vision, T10 Coding) means adding
 * an entry here plus an env var for its upstream id - no UI changes required.
 */
export const MODELS: readonly ModelDefinition[] = [
  {
    id: "t10-v1",
    name: "T10 V1",
    tagline: "Fast general-purpose model",
    description: "General-purpose T10 model for everyday conversation, writing and explanation.",
    status: "available",
    recommended: false,
    isNew: false,
    order: 1,
    capabilities: { chat: true, coding: true, images: false, vision: false, files: false, streaming: true },
    reasoningModes: [],
    defaultReasoningMode: null,
    binding: {
      provider: (process.env.T10_V1_PROVIDER as "anthropic" | "openai" | "demo") || "anthropic",
      upstreamEnvVar: "T10_V1_UPSTREAM_MODEL",
    },
    limits: { maxOutputTokens: 2048, contextWindowNote: "Set by the configured upstream provider." },
  },
  {
    id: "t10-1.1",
    name: "T10 1.1",
    tagline: "Advanced reasoning, coding & image creation",
    description:
      "Our newest model. Built for multi-step reasoning, software engineering, image creation and complex instructions.",
    status: "available",
    recommended: true,
    isNew: true,
    order: 2,
    capabilities: { chat: true, coding: true, images: true, vision: false, files: false, streaming: true },
    reasoningModes: [
      {
        id: "thinking",
        label: "Thinking",
        description: "Works through problems step by step before answering.",
        status: "available",
        budget: "standard",
      },
      {
        id: "extended-thinking",
        label: "Extended Thinking",
        description: "Longer deliberation for the hardest multi-step problems.",
        status: "coming-soon",
        budget: "extended",
      },
    ],
    defaultReasoningMode: "thinking",
    binding: {
      provider: (process.env.T10_11_PROVIDER as "anthropic" | "openai" | "demo") || "anthropic",
      upstreamEnvVar: "T10_11_UPSTREAM_MODEL",
    },
    limits: { maxOutputTokens: 4096, contextWindowNote: "Set by the configured upstream provider." },
  },
] as const;

export const DEFAULT_MODEL_ID: ModelId = "t10-1.1";

const BY_ID = new Map(MODELS.map((m) => [m.id, m]));

/** Validates a user-supplied model id. Never trust the client's value. */
export function getModel(id: string | undefined | null): ModelDefinition | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function requireModel(id: string | undefined | null): ModelDefinition {
  const model = getModel(id) ?? getModel(DEFAULT_MODEL_ID);
  if (!model) throw new Error("Model registry is empty");
  return model;
}

export function isReasoningModeSelectable(model: ModelDefinition, modeId: string | null): boolean {
  if (!modeId) return true;
  const mode = model.reasoningModes.find((m) => m.id === modeId);
  return !!mode && mode.status === "available";
}

function toPublic(m: ModelDefinition): PublicModel {
  return {
    id: m.id,
    name: m.name,
    tagline: m.tagline,
    description: m.description,
    status: m.status,
    recommended: m.recommended,
    isNew: m.isNew,
    capabilities: m.capabilities,
    reasoningModes: m.reasoningModes,
    defaultReasoningMode: m.defaultReasoningMode,
  };
}

/** Safe, serialisable model list for the browser and for server components. */
export function listPublicModels(): PublicModel[] {
  return [...MODELS].sort((a, b) => a.order - b.order).map(toPublic);
}

export function getPublicModel(id: string): PublicModel | null {
  const m = getModel(id);
  return m ? toPublic(m) : null;
}
