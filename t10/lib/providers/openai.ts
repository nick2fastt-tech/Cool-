import { AppError } from "../errors";
import { parseSse } from "./anthropic";
import { buildSystemPrompt } from "./prompts";
import type { ChatProvider, ChatRequest, ProviderEvent } from "./types";

/**
 * OpenAI-compatible Chat Completions adapter.
 *
 * Works with any host that speaks the /chat/completions wire format
 * (OpenAI, Azure OpenAI, Together, Groq, vLLM, Ollama, a private T10 host...).
 *
 *   T10_11_PROVIDER=openai
 *   T10_11_UPSTREAM_MODEL=<upstream model id>
 *   OPENAI_API_KEY=...
 *   OPENAI_BASE_URL=https://your-host/v1   (optional)
 */
const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

export const openAiProvider: ChatProvider = {
  id: "openai",
  label: "OpenAI-compatible Chat Completions",

  isConfigured() {
    return !!process.env.OPENAI_API_KEY;
  },

  requiredEnvVar() {
    return "OPENAI_API_KEY";
  },

  async *streamChat(req: ChatRequest): AsyncGenerator<ProviderEvent> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AppError("provider_not_configured", `${req.model.name} is not connected to a provider yet.`, {
        hint: "Set OPENAI_API_KEY and the model's upstream id in your environment.",
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

    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      signal: req.signal,
      body: JSON.stringify({
        model: upstream,
        stream: true,
        max_tokens: req.model.limits.maxOutputTokens,
        messages: [
          { role: "system", content: buildSystemPrompt(req) },
          ...req.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!res.ok || !res.body) {
      let detail = "";
      try {
        detail = (await res.text()).slice(0, 400);
      } catch {
        /* ignore */
      }
      console.error(`[t10:openai] upstream ${res.status}: ${detail.replace(/sk-[A-Za-z0-9._-]+/g, "[redacted]")}`);

      if (res.status === 401 || res.status === 403) {
        throw new AppError("unauthorized", "The configured provider credentials were rejected.", {
          hint: "Check OPENAI_API_KEY.",
        });
      }
      if (res.status === 404) {
        throw new AppError("model_unavailable", "The configured upstream model was not found.");
      }
      if (res.status === 429) {
        throw new AppError("rate_limited", "Rate limit reached at the model provider. Try again shortly.");
      }
      throw new AppError("upstream_error", "The model provider could not complete that request.");
    }

    for await (const frame of parseSse(res.body)) {
      const choice = frame?.choices?.[0];
      const text = choice?.delta?.content;
      if (typeof text === "string" && text) yield { type: "delta", text };
      if (choice?.finish_reason) yield { type: "done" };
    }
  },
};
