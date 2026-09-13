import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/models", label: "Models" },
  { href: "/about", label: "About" },
  { href: "/docs", label: "Documentation" },
];

/**
 * Public site header. A server component - it ships no client JavaScript,
 * which keeps the SEO pages light.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-shell items-center gap-2 px-5 sm:px-8">
        <Link href="/" className="rounded-lg px-1 py-1 text-[19px] transition hover:opacity-80" aria-label="T10 home">
          <Wordmark />
        </Link>

        <nav aria-label="Main" className="ml-6 hidden items-center gap-1 md:flex">
          {LINKS.slice(1).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-[14px] font-medium text-ink-muted transition hover:bg-raised hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/docs"
            className="hidden rounded-lg px-3 py-2 text-[14px] font-medium text-ink-muted transition hover:bg-raised hover:text-ink md:hidden"
          >
            Docs
          </Link>
          <Link
            href="/chat"
            className="rounded-xl bg-accent px-4 py-2.5 text-[14px] font-semibold text-accent-ink transition hover:brightness-110 active:scale-[0.98]"
          >
            Try T10
          </Link>
        </div>
      </div>

      {/* Mobile nav row */}
      <nav aria-label="Main" className="flex gap-1 overflow-x-auto border-t border-line/70 px-4 py-1.5 md:hidden">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink-muted transition hover:bg-raised hover:text-ink"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
