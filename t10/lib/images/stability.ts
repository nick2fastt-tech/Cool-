import { AppError } from "../errors";
import type { GeneratedImage, ImageProvider, ImageRequest } from "./types";

/**
 * Stability AI adapter.
 *
 *   IMAGE_PROVIDER=stability
 *   STABILITY_API_KEY=...
 *   IMAGE_MODEL=core            (core | ultra | sd3)
 */
export const stabilityImageProvider: ImageProvider = {
  id: "stability",
  label: "Stability AI",

  isConfigured() {
    return !!process.env.STABILITY_API_KEY;
  },

  requiredEnvVar() {
    return "STABILITY_API_KEY";
  },

  async generate(req: ImageRequest): Promise<GeneratedImage> {
    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) {
      throw new AppError("image_provider_not_configured", "Image creation is not configured on this deployment.", {
        hint: "Set IMAGE_PROVIDER=stability and STABILITY_API_KEY.",
        docs: "/docs#image-generation",
      });
    }

    const model = process.env.IMAGE_MODEL || "core";
    const form = new FormData();
    form.append("prompt", req.prompt);
    form.append("output_format", "png");

    const res = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/${model}`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, accept: "image/*" },
      body: form,
      signal: req.signal,
    });

    if (!res.ok) {
      console.error(`[t10:image:stability] upstream ${res.status}`);
      if (res.status === 401 || res.status === 403) {
        throw new AppError("unauthorized", "The image provider rejected the configured credentials.");
      }
      if (res.status === 429) throw new AppError("rate_limited", "Image rate limit reached. Try again shortly.");
      throw new AppError("upstream_error", "The image provider could not complete that request.");
    }

    const buf = Buffer.from(await res.arrayBuffer());
    return {
      url: `data:image/png;base64,${buf.toString("base64")}`,
      width: 1024,
      height: 1024,
      prompt: req.prompt,
      provider: "stability",
      model,
      createdAt: new Date().toISOString(),
    };
  },
};
