import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Wordmark className="text-2xl" />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-muted">
        That page does not exist. It may have moved, or the link may be incomplete.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-accent px-5 py-2.5 text-[14px] font-medium text-accent-ink transition hover:brightness-110"
        >
          Go home
        </Link>
        <Link
          href="/chat"
          className="rounded-xl border border-line-strong px-5 py-2.5 text-[14px] font-medium text-ink transition hover:bg-raised"
        >
          Open T10
        </Link>
      </div>
    </main>
  );
}
