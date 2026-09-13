import { z } from "zod";
import { isCodingRequest } from "@/lib/chat/intent";
import { AppError, logError, toAppError } from "@/lib/errors";
import { getModel, isReasoningModeSelectable } from "@/lib/models/registry";
import { resolveProvider } from "@/lib/providers";
import { enforceRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  modelId: z.string().min(1).max(64),
  reasoningMode: z.string().min(1).max(64).nullable().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(24000),
      }),
    )
    .min(1)
    .max(80),
});

const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 120000);

export async function POST(req: Request) {
  try {
    await enforceRateLimit(req, "chat");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      throw new AppError("invalid_request", "Request body must be valid JSON.");
    }

    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError("invalid_request", "That request was not in the expected format.");
    }

    // Never trust a client-supplied model id: it must exist in the registry.
    const model = getModel(parsed.data.modelId);
    if (!model) throw new AppError("model_unavailable", "That model is not available.");
    if (model.status !== "available") {
      throw new AppError("model_unavailable", `${model.name} is not available yet.`);
    }

    // Reasoning modes that are not released cannot be activated from the client.
    const requestedMode = parsed.data.reasoningMode ?? null;
    const reasoningMode = isReasoningModeSelectable(model, requestedMode)
      ? requestedMode
      : model.defaultReasoningMode;

    const lastUser = [...parsed.data.messages].reverse().find((m) => m.role === "user");
    const codingTask = model.capabilities.coding && !!lastUser && isCodingRequest(lastUser.content);

    const { provider, isDemo } = resolveProvider(model);

    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = AbortSignal.any([timeout, req.signal]);

    const encoder = new TextEncoder();
    let closed = false;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // The client can disconnect at any point (navigation, Stop button).
        // Enqueueing into a closed controller throws, so every write is guarded.
        const send = (event: string, data: unknown) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {
            closed = true;
          }
        };

        try {
          send("meta", {
            model: model.id,
            modelName: model.name,
            reasoningMode,
            codingTask,
            demo: isDemo,
          });

          for await (const evt of provider.streamChat({
            model,
            messages: parsed.data.messages,
            reasoningMode,
            codingTask,
            signal,
          })) {
            if (closed) break; // client went away - stop pulling from upstream
            if (evt.type === "delta") send("delta", { text: evt.text });
            else if (evt.type === "thinking") send("thinking", { text: evt.text });
          }

          send("done", { ok: true });
        } catch (err) {
          // A disconnect surfaces as an abort; that is not an error worth logging.
          const aborted = closed || signal.aborted;
          if (!aborted) {
            logError("chat.stream", err);
            const appErr = toAppError(err);
            // Errors mid-stream are delivered as an SSE event: the HTTP status
            // is already committed by this point.
            send("error", appErr.toShape());
          }
        } finally {
          if (!closed) {
            closed = true;
            try {
              controller.close();
            } catch {
              /* already closed by the runtime */
            }
          }
        }
      },

      cancel() {
        closed = true;
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  } catch (err) {
    logError("chat", err);
    const appErr = toAppError(err);
    return Response.json({ error: appErr.toShape() }, { status: appErr.status });
  }
}
