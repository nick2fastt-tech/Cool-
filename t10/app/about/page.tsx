import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/site/PageShell";
import { absoluteUrl } from "@/lib/site";

const DESCRIPTION =
  "About T10 — an AI platform for reasoning, coding and creation, built around a model-agnostic architecture.";

export const metadata: Metadata = {
  title: "About",
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: { title: "About T10", description: DESCRIPTION, url: absoluteUrl("/about"), type: "website" },
};

export default function AboutPage() {
  return (
    <PageShell>
      <article className="mx-auto max-w-3xl px-5 pb-20 pt-16 sm:px-8 sm:pt-20">
        <h1 className="text-[clamp(2.1rem,5.5vw,3rem)] font-semibold tracking-[-0.04em]">About T10</h1>

        <div className="t10-prose mt-8 space-y-6">
          <p className="text-[17px] leading-relaxed text-ink-soft">
            T10 is an AI platform built around a simple idea: the interface you think in should not get in the way of
            the work. One place to reason through hard problems, write and debug software, and create images.
          </p>

          <h2 className="!mt-12 text-[1.35rem] font-semibold tracking-tight">The models</h2>
          <p>
            <strong>T10 V1</strong> is our general-purpose model — fast, capable, and suited to everyday conversation,
            writing and explanation.
          </p>
          <p>
            <strong>T10 1.1</strong> is our newest model. It adds advanced reasoning, stronger software engineering, and
            image creation. It handles complex instructions and multi-step problems, and it is the default model in the
            chat application.
          </p>

          <h2 className="!mt-12 text-[1.35rem] font-semibold tracking-tight">Reasoning</h2>
          <p>
            T10 1.1 supports <strong>Thinking</strong>, which is available now. It works through a problem before
            committing to an answer, which meaningfully improves results on multi-step questions.
          </p>
          <p>
            <strong>Extended Thinking</strong> — longer deliberation for the hardest problems — is coming soon. It is
            visible in the interface but not selectable, because it is not ready. We would rather show you the roadmap
            than pretend a capability exists.
          </p>

          <h2 className="!mt-12 text-[1.35rem] font-semibold tracking-tight">How it is built</h2>
          <p>
            T10 is model-agnostic by design. Models are described as configuration — capabilities, reasoning modes,
            limits and provider bindings — so a new model is a registry entry rather than a rewrite. Provider adapters
            sit behind a single interface, which means the platform can be pointed at different inference backends
            without the interface changing.
          </p>
          <p>
            Credentials live in server-side environment variables and are never exposed to the browser. Every model
            request is validated against the registry before it reaches a provider.
          </p>

          <h2 className="!mt-12 text-[1.35rem] font-semibold tracking-tight">Privacy</h2>
          <p>
            Conversations are stored in your browser. There is no account required, and chat history is not indexed by
            search engines. The chat application is excluded from crawling at the robots and header level.
          </p>
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/chat"
            className="rounded-xl bg-accent px-5 py-3 text-[14.5px] font-semibold text-accent-ink transition hover:brightness-110"
          >
            Try T10
          </Link>
          <Link
            href="/docs"
            className="rounded-xl border border-line-strong px-5 py-3 text-[14.5px] font-semibold text-ink transition hover:bg-raised"
          >
            Read the documentation
          </Link>
        </div>
      </article>
    </PageShell>
  );
}
