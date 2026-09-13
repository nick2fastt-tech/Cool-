import { listPublicModels } from "@/lib/models/registry";

export const runtime = "nodejs";

/** Public model catalogue. Contains no provider or credential detail. */
export async function GET() {
  return Response.json(
    { models: listPublicModels() },
    { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
