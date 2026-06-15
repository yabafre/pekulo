// apps/web/src/app/(auth)/layout.tsx
// The (auth) screens render outside the CapShell (which is what paints the dark
// surface on the dashboard), so without this the <body> default (white) showed
// through behind the form. Paint the theme background full-bleed here — the
// `--background` CSS var is theme-aware (#000 dark / #fff light), so this is
// correct in both themes (story 8-1 visual refonte).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100dvh", background: "var(--background)" }}>{children}</div>;
}
