// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
import "@pekulo/ui/reset.css";
import "@pekulo/ui/generated.css";
import { Providers } from "@/components/providers";
import { ReactGrabDev } from "@/components/react-grab-dev";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";

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
  // Per-request nonce from proxy.ts (prod only — dev CSP is nonce-free) so this
  // hand-written inline theme script runs under the enforced CSP (story 11-7,
  // AC-3). Next auto-nonces its own bundled scripts; only this one needs it set.
  // React Grab now loads from the pinned npm package via <ReactGrabDev> (dev
  // only, bundled from 'self') instead of an unversioned unpkg CDN <Script>.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  // SSR locale from the NEXT_LOCALE cookie (i18n/request.ts) — drives <html lang>
  // so the first paint is already in the chosen language (AC-5, no FR flash).
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
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
      </head>
      <body>
        <ReactGrabDev />
        {/* next-intl v4: provider auto-inherits locale + messages from
            i18n/request.ts when rendered in a Server Component — no props. */}
        <NextIntlClientProvider>
          <NuqsAdapter>
            <Providers>{children}</Providers>
          </NuqsAdapter>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
