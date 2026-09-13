import { imageProviderStatus } from "@/lib/images";
import { listPublicModels } from "@/lib/models/registry";
import { providerStatus } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Operator health/configuration view.
 *
 * Reports only whether credentials are present - never their values.
 */
export async function GET() {
  return Response.json({
    status: "ok",
    time: new Date().toISOString(),
    models: listPublicModels().map((m) => ({ id: m.id, name: m.name, status: m.status })),
    chatProviders: providerStatus(),
    imageProviders: imageProviderStatus(),
    persistence: {
      mode: process.env.DATABASE_URL ? "database" : "browser-local",
      note: process.env.DATABASE_URL
        ? "DATABASE_URL is set; server-side conversation storage can be enabled."
        : "No DATABASE_URL configured. Conversations persist in the browser only.",
    },
  });
}
