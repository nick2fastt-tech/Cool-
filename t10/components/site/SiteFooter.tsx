import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-shell flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center">
        <div>
          <Wordmark className="text-[17px]" />
          <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-muted">
            An AI platform for reasoning, coding and creation.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 md:ml-auto">
          {[
            { href: "/", label: "Home" },
            { href: "/chat", label: "Chat" },
            { href: "/models", label: "Models" },
            { href: "/about", label: "About" },
            { href: "/docs", label: "Documentation" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="text-[13.5px] text-ink-muted transition hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
