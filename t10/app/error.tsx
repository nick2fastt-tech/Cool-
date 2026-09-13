"use client";

import { useEffect } from "react";
import Link from "next/link";

/** Route-level error boundary. Shows a safe message, never a stack trace. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[t10:boundary]", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-muted">
        T10 hit an unexpected error rendering this page. Your saved conversations are unaffected.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-accent px-5 py-2.5 text-[14px] font-medium text-accent-ink transition hover:brightness-110"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl border border-line-strong px-5 py-2.5 text-[14px] font-medium text-ink transition hover:bg-raised"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
