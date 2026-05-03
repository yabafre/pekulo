import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "Pekulo",
    template: "%s · Pekulo",
  },
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
    <html lang="fr" className="antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('theme');
                if (!t || t === 'system') {
                  t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                if (t === 'dark') document.documentElement.classList.add('dark');
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
      <body className="min-h-screen bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
