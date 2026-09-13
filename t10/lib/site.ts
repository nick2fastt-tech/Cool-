/**
 * Site-level configuration.
 *
 * The public origin is read from NEXT_PUBLIC_SITE_URL so no domain is baked
 * into the source. Falls back to the Vercel-provided URL, then localhost.
 */
export const SITE = {
  name: "T10",
  tagline: "Think. Create. Build.",
  description:
    "T10 is an AI platform built for reasoning, coding, creativity and more. Chat with T10 V1 and T10 1.1 - our newest model for advanced reasoning, coding and image creation.",
  locale: "en",
} as const;

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export function absoluteUrl(path = "/"): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Public pages that should be crawled and listed in the sitemap. */
export const PUBLIC_ROUTES = ["/", "/models", "/about", "/docs"] as const;

/** Routes that must never be indexed. */
export const PRIVATE_ROUTES = ["/chat", "/api"] as const;
