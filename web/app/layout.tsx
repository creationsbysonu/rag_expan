import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "सरकार · Record Index — Nepal's public record, answered",
    template: "%s · सरकार Record Index",
  },
  description:
    "A bilingual retrieval system over Nepal's government notices and publications. Every answer cites the passages it came from.",
  keywords: [
    "Nepal government",
    "नेपाल सरकार",
    "gazette",
    "RAG",
    "retrieval",
    "ministry notices",
    "public records",
  ],
  openGraph: {
    title: "सरकार · Record Index",
    description:
      "Ask Nepal's public administrative record. Grounded, cited, bilingual answers.",
    url: siteUrl,
    siteName: "सरकार Record Index",
    locale: "en_NP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "सरकार · Record Index",
    description: "Grounded, cited answers over Nepal's public record.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#070908",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+Devanagari:wght@400;500;600&display=swap"
        />
      </head>
      <body className="min-h-screen bg-ink-950 antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[4px] focus:bg-bone-50 focus:px-4 focus:py-2 focus:text-ink-950"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#131814",
              border: "1px solid rgba(236,231,219,0.12)",
              color: "#ece7db",
              borderRadius: "5px",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}
