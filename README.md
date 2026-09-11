# Cool-

A couple of self-contained HTML experiments. No build step, no dependencies — open the file and it runs.

## C10.1 — `c10-1.html`

A chat interface in the style of ChatGPT and Gemini, in white and light blue.

Open the file in any browser and start talking.

**Interface**
- Sidebar with chat history, search, rename-by-first-message and delete
- Streaming responses with a typing indicator and a blinking caret
- Markdown rendering — headings, lists, tables, quotes, links, and code blocks with syntax highlighting and a copy button
- Copy / regenerate / feedback actions on every reply
- Light and dark themes, full mobile layout, keyboard shortcuts (`Ctrl/⌘+K` search, `Ctrl/⌘+Shift+O` new chat, `Esc` to stop)
- Chats persist in `localStorage`

**Two ways to run it**

1. **Local core** (default) — a response engine built into the page itself. No network, no API key, works offline. It handles conversation, a knowledge base of science and tech topics, arithmetic, code snippets, writing prompts, and remembers details you mention within a chat. It's genuinely limited, and the interface says so.

2. **Connect a model** — Settings → *Connect a model*, then point it at any Anthropic Messages-API-compatible endpoint or an OpenAI-style `/chat/completions` URL with your own key. Same interface, a real language model underneath. The key is stored only in your browser's local storage and sent only to the endpoint you name. (Calling a provider directly from a browser requires CORS to be enabled on that endpoint.)

## The Last Candle — `horror.html`

A single-file horror game for mobile.
