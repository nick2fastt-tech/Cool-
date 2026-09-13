/**
 * Typed application errors.
 *
 * Every error that reaches the client is mapped to one of these codes with a
 * user-safe message. Upstream stack traces, API keys and provider payloads are
 * never forwarded to the browser.
 */

export type AppErrorCode =
  | "provider_not_configured"
  | "image_provider_not_configured"
  | "model_unavailable"
  | "invalid_request"
  | "rate_limited"
  | "unauthorized"
  | "upstream_error"
  | "timeout"
  | "network_error"
  | "internal_error";

export interface AppErrorShape {
  code: AppErrorCode;
  message: string;
  /** Optional operator hint, e.g. which env var to set. Safe to display. */
  hint?: string;
  /** Docs anchor the UI can deep-link to. */
  docs?: string;
  status: number;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly hint?: string;
  readonly docs?: string;

  constructor(code: AppErrorCode, message: string, opts: { status?: number; hint?: string; docs?: string } = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = opts.status ?? defaultStatus(code);
    this.hint = opts.hint;
    this.docs = opts.docs;
  }

  toShape(): AppErrorShape {
    return { code: this.code, message: this.message, hint: this.hint, docs: this.docs, status: this.status };
  }
}

function defaultStatus(code: AppErrorCode): number {
  switch (code) {
    case "invalid_request":
      return 400;
    case "unauthorized":
      return 401;
    case "rate_limited":
      return 429;
    case "model_unavailable":
      return 404;
    case "provider_not_configured":
    case "image_provider_not_configured":
      return 503;
    case "timeout":
      return 504;
    case "upstream_error":
    case "network_error":
      return 502;
    default:
      return 500;
  }
}

/** Converts any thrown value into a safe, client-facing error shape. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof DOMException && err.name === "AbortError") {
    return new AppError("timeout", "The request was cancelled or timed out.");
  }
  if (err instanceof Error && /fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN/i.test(err.message)) {
    return new AppError("network_error", "Could not reach the model provider. Check the network and try again.");
  }
  // Deliberately generic: never leak upstream internals to the browser.
  return new AppError("internal_error", "Something went wrong handling that request.");
}

/** Server-side logging that will not print credentials. */
export function logError(scope: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const safe = msg.replace(/(sk-|key-|Bearer\s+)[A-Za-z0-9._-]+/g, "$1[redacted]");
  console.error(`[t10:${scope}] ${safe}`);
}
