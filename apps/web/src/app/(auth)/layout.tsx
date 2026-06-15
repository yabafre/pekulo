// apps/web/src/app/(auth)/layout.tsx
// The (auth) screens render outside the CapShell (which paints the dark surface
// on the dashboard). AuthSplit provides the full-bleed theme background + the
// split-screen composition (form left, ambient generative pattern right on
// ≥lg). Without it the <body> default (white) showed through (story 8-1 refonte).
import { AuthSplit } from "@/components/auth/auth-split";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthSplit>{children}</AuthSplit>;
}
