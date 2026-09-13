import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { absoluteUrl, SITE, siteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "T10 — AI for Thinking, Coding & Creation",
    template: "%s — T10",
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    "T10",
    "T10 1.1",
    "AI platform",
    "AI chat",
    "AI reasoning",
    "AI coding assistant",
    "AI image creation",
    "large language model",
  ],
  authors: [{ name: SITE.name }],
  creator: SITE.name,
  publisher: SITE.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: "T10 — AI for Thinking, Coding & Creation",
    description: SITE.description,
    url: absoluteUrl("/"),
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "T10 — AI for Thinking, Coding & Creation",
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  category: "technology",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090b10" },
    { media: "(prefers-color-scheme: light)", color: "#fcfdff" },
  ],
};

/**
 * Applied before paint so a stored light-mode preference does not flash dark.
 * Dark is the default when nothing is stored.
 */
const THEME_BOOTSTRAP = `
(function(){
  try {
    var t = localStorage.getItem('t10:theme');
    document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

const ORG_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "T10",
  url: siteUrl(),
  description: SITE.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body className="min-h-dvh font-sans">
        <a href="#main" className="t10-skip">
          Skip to content
        </a>
        {children}
        <Script
          id="t10-org-jsonld"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }}
        />
      </body>
    </html>
  );
}
