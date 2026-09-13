import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/site/PageShell";
import { IconBrain, IconCode, IconImage, IconSparkle } from "@/components/ui/icons";
import { listPublicModels } from "@/lib/models/registry";
import { absoluteUrl, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "T10 — AI for Thinking, Coding & Creation",
  description: SITE.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: "T10 — AI for Thinking, Coding & Creation",
    description: SITE.description,
    url: absoluteUrl("/"),
    type: "website",
  },
};

const FEATURES = [
  {
    icon: <IconBrain />,
    title: "Thinking",
    body: "Solve complex problems with advanced reasoning. T10 1.1 works through multi-step questions before it answers.",
  },
  {
    icon: <IconCode />,
    title: "Coding",
    body: "Build, debug and understand software with T10 1.1. Formatted, highlighted, copyable code in every major language.",
  },
  {
    icon: <IconImage />,
    title: "Image Creation",
    body: "Turn ideas into generated visuals. Describe what you want and T10 1.1 creates it in the conversation.",
  },
  {
    icon: <IconSparkle />,
    title: "T10 1.1",
    body: "Our newest model, with advanced capabilities across reasoning, engineering and creative work.",
  },
];

export default function HomePage() {
  const models = listPublicModels();
  const flagship = models.find((m) => m.id === "t10-1.1");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "T10",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: SITE.description,
    url: absoluteUrl("/"),
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 h-[32rem] opacity-70"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 40%, rgb(var(--t10-accent) / 0.14), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-shell px-5 pb-20 pt-20 sm:px-8 sm:pb-28 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-[12.5px] font-medium text-ink-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />
              T10 1.1 is available now
            </p>

            <h1 className="mt-7 text-[clamp(2.75rem,8vw,4.75rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
              Think. Create. Build.
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-[clamp(1rem,2.2vw,1.15rem)] leading-relaxed text-ink-soft">
              Meet T10 — an AI platform built for reasoning, coding, creativity, and more.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/chat"
                className="rounded-xl bg-accent px-6 py-3.5 text-[15px] font-semibold text-accent-ink transition hover:brightness-110 active:scale-[0.98]"
              >
                Try T10
              </Link>
              <Link
                href="/models"
                className="rounded-xl border border-line-strong bg-surface px-6 py-3.5 text-[15px] font-semibold text-ink transition hover:border-accent/45 hover:bg-raised active:scale-[0.98]"
              >
                Explore T10 1.1
              </Link>
            </div>
          </div>

          {/* Flagship model card */}
          {flagship && (
            <div className="mx-auto mt-16 max-w-2xl sm:mt-20">
              <div className="rounded-2xl border border-line-strong bg-surface p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-[22px] font-semibold tracking-tight text-ink">{flagship.name}</h2>
                  <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-accent">
                    New
                  </span>
                </div>
                <p className="mt-2.5 text-[15px] leading-relaxed text-ink-soft">{flagship.description}</p>

                <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">Reasoning</dt>
                    <dd className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-[14px] text-ink">Thinking</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-ok">Available</span>
                    </dd>
                    <dd className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-[14px] text-ink-muted">Extended Thinking</span>
                      <span className="rounded border border-line-strong px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                        Coming Soon
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">Capabilities</dt>
                    <dd className="mt-1.5 flex flex-wrap gap-1.5">
                      {["Reasoning", "Coding", "Image creation", "Complex tasks"].map((c) => (
                        <span
                          key={c}
                          className="rounded-md border border-line bg-raised px-2 py-1 text-[11.5px] text-ink-soft"
                        >
                          {c}
                        </span>
                      ))}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* -------------------------------------------------------- features */}
      <section className="border-t border-line py-20 sm:py-24" aria-labelledby="capabilities-heading">
        <div className="mx-auto max-w-shell px-5 sm:px-8">
          <h2 id="capabilities-heading" className="text-[clamp(1.6rem,3.4vw,2.2rem)] font-semibold tracking-[-0.03em]">
            Built for serious work
          </h2>
          <p className="mt-3 max-w-xl text-[15.5px] leading-relaxed text-ink-soft">
            One interface for reasoning through hard problems, writing software and creating visuals.
          </p>

          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {FEATURES.map((f) => (
              <article key={f.title} className="bg-canvas p-6 transition-colors hover:bg-surface sm:p-7">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-raised text-accent [&>svg]:h-[18px] [&>svg]:w-[18px]">
                  {f.icon}
                </span>
                <h3 className="mt-4 text-[17px] font-semibold tracking-tight text-ink">{f.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- cta */}
      <section className="border-t border-line py-20 sm:py-24">
        <div className="mx-auto max-w-shell px-5 text-center sm:px-8">
          <h2 className="text-[clamp(1.6rem,3.4vw,2.2rem)] font-semibold tracking-[-0.03em]">
            Start a conversation with T10
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15.5px] leading-relaxed text-ink-soft">
            T10 1.1 is selected by default, with Thinking enabled.
          </p>
          <Link
            href="/chat"
            className="mt-8 inline-block rounded-xl bg-accent px-6 py-3.5 text-[15px] font-semibold text-accent-ink transition hover:brightness-110 active:scale-[0.98]"
          >
            Try T10
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
