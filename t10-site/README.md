# T10 — static site

Three files. Upload them to any static host and you have a live T10 site.

```
index.html    the whole site: landing, chat, models, about, documentation
robots.txt    crawl rules — chat is disallowed
sitemap.xml   public pages
```

## Deploy

1. Replace `example.com` with your domain in `robots.txt` and `sitemap.xml`.
2. Upload all three files to the root of your host.

Works on GitHub Pages, Netlify, Cloudflare Pages, Vercel static, S3 + CloudFront, or any web server. No build step, no Node, no dependencies.

You can also just open `index.html` from disk — everything works offline, including image creation.

## What works with no configuration

- Every page: landing, Models, About, Documentation
- Image creation, via the on-device renderer
- Chat history: search, rename, delete, saved in the browser
- Dark and light themes

Chat replies need either your own API key (Settings → Model provider) or the local demo toggle. Without one, T10 says what is missing instead of inventing a reply.

## SEO note

Pages are hash routes (`#/models`) and metadata updates per route, but hash fragments are not distinct URLs to a crawler. For full per-page indexing use the platform build in `../t10`, which serves real paths with per-route metadata, Open Graph tags, JSON-LD and a generated sitemap.
