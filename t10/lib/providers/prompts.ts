import type { ChatRequest } from "./types";

/**
 * System prompt construction. Capability-aware: the coding and reasoning
 * instructions are only attached when the model actually supports them.
 */
export function buildSystemPrompt(req: ChatRequest): string {
  const { model, reasoningMode, codingTask } = req;

  const parts: string[] = [
    `You are ${model.name}, an AI assistant on the T10 platform.`,
    "Be clear, accurate and direct. Prefer concrete answers over hedging.",
    "Use markdown for structure. Keep formatting purposeful rather than decorative.",
    "If you are unsure or lack the information, say so plainly instead of inventing detail.",
  ];

  if (reasoningMode === "thinking") {
    parts.push(
      "Work through multi-step problems carefully before committing to an answer. Present the reasoning that matters to the reader, not a transcript of every step.",
    );
  }

  if (model.capabilities.coding && codingTask) {
    parts.push(
      [
        "This is a software engineering request. Respond with working, complete code.",
        "Always put code in fenced blocks with an accurate language tag (```python, ```tsx, ```lua, ```bash).",
        "Explain the key decisions briefly around the code, and note error handling and edge cases.",
        "If requirements are ambiguous, state the assumption you made and continue rather than stopping to ask.",
      ].join(" "),
    );
  }

  if (model.capabilities.images) {
    parts.push(
      "You can create images. If the user asks for one, the platform routes that request to the image provider automatically - do not claim you cannot make images, and do not describe an image as though you had produced it here.",
    );
  }

  return parts.join("\n\n");
}
