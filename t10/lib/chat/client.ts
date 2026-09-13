import type { AppErrorShape } from "../errors";
import type { GeneratedImage } from "../images/types";
import type { ChatMessage } from "../storage/types";

export interface StreamHandlers {
  onMeta?: (meta: { modelName: string; reasoningMode: string | null; codingTask: boolean; demo: boolean }) => void;
  onThinking?: (text: string) => void;
  onDelta?: (text: string) => void;
  onError?: (err: AppErrorShape) => void;
  onDone?: () => void;
}

const GENERIC_ERROR: AppErrorShape = {
  code: "internal_error",
  message: "Something went wrong sending that message.",
  status: 500,
};

/**
 * Posts a turn to /api/chat and consumes the SSE stream.
 * All failure paths surface a typed AppErrorShape - the UI never sees a raw
 * exception or an upstream payload.
 */
export async function streamChat(
  body: { modelId: string; reasoningMode: string | null; messages: Pick<ChatMessage, "role" | "content">[] },
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (isAbort(err)) return;
    handlers.onError?.({
      code: "network_error",
      message: "Could not reach T10. Check your connection and try again.",
      status: 0,
    });
    return;
  }

  if (!res.ok) {
    let shape = GENERIC_ERROR;
    try {
      const data = await res.json();
      if (data?.error?.message) shape = data.error as AppErrorShape;
    } catch {
      /* non-JSON error body */
    }
    handlers.onError?.(shape);
    return;
  }

  if (!res.body) {
    handlers.onError?.(GENERIC_ERROR);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        dispatch(frame, handlers);
      }
    }
    handlers.onDone?.();
  } catch (err) {
    if (isAbort(err)) return;
    handlers.onError?.({
      code: "network_error",
      message: "The connection dropped while T10 was responding.",
      status: 0,
    });
  } finally {
    reader.releaseLock();
  }
}

function dispatch(frame: string, handlers: StreamHandlers) {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return;

  let payload: any;
  try {
    payload = JSON.parse(dataLines.join("\n"));
  } catch {
    return;
  }

  switch (event) {
    case "meta":
      handlers.onMeta?.(payload);
      break;
    case "thinking":
      handlers.onThinking?.(payload.text ?? "");
      break;
    case "delta":
      handlers.onDelta?.(payload.text ?? "");
      break;
    case "error":
      handlers.onError?.(payload as AppErrorShape);
      break;
    case "done":
      handlers.onDone?.();
      break;
  }
}

/** Requests an image from /api/images. */
export async function generateImage(
  body: { modelId: string; prompt: string },
  signal?: AbortSignal,
): Promise<{ image?: GeneratedImage; error?: AppErrorShape }> {
  try {
    const res = await fetch("/api/images", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return { error: (data?.error as AppErrorShape) ?? GENERIC_ERROR };
    }
    if (!data?.image) {
      return { error: { code: "upstream_error", message: "The image provider returned no image.", status: 502 } };
    }
    return { image: data.image as GeneratedImage };
  } catch (err) {
    if (isAbort(err)) return {};
    return {
      error: { code: "network_error", message: "Could not reach the image service. Check your connection.", status: 0 },
    };
  }
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
