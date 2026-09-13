import { AppError, toAppError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-side conversation persistence.
 *
 * The client currently persists conversations in browser storage through the
 * ConversationStore interface (lib/storage). This route is the account-backed
 * half of that interface: it stays honest about not being wired up until both
 * a database and authentication are configured, rather than silently dropping
 * writes.
 *
 * To enable:
 *   1. Set DATABASE_URL and AUTH_SECRET.
 *   2. Implement a ServerConversationStore against your database.
 *   3. Swap the store in components/chat/ChatShell.tsx.
 */
function notConfigured(): never {
  throw new AppError("provider_not_configured", "Account-backed chat history is not enabled on this deployment.", {
    hint: "Conversations are saved in this browser. Set DATABASE_URL and AUTH_SECRET to enable synced history across devices.",
    docs: "/docs#persistence",
  });
}

export async function GET() {
  try {
    if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET) notConfigured();
    return Response.json({ conversations: [] });
  } catch (err) {
    const appErr = toAppError(err);
    return Response.json({ error: appErr.toShape() }, { status: appErr.status });
  }
}

export async function POST() {
  try {
    if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET) notConfigured();
    return Response.json({ ok: true });
  } catch (err) {
    const appErr = toAppError(err);
    return Response.json({ error: appErr.toShape() }, { status: appErr.status });
  }
}
