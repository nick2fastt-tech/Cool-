import { AppError } from "../errors";
import type { ModelDefinition } from "../models/types";
import { anthropicProvider } from "./anthropic";
import { demoProvider } from "./demo";
import { openAiProvider } from "./openai";
import type { ChatProvider } from "./types";

const REGISTRY: Record<string, ChatProvider> = {
  anthropic: anthropicProvider,
  openai: openAiProvider,
  demo: demoProvider,
};

/**
 * Resolve the adapter for a model.
 *
 * If the model's own provider has no credentials and demo mode is explicitly
 * enabled, fall back to the clearly-labelled demo adapter. Otherwise raise a
 * configuration error naming the env var to set - we never silently fake a
 * model response.
 */
export function resolveProvider(model: ModelDefinition): { provider: ChatProvider; isDemo: boolean } {
  const preferred = REGISTRY[model.binding.provider];

  if (preferred && preferred.isConfigured()) {
    return { provider: preferred, isDemo: preferred.id === "demo" };
  }

  if (demoProvider.isConfigured()) {
    return { provider: demoProvider, isDemo: true };
  }

  throw new AppError("provider_not_configured", `${model.name} is not connected to a model provider yet.`, {
    hint: `Set ${preferred?.requiredEnvVar() ?? "your provider credentials"} and ${model.binding.upstreamEnvVar}, or set T10_DEMO_MODE=true to explore the interface with the local demo adapter.`,
    docs: "/docs#connect-a-model",
  });
}

/** Operator-facing status used by /api/health. Never lists key values. */
export function providerStatus() {
  return Object.values(REGISTRY).map((p) => ({
    id: p.id,
    label: p.label,
    configured: p.isConfigured(),
    requires: p.requiredEnvVar(),
  }));
}

export type { ChatProvider } from "./types";
