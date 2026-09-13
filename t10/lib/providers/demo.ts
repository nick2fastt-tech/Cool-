import { buildSystemPrompt } from "./prompts";
import type { ChatProvider, ChatRequest, ProviderEvent } from "./types";

/**
 * Local demo adapter.
 *
 * This is NOT a T10 model and does not pretend to be one. It exists so the
 * platform can be exercised end to end (streaming, markdown, code rendering,
 * persistence) before upstream credentials are configured, and as a fixture
 * for automated tests.
 *
 * Off unless T10_DEMO_MODE=true. Whenever it serves a turn the response is
 * labelled in the transcript and the UI shows a "Demo mode" badge.
 */
export const demoProvider: ChatProvider = {
  id: "demo",
  label: "Local demo adapter (not a T10 model)",

  isConfigured() {
    return process.env.T10_DEMO_MODE === "true";
  },

  requiredEnvVar() {
    return "T10_DEMO_MODE";
  },

  async *streamChat(req: ChatRequest): AsyncGenerator<ProviderEvent> {
    // Touch the prompt builder so demo runs exercise the same path as real ones.
    void buildSystemPrompt(req);

    const last = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";

    if (req.reasoningMode === "thinking") {
      for (const t of ["Reading the request", "Checking what is being asked for", "Drafting a reply"]) {
        yield { type: "thinking", text: t };
        await pause(160);
      }
    }

    const body = compose(last, req.codingTask, req.model.name);
    for (const token of body.match(/\S+\s*|\s+/g) ?? [body]) {
      yield { type: "delta", text: token };
      await pause(token.length > 8 ? 22 : 13);
    }
    yield { type: "done" };
  },
};

function pause(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const NOTE =
  "\n\n---\n\n*Served by the local demo adapter, not by a T10 model. Configure a provider to get real responses - see [Documentation](/docs#connect-a-model).*";

function compose(prompt: string, coding: boolean, modelName: string): string {
  const p = prompt.toLowerCase();

  if (coding) {
    if (/\bpython\b/.test(p)) {
      return [
        "Here is a working example with the error handling you will want in production:",
        "",
        "```python",
        'import json',
        'from pathlib import Path',
        "",
        "",
        "def load_config(path: str) -> dict:",
        '    """Read a JSON config, failing loudly with a useful message."""',
        "    file = Path(path)",
        "    if not file.exists():",
        '        raise FileNotFoundError(f"No config at {file.resolve()}")',
        "",
        "    try:",
        '        return json.loads(file.read_text(encoding="utf-8"))',
        "    except json.JSONDecodeError as exc:",
        '        raise ValueError(f"{file.name} is not valid JSON: {exc.msg}") from exc',
        "",
        "",
        'if __name__ == "__main__":',
        '    print(load_config("settings.json"))',
        "```",
        "",
        "Two things worth noting: `Path.read_text` with an explicit encoding avoids platform-dependent defaults, and re-raising with `from exc` keeps the original traceback attached." + NOTE,
      ].join("\n");
    }
    return [
      "Here is a self-contained implementation:",
      "",
      "```typescript",
      "type Result<T> = { ok: true; value: T } | { ok: false; error: string };",
      "",
      "export async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<Result<T>> {",
      "  const controller = new AbortController();",
      "  const timer = setTimeout(() => controller.abort(), timeoutMs);",
      "",
      "  try {",
      "    const res = await fetch(url, { signal: controller.signal });",
      "    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };",
      "    return { ok: true, value: (await res.json()) as T };",
      "  } catch (err) {",
      "    const aborted = err instanceof DOMException && err.name === 'AbortError';",
      "    return { ok: false, error: aborted ? 'Request timed out' : 'Network error' };",
      "  } finally {",
      "    clearTimeout(timer);",
      "  }",
      "}",
      "```",
      "",
      "The `Result` shape forces the caller to handle failure at the type level, and `finally` guarantees the timer is cleared on every path." + NOTE,
    ].join("\n");
  }

  if (/^(hi|hey|hello)\b/.test(p)) {
    return `Hello. You are talking to the T10 interface running on the local demo adapter, so this reply was generated on this machine rather than by ${modelName}.\n\nThe full pipeline is live - streaming, markdown, code blocks, conversation history. Connect a provider and the same interface carries real model responses.${NOTE}`;
  }

  return [
    `Here is how I would approach **${prompt.trim().slice(0, 110) || "that"}**:`,
    "",
    "1. **Pin down the outcome.** State in one sentence what a finished answer looks like - vague goals are the usual reason work stalls.",
    "2. **Find the smallest real version.** Build the stripped-down version first; it reveals what the full version actually needs.",
    "3. **Attack the hard part early.** Most problems have one genuinely difficult step and many easy ones.",
    "4. **Close the loop.** Put something in place that tells you quickly whether you are going the right way.",
    NOTE.trim(),
  ].join("\n");
}
