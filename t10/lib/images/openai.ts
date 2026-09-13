import { AppError } from "../errors";
import type { GeneratedImage, ImageProvider, ImageRequest } from "./types";

/**
 * OpenAI Images API adapter.
 *
 *   IMAGE_PROVIDER=openai
 *   OPENAI_API_KEY=...
 *   IMAGE_MODEL=gpt-image-1        (optional)
 *   OPENAI_BASE_URL=...            (optional)
 */
const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

export const openAiImageProvider: ImageProvider = {
  id: "openai",
  label: "OpenAI Images",

  isConfigured() {
    return !!process.env.OPENAI_API_KEY;
  },

  requiredEnvVar() {
    return "OPENAI_API_KEY";
  },

  async generate(req: ImageRequest): Promise<GeneratedImage> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AppError("image_provider_not_configured", "Image creation is not configured on this deployment.", {
        hint: "Set IMAGE_PROVIDER=openai and OPENAI_API_KEY.",
        docs: "/docs#image-generation",
      });
    }

    const model = process.env.IMAGE_MODEL || "gpt-image-1";
    const size = req.size || "1024x1024";

    const res = await fetch(`${BASE}/images/generations`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      signal: req.signal,
      body: JSON.stringify({ model, prompt: req.prompt, size, n: 1 }),
    });

    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.text()).slice(0, 400);
      } catch {
        /* ignore */
      }
      console.error(`[t10:image:openai] upstream ${res.status}: ${detail.replace(/sk-[A-Za-z0-9._-]+/g, "[redacted]")}`);

      if (res.status === 401 || res.status === 403) {
        throw new AppError("unauthorized", "The image provider rejected the configured credentials.");
      }
      if (res.status === 429) {
        throw new AppError("rate_limited", "Image rate limit reached. Try again shortly.");
      }
      if (res.status === 400) {
        throw new AppError("invalid_request", "The image provider rejected that prompt. Try rewording it.");
      }
      throw new AppError("upstream_error", "The image provider could not complete that request.");
    }

    const data = await res.json();
    const first = data?.data?.[0];
    const url = first?.url || (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : null);
    if (!url) {
      throw new AppError("upstream_error", "The image provider returned no image.");
    }

    const [w, h] = size.split("x").map(Number);
    return {
      url,
      width: w,
      height: h,
      prompt: req.prompt,
      provider: "openai",
      model,
      createdAt: new Date().toISOString(),
    };
  },
};
