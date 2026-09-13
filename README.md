# Cool-

## T10

An AI platform with model selection (T10 V1 / T10 1.1), streaming chat, coding and image creation. Two builds:

**`t10.html`** — the whole interface in one file. Open it in any browser, no install, no server. Connect your own API key in Settings for real responses, or switch on the local demo to explore the interface. Keys stay in your browser.

**`t10/`** — the full platform: Next.js + TypeScript, a secure server-side API layer, provider abstraction, and indexable public pages (landing, Models, About, Docs) with SEO, robots and sitemap. Use this to deploy publicly. See [`t10/README.md`](t10/README.md).

```bash
cd t10 && npm install && npm run dev
```

---

## Static HTML projects

Self-contained single files. No build step, no dependencies — open one and it runs.

## C10.1

A chat model with a clean interface, in white and light blue.

| File | What it is |
| --- | --- |
| `index.html` | Landing page — intro, capabilities, leaderboard, **Try it out** |
| `c10-1.html` | The chat app itself |

Start at `index.html`, or jump straight into `c10-1.html`.

### The chat app

- Sidebar with history, search, auto-titling and delete
- Word-by-word streaming with a thinking state and live caret
- Markdown rendering — headings, lists, tables, quotes, and code blocks with syntax highlighting and one-click copy
- Copy / regenerate / feedback on every reply
- Light and dark themes (shared with the landing page), full mobile layout
- Shortcuts: `Ctrl/⌘+K` search, `Ctrl/⌘+Shift+O` new chat, `Esc` to stop
- Conversations persist in `localStorage`

### Two ways to run it

1. **Local core** (default) — the response engine built into the page. No network, no API key, works offline. Handles conversation, a knowledge base of science and tech topics, arithmetic, code snippets, writing prompts, and remembers details you mention within a chat.

2. **Connect a model** — Settings → *Connect a model*, then point it at any Anthropic Messages-API-compatible endpoint or an OpenAI-style `/chat/completions` URL with your own key. Same interface, a larger model underneath. The key is stored only in your browser and sent only to the endpoint you name. (Browser-direct calls need CORS enabled on that endpoint.)

### Leaderboard data

The board on the landing page ships with **placeholder figures** so the layout is visible — they are not measured evaluation results. Replace them with your own numbers by editing the `LEADERBOARD` object near the top of the script in `index.html`; each entry is `{ name, org, score, colour }`, and `me: true` highlights a row as yours.

## The Last Candle — `horror.html`

A single-file horror game for mobile.
