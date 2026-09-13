import { AppError } from "../errors";
import { buildSystemPrompt } from "./prompts";
import type { ChatProvider, ChatRequest, ProviderEvent } from "./types";

/**
 * Anthropic Messages API adapter (SSE streaming).
 *
 * Point T10 models at this adapter by setting, per model:
 *   T10_11_PROVIDER=anthropic
 *   T10_11_UPSTREAM_MODEL=<upstream model id>
 * plus the shared credential ANTHROPIC_API_KEY.
 */
const API_BASE = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
const API_VERSION = "2023-06-01";

export const anthropicProvider: ChatProvider = {
  id: "anthropic",
  label: "Anthropic Messages API",

  isConfigured() {
    return !!process.env.ANTHROPIC_API_KEY;
  },

  requiredEnvVar() {
    return "ANTHROPIC_API_KEY";
  },

  async *streamChat(req: ChatRequest): AsyncGenerator<ProviderEvent> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new AppError("provider_not_configured", `${req.model.name} is not connected to a provider yet.`, {
        hint: "Set ANTHROPIC_API_KEY and the model's upstream id in your environment.",
        docs: "/docs#connect-a-model",
      });
    }

    const upstream = process.env[req.model.binding.upstreamEnvVar] || req.model.binding.upstreamFallback;
    if (!upstream) {
      throw new AppError("provider_not_configured", `${req.model.name} has no upstream model configured.`, {
        hint: `Set ${req.model.binding.upstreamEnvVar} to the upstream model identifier.`,
        docs: "/docs#connect-a-model",
      });
    }

    const res = await fetch(`${API_BASE}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
      },
      signal: req.signal,
      body: JSON.stringify({
        model: upstream,
        max_tokens: req.model.limits.maxOutputTokens,
        stream: true,
        system: buildSystemPrompt(req),
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok || !res.body) {
      throw await upstreamError(res);
    }

    for await (const evt of parseSse(res.body)) {
      if (evt.type === "content_block_delta") {
        const delta = evt.delta;
        if (delta?.type === "text_delta" && typeof delta.text === "string") {
          yield { type: "delta", text: delta.text };
        } else if (delta?.type === "thinking_delta" && typeof delta.thinking === "string") {
          yield { type: "thinking", text: delta.thinking };
        }
      } else if (evt.type === "message_stop") {
        yield { type: "done" };
      } else if (evt.type === "error") {
        throw new AppError("upstream_error", "The model provider returned an error.");
      }
    }
  },
};

async function upstreamError(res: Response): Promise<AppError> {
  // Read the body for server logs only - its contents are never sent onward.
  let detail = "";
  try {
    detail = (await res.text()).slice(0, 400);
  } catch {
    /* ignore */
  }
  console.error(`[t10:anthropic] upstream ${res.status}: ${detail.replace(/sk-[A-Za-z0-9._-]+/g, "[redacted]")}`);

  if (res.status === 401 || res.status === 403) {
    return new AppError("unauthorized", "The configured provider credentials were rejected.", {
      hint: "Check ANTHROPIC_API_KEY.",
    });
  }
  if (res.status === 404) {
    return new AppError("model_unavailable", "The configured upstream model was not found.", {
      hint: "Check the model's upstream id environment variable.",
    });
  }
  if (res.status === 429) {
    return new AppError("rate_limited", "Rate limit reached at the model provider. Try again shortly.");
  }
  return new AppError("upstream_error", "The model provider could not complete that request.");
}

/** Minimal SSE parser over a fetch body stream. */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<any> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of raw.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            yield JSON.parse(payload);
          } catch {
            /* skip malformed frame */
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
