import { AppError } from "./errors";

/**
 * In-memory sliding-window rate limiter.
 *
 * Suitable for a single instance. For multi-instance deployments swap the Store
 * implementation for Redis/Upstash - the call site does not change.
 */
interface Store {
  hit(key: string, windowMs: number, limit: number): Promise<{ allowed: boolean; retryAfterSec: number }>;
}

class MemoryStore implements Store {
  private buckets = new Map<string, number[]>();

  async hit(key: string, windowMs: number, limit: number) {
    const now = Date.now();
    const cutoff = now - windowMs;
    const hits = (this.buckets.get(key) ?? []).filter((t) => t > cutoff);

    if (hits.length >= limit) {
      const retryAfterSec = Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000));
      this.buckets.set(key, hits);
      return { allowed: false, retryAfterSec };
    }

    hits.push(now);
    this.buckets.set(key, hits);

    // Opportunistic cleanup so the map cannot grow without bound.
    if (this.buckets.size > 5000) {
      for (const [k, v] of this.buckets) {
        if (v.every((t) => t <= cutoff)) this.buckets.delete(k);
      }
    }
    return { allowed: true, retryAfterSec: 0 };
  }
}

const store: Store = new MemoryStore();

const LIMIT = Number(process.env.RATE_LIMIT_REQUESTS || 30);
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 60) * 1000;

/** Best-effort client identity. Replace with the session id once auth lands. */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anonymous";
  return ip;
}

export async function enforceRateLimit(req: Request, scope: string, limit = LIMIT) {
  if (process.env.RATE_LIMIT_DISABLED === "true") return;
  const { allowed, retryAfterSec } = await store.hit(`${scope}:${clientKey(req)}`, WINDOW_MS, limit);
  if (!allowed) {
    throw new AppError("rate_limited", `Too many requests. Try again in ${retryAfterSec}s.`, {
      status: 429,
      hint: `Limit is ${limit} requests per ${WINDOW_MS / 1000}s.`,
    });
  }
}
