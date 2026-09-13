import { AppError } from "../errors";
import { openAiImageProvider } from "./openai";
import { stabilityImageProvider } from "./stability";
import type { ImageProvider } from "./types";

const REGISTRY: Record<string, ImageProvider> = {
  openai: openAiImageProvider,
  stability: stabilityImageProvider,
};

/**
 * Resolve the configured image provider.
 *
 * There is deliberately no fallback: if nothing is configured the caller gets a
 * configuration error. T10 never substitutes a stock or placeholder image for a
 * generated one.
 */
export function resolveImageProvider(): ImageProvider {
  const selected = process.env.IMAGE_PROVIDER;

  if (selected) {
    const provider = REGISTRY[selected];
    if (!provider) {
      throw new AppError("image_provider_not_configured", "Image creation is not configured on this deployment.", {
        hint: `IMAGE_PROVIDER is set to "${selected}", which is not a known provider. Use one of: ${Object.keys(REGISTRY).join(", ")}.`,
        docs: "/docs#image-generation",
      });
    }
    if (!provider.isConfigured()) {
      throw new AppError("image_provider_not_configured", "Image creation is not configured on this deployment.", {
        hint: `Set ${provider.requiredEnvVar()} to enable image creation through ${provider.label}.`,
        docs: "/docs#image-generation",
      });
    }
    return provider;
  }

  const ready = Object.values(REGISTRY).find((p) => p.isConfigured());
  if (ready) return ready;

  throw new AppError("image_provider_not_configured", "Image creation is not configured on this deployment.", {
    hint: "Set IMAGE_PROVIDER (openai or stability) together with that provider's API key.",
    docs: "/docs#image-generation",
  });
}

export function imageProviderStatus() {
  const selected = process.env.IMAGE_PROVIDER || null;
  return {
    selected,
    providers: Object.values(REGISTRY).map((p) => ({
      id: p.id,
      label: p.label,
      configured: p.isConfigured(),
      requires: p.requiredEnvVar(),
    })),
  };
}

export type { GeneratedImage, ImageProvider, ImageRequest } from "./types";
