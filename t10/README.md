# T10

An AI platform for reasoning, coding and creation. Next.js App Router, TypeScript, Tailwind.

Two models ship in the registry: **T10 V1** (general purpose) and **T10 1.1** (advanced reasoning, coding and image creation, with **Thinking** available and **Extended Thinking** marked Coming Soon).

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

The landing, Models, About and Documentation pages work immediately. Chat needs a provider — see below.

## Project structure

```
app/
  layout.tsx            Root layout, SEO metadata, theme bootstrap
  page.tsx              Landing page (server component)
  chat/page.tsx         Chat application (noindex)
  models/  about/  docs/  Public, indexable pages
  error.tsx  not-found.tsx  Error boundary + 404
  robots.ts  sitemap.ts     Generated from NEXT_PUBLIC_SITE_URL
  api/
    chat/route.ts        SSE streaming, validation, rate limit
    images/route.ts      Image generation
    models/route.ts      Public model catalogue
    health/route.ts      Operator config view (no secrets)
    conversations/route.ts  Account-backed history (needs DB + auth)
components/
  brand/Wordmark.tsx
  chat/  ModelSelector, ChatComposer, MessageBubble, CodeBlock,
         ImageResult, ChatSidebar, ThinkingIndicator, SettingsPanel,
         EmptyState, ChatShell
  site/  SiteHeader, SiteFooter, PageShell
  ui/    Toast, icons
lib/
  models/     registry.ts (add models here), types.ts
  providers/  anthropic.ts, openai.ts, demo.ts, prompts.ts, index.ts
  images/     openai.ts, stability.ts, index.ts
  storage/    types.ts (ConversationStore), local.ts
  chat/       client.ts (SSE consumer), intent.ts (coding/image routing)
  errors.ts  ratelimit.ts  site.ts  utils.ts
```

## Environment

See `.env.example`. Nothing is required to run the public pages.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Production origin. Drives canonical URLs, OG tags, robots, sitemap. |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Provider credentials (server-side only). |
| `T10_V1_PROVIDER`, `T10_V1_UPSTREAM_MODEL` | Binding for T10 V1. |
| `T10_11_PROVIDER`, `T10_11_UPSTREAM_MODEL` | Binding for T10 1.1. |
| `IMAGE_PROVIDER`, `IMAGE_MODEL`, `STABILITY_API_KEY` | Image generation. |
| `DATABASE_URL`, `AUTH_SECRET` | Enable account-backed history. |
| `RATE_LIMIT_*`, `REQUEST_TIMEOUT_MS` | Limits and timeouts. |
| `T10_DEMO_MODE` | Local demo adapter — **not** a T10 model; labelled in the UI. |

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm start          # serve the production build
npm run typecheck  # tsc --noEmit
```

## Adding a model

Add an entry to `lib/models/registry.ts`. It appears in the selector, on the Models page and in `/api/models` with no component changes. Reasoning modes are gated on `status`; the server re-validates every request against the registry, so a client cannot select an unreleased mode.

## Security

- Credentials are server-side only and never reach the browser.
- Client-supplied model ids are validated against the registry.
- Request bodies are schema-validated (zod).
- Model output is rendered through `react-markdown` (React tree, not `innerHTML`).
- Upstream error bodies are logged with credentials redacted and never forwarded to the client.
- `/chat` and `/api` are excluded from indexing in robots rules, route metadata and response headers.

## Known limitations

Extended Thinking, file attachments, code execution, project generation, website preview and accounts are not implemented. The UI says so rather than pretending. See `/docs#limits`.
