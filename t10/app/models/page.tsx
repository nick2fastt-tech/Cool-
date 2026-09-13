import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/site/PageShell";
import { listPublicModels } from "@/lib/models/registry";
import type { PublicModel } from "@/lib/models/types";
import { absoluteUrl } from "@/lib/site";
import { clsx } from "@/lib/utils";

const DESCRIPTION =
  "Compare T10 models. T10 V1 is our general-purpose model; T10 1.1 adds advanced reasoning, coding and image creation.";

export const metadata: Metadata = {
  title: "Models",
  description: DESCRIPTION,
  alternates: { canonical: "/models" },
  openGraph: { title: "T10 Models", description: DESCRIPTION, url: absoluteUrl("/models"), type: "website" },
};

export default function ModelsPage() {
  const models = listPublicModels();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "T10 models",
    itemListElement: models.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: { "@type": "SoftwareApplication", name: m.name, description: m.description, applicationCategory: "AI model" },
    })),
  };

  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="mx-auto max-w-shell px-5 pb-8 pt-16 sm:px-8 sm:pt-20">
        <h1 className="text-[clamp(2.1rem,5.5vw,3rem)] font-semibold tracking-[-0.04em]">Models</h1>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-soft">{DESCRIPTION}</p>
      </section>

      <section className="mx-auto max-w-shell px-5 pb-20 sm:px-8 sm:pb-24">
        <div className="grid gap-5 lg:grid-cols-2">
          {models.map((m) => (
            <ModelCard key={m.id} model={m} />
          ))}
        </div>
      </section>
    </PageShell>
  );
}

function ModelCard({ model }: { model: PublicModel }) {
  const flagship = model.recommended;

  return (
    <article
      className={clsx(
        "flex flex-col rounded-2xl border p-6 sm:p-7",
        flagship ? "border-accent/40 bg-surface shadow-[0_0_0_1px_rgb(var(--t10-accent)/0.12)]" : "border-line bg-surface",
      )}
    >
      <header className="flex flex-wrap items-center gap-2.5">
        <h2 className="text-[22px] font-semibold tracking-tight text-ink">{model.name}</h2>
        {model.isNew && (
          <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-accent">
            New
          </span>
        )}
        {flagship && (
          <span className="rounded-md border border-line-strong px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
            Recommended
          </span>
        )}
      </header>

      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{model.description}</p>

      <dl className="mt-6 space-y-5 border-t border-line pt-5">
        <div className="flex items-baseline gap-3">
          <dt className="w-28 shrink-0 text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">Status</dt>
          <dd className="text-[14px] font-medium text-ok">
            {model.status === "available" ? "Available" : model.status === "coming-soon" ? "Coming Soon" : "Deprecated"}
          </dd>
        </div>

        <div className="flex items-baseline gap-3">
          <dt className="w-28 shrink-0 text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
            Designed for
          </dt>
          <dd className="flex flex-wrap gap-1.5">
            {capabilityList(model).map((c) => (
              <span key={c} className="rounded-md border border-line bg-raised px-2 py-1 text-[12px] text-ink-soft">
                {c}
              </span>
            ))}
          </dd>
        </div>

        {model.reasoningModes.length > 0 && (
          <div className="flex items-baseline gap-3">
            <dt className="w-28 shrink-0 text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
              Reasoning
            </dt>
            <dd className="space-y-1.5">
              {model.reasoningModes.map((mode) => (
                <div key={mode.id} className="flex flex-wrap items-center gap-2">
                  <span className={clsx("text-[14px]", mode.status === "available" ? "text-ink" : "text-ink-muted")}>
                    {mode.label}
                  </span>
                  {mode.status === "available" ? (
                    <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ok">Available</span>
                  ) : (
                    <span className="rounded border border-line-strong px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                      Coming Soon
                    </span>
                  )}
                </div>
              ))}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-auto pt-7">
        <Link
          href="/chat"
          className={clsx(
            "inline-block rounded-xl px-5 py-2.5 text-[14px] font-semibold transition active:scale-[0.98]",
            flagship
              ? "bg-accent text-accent-ink hover:brightness-110"
              : "border border-line-strong text-ink hover:bg-raised",
          )}
        >
          Chat with {model.name}
        </Link>
      </div>
    </article>
  );
}

function capabilityList(model: PublicModel): string[] {
  const out: string[] = [];
  if (model.reasoningModes.length) out.push("Reasoning");
  if (model.capabilities.coding) out.push("Coding");
  if (model.capabilities.images) out.push("Image creation");
  if (model.capabilities.vision) out.push("Vision");
  out.push(model.recommended ? "Complex tasks" : "General conversation");
  return out;
}
