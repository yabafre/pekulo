// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import "@pekulo/ui/reset.css";
import "@pekulo/ui/generated.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "Pekulo", template: "%s · Pekulo" },
  description:
    "Pekulo — pilote ton plan financier : épargne, projection de capital, portefeuille et hypothèses.",
  applicationName: "Pekulo",
  keywords: ["pekulo", "plan financier", "épargne", "projection", "portefeuille", "ETF", "PEA"],
  authors: [{ name: "Pekulo" }],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Pekulo",
    title: "Pekulo",
    description:
      "Pilote ton plan financier : épargne, projection de capital, portefeuille et hypothèses.",
  },
  twitter: {
    card: "summary",
    title: "Pekulo",
    description:
      "Pilote ton plan financier : épargne, projection de capital, portefeuille et hypothèses.",
  },
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-request nonce from proxy.ts — lets this hand-written inline theme
  // script run under the enforced CSP (story 11-7, AC-3). Next auto-nonces its
  // own bundled scripts; only this one needs the nonce set explicitly. The
  // dev-only react-grab Script below is an external unpkg src, covered by
  // script-src https://unpkg.com in dev — no nonce required.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('theme');
                if (!t || t === 'system') {
                  t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'pekulo-dark' : 'pekulo-light';
                } else if (t === 'dark') t = 'pekulo-dark';
                else if (t === 'light') t = 'pekulo-light';
                document.documentElement.setAttribute('data-theme', t);
              } catch (e) {}
            `,
          }}
        />
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
