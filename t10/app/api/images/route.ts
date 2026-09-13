import { z } from "zod";
import { AppError, logError, toAppError } from "@/lib/errors";
import { resolveImageProvider } from "@/lib/images";
import { getModel } from "@/lib/models/registry";
import { enforceRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  modelId: z.string().min(1).max(64),
  prompt: z.string().min(1).max(2000),
  size: z.enum(["1024x1024", "1536x1024", "1024x1536"]).optional(),
});

const IMAGE_TIMEOUT_MS = Number(process.env.IMAGE_TIMEOUT_MS || 120000);

export async function POST(req: Request) {
  try {
    await enforceRateLimit(req, "images", Number(process.env.RATE_LIMIT_IMAGES || 10));

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      throw new AppError("invalid_request", "Request body must be valid JSON.");
    }

    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) throw new AppError("invalid_request", "That image request was not in the expected format.");

    const model = getModel(parsed.data.modelId);
    if (!model) throw new AppError("model_unavailable", "That model is not available.");
    if (!model.capabilities.images) {
      throw new AppError("invalid_request", `${model.name} cannot create images. Switch to a model that supports image creation.`);
    }

    const provider = resolveImageProvider();
    const image = await provider.generate({
      prompt: parsed.data.prompt,
      size: parsed.data.size,
      signal: AbortSignal.any([AbortSignal.timeout(IMAGE_TIMEOUT_MS), req.signal]),
    });

    return Response.json({ image });
  } catch (err) {
    logError("images", err);
    const appErr = toAppError(err);
    return Response.json({ error: appErr.toShape() }, { status: appErr.status });
  }
}
