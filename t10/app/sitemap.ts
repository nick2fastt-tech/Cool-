import type { MetadataRoute } from "next";
import { absoluteUrl, PUBLIC_ROUTES } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const priority: Record<string, number> = { "/": 1, "/models": 0.9, "/docs": 0.7, "/about": 0.6 };

  return PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route),
    lastModified: now,
    changeFrequency: route === "/" ? ("weekly" as const) : ("monthly" as const),
    priority: priority[route] ?? 0.5,
  }));
}
