// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script
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
        {process.env.NEXT_PUBLIC_REACT_GRAB === "1" && (
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
