import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/site/PageShell";
import { absoluteUrl } from "@/lib/site";

const DESCRIPTION =
  "T10 documentation — configure model providers, enable image creation, set the public domain, and understand how conversations are stored.";

export const metadata: Metadata = {
  title: "Documentation",
  description: DESCRIPTION,
  alternates: { canonical: "/docs" },
  openGraph: { title: "T10 Documentation", description: DESCRIPTION, url: absoluteUrl("/docs"), type: "article" },
};

const SECTIONS = [
  { id: "quick-start", label: "Quick start" },
  { id: "connect-a-model", label: "Connect a model" },
  { id: "image-generation", label: "Image generation" },
  { id: "adding-models", label: "Adding new models" },
  { id: "persistence", label: "Chat history" },
  { id: "deployment", label: "Deployment & domain" },
  { id: "limits", label: "Current limitations" },
];

function Code({ children }: { children: string }) {
  return (
    <pre className="my-4 overflow-x-auto rounded-xl border border-line bg-surface p-4 text-[12.5px] leading-relaxed">
      <code className="font-mono text-ink-soft">{children}</code>
    </pre>
  );
}

export default function DocsPage() {
  return (
    <PageShell>
      <div className="mx-auto flex max-w-shell gap-12 px-5 pb-20 pt-16 sm:px-8 sm:pt-20">
        <nav aria-label="On this page" className="sticky top-24 hidden h-fit w-52 shrink-0 lg:block">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">On this page</p>
          <ul className="space-y-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block rounded-lg px-2.5 py-1.5 text-[13.5px] text-ink-muted transition hover:bg-raised hover:text-ink"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="min-w-0 flex-1">
          <h1 className="text-[clamp(2.1rem,5.5vw,3rem)] font-semibold tracking-[-0.04em]">Documentation</h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-soft">{DESCRIPTION}</p>

          <div className="t10-prose mt-12 space-y-5">
            <section id="quick-start" className="scroll-mt-28">
              <h2 className="!mt-0 text-[1.4rem] font-semibold tracking-tight">Quick start</h2>
              <p>Install dependencies and start the development server:</p>
              <Code>{`npm install
cp .env.example .env.local
npm run dev`}</Code>
              <p>
                The site runs at <code>http://localhost:3000</code>. The landing, Models, About and Documentation pages
                work immediately. Chat requires a configured provider — see below.
              </p>
            </section>

            <section id="connect-a-model" className="scroll-mt-28">
              <h2 className="!mt-12 text-[1.4rem] font-semibold tracking-tight">Connect a model</h2>
              <p>
                Each T10 model is bound to a provider adapter and an upstream model id. Nothing is hard-coded: set the
                provider, the upstream id, and that provider&apos;s credential.
              </p>
              <p>
                <strong>Anthropic Messages API</strong> (the default binding):
              </p>
              <Code>{`ANTHROPIC_API_KEY=your-key
T10_11_PROVIDER=anthropic
T10_11_UPSTREAM_MODEL=<upstream model id>
T10_V1_PROVIDER=anthropic
T10_V1_UPSTREAM_MODEL=<upstream model id>`}</Code>
              <p>
                <strong>Any OpenAI-compatible endpoint</strong> — OpenAI, Azure, Together, Groq, vLLM, Ollama, or your
                own T10 inference host:
              </p>
              <Code>{`OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://your-host/v1
T10_11_PROVIDER=openai
T10_11_UPSTREAM_MODEL=<upstream model id>`}</Code>
              <p>
                Until a provider is configured the chat returns a clear configuration error naming the missing variable.
                It never substitutes a fabricated response. To explore the interface before wiring a provider, set{" "}
                <code>T10_DEMO_MODE=true</code> — replies are then produced by a local demo adapter and every turn is
                labelled <strong>Demo mode</strong> in the transcript.
              </p>
              <p>
                Check what the server sees at <code>/api/health</code>. It reports which providers are configured
                without ever printing credential values.
              </p>
            </section>

            <section id="image-generation" className="scroll-mt-28">
              <h2 className="!mt-12 text-[1.4rem] font-semibold tracking-tight">Image generation</h2>
              <p>
                Image requests are detected from the message and routed to <code>/api/images</code>, which calls the
                configured image provider. Two adapters ship today:
              </p>
              <Code>{`# OpenAI Images
IMAGE_PROVIDER=openai
OPENAI_API_KEY=your-key
IMAGE_MODEL=gpt-image-1

# or Stability AI
IMAGE_PROVIDER=stability
STABILITY_API_KEY=your-key
IMAGE_MODEL=core`}</Code>
              <p>
                With no image provider configured, an image request returns a configuration error explaining which
                variable to set. T10 never substitutes a stock or placeholder image for a generated one.
              </p>
            </section>

            <section id="adding-models" className="scroll-mt-28">
              <h2 className="!mt-12 text-[1.4rem] font-semibold tracking-tight">Adding new models</h2>
              <p>
                Models are data. Add an entry to <code>lib/models/registry.ts</code> and it appears in the selector, on
                the Models page and in the API — no component changes required.
              </p>
              <Code>{`{
  id: "t10-1.2",
  name: "T10 1.2",
  tagline: "...",
  status: "available",
  capabilities: { chat: true, coding: true, images: true, vision: false, files: false, streaming: true },
  reasoningModes: [
    { id: "thinking", label: "Thinking", status: "available", budget: "standard" },
    { id: "extended-thinking", label: "Extended Thinking", status: "coming-soon", budget: "extended" },
  ],
  binding: { provider: "anthropic", upstreamEnvVar: "T10_12_UPSTREAM_MODEL" },
  ...
}`}</Code>
              <p>
                Reasoning modes are gated by their <code>status</code>. To release Extended Thinking, change its status
                to <code>&quot;available&quot;</code> — the selector enables it, and the API stops rejecting it. The
                server independently validates the mode, so a client cannot activate an unreleased one.
              </p>
            </section>

            <section id="persistence" className="scroll-mt-28">
              <h2 className="!mt-12 text-[1.4rem] font-semibold tracking-tight">Chat history</h2>
              <p>
                Conversations implement a <code>ConversationStore</code> interface. The shipped implementation writes to
                browser storage, so history works with no database and no account.
              </p>
              <p>
                To move history server-side, set <code>DATABASE_URL</code> and <code>AUTH_SECRET</code>, implement a
                store against your database with the same interface, and swap it in <code>ChatShell</code>. The route at{" "}
                <code>/api/conversations</code> is the account-backed half and reports honestly that it is not enabled
                until both variables are present.
              </p>
            </section>

            <section id="deployment" className="scroll-mt-28">
              <h2 className="!mt-12 text-[1.4rem] font-semibold tracking-tight">Deployment &amp; domain</h2>
              <p>Build and run anywhere Node is available:</p>
              <Code>{`npm run build
npm start`}</Code>
              <p>
                No domain is baked into the source. Set <code>NEXT_PUBLIC_SITE_URL</code> to your production origin and
                canonical URLs, Open Graph tags, <code>robots.txt</code> and <code>sitemap.xml</code> all follow it:
              </p>
              <Code>{`NEXT_PUBLIC_SITE_URL=https://your-domain`}</Code>
              <p>
                On Vercel the deployment URL is detected automatically if the variable is unset. The landing, Models,
                About and Documentation pages are indexable; <code>/chat</code> and <code>/api</code> are excluded in
                robots rules, route metadata and response headers.
              </p>
            </section>

            <section id="limits" className="scroll-mt-28">
              <h2 className="!mt-12 text-[1.4rem] font-semibold tracking-tight">Current limitations</h2>
              <ul>
                <li>
                  <strong>Extended Thinking</strong> is not released. It is shown as Coming Soon and cannot be selected.
                </li>
                <li>
                  <strong>File attachments</strong> are not implemented. The composer button states that clearly rather
                  than failing silently.
                </li>
                <li>
                  <strong>Code execution, project generation and website preview</strong> are not implemented. Code is
                  rendered, highlighted, copyable and downloadable as single files.
                </li>
                <li>
                  <strong>Accounts</strong> are not implemented. History is per-browser until a database and auth are
                  configured.
                </li>
                <li>
                  <strong>Rate limiting</strong> is in-memory and per-instance. Swap the store for Redis before running
                  multiple instances.
                </li>
              </ul>
            </section>
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link
              href="/chat"
              className="rounded-xl bg-accent px-5 py-3 text-[14.5px] font-semibold text-accent-ink transition hover:brightness-110"
            >
              Try T10
            </Link>
            <Link
              href="/models"
              className="rounded-xl border border-line-strong px-5 py-3 text-[14.5px] font-semibold text-ink transition hover:bg-raised"
            >
              View models
            </Link>
          </div>
        </article>
      </div>
    </PageShell>
  );
}
