import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Slim transpilePackages to match tamagui/starter-free reference — `tamagui`,
  // `@tamagui/core`, `@tamagui/config` ship pre-built ESM (`dist/esm/index.mjs`
  // with proper `exports.browser` / `exports.import` map per their package.json)
  // and are consumed natively by Turbopack. Adding them to transpilePackages
  // forces Turbopack to traverse their entire source tree on cold start, which
  // was the bulk of finding 5/6's measured `next-server` 269% CPU / 5 GB RAM.
  // Only `@tamagui/next-theme` (uses 'use client' + JSX) and `react-native-web`
  // (RN-Web ships RN-flavoured ESM that needs source-level rewriting) remain.
  transpilePackages: ["@tamagui/next-theme", "react-native-web"],
  // Source-of-truth for type-checking is the CI `typecheck` job (turbo
  // `tsc --noEmit` per workspace). Next.js's build-time TS check is
  // redundant and on Vercel walks `transpilePackages` deps' transitive
  // `.ts` sources hoisted to the root `node_modules` by Yarn 4.5
  // (Bun's local hoisting keeps them inside `packages/ui/node_modules/`,
  // hidden from Next's check). Notably trips on
  // `@tamagui/element/src/types.ts`'s `import type { View } from
  // 'react-native'` because apps/web aliases react-native → react-native-web
  // at runtime via Turbopack but does not declare `@types/react-native`.
  // The CI `typecheck` job runs against `apps/web/tsconfig.json` (with
  // `exclude: ["node_modules"]`) and catches everything we ship.
  typescript: { ignoreBuildErrors: true },
  // Dev-only: allow cloudflared quick tunnels + named tunnels to reach the
  // /_next/* dev resources (Next.js 16 blocks cross-origin to /_next by
  // default — protects against malicious sites loading webpack-hmr from
  // dev machines on shared networks). Quick tunnels regenerate their
  // subdomain on each restart, hence the wildcard. Production builds
  // (next start / Vercel) ignore this field — it's strictly dev.
  // Story 5-6 — exercises Bridge OAuth through a public tunnel.
  // Story 6-10 — named Cloudflare tunnel (pekulo-dev) maps a stable
  // pekulo-dev.trafijs.com hostname, so the named-tunnel zone is allowed too.
  allowedDevOrigins: ["*.trycloudflare.com", "*.trafijs.com"],
  turbopack: {
    resolveAlias: {
      "react-native": "react-native-web",
    },
    resolveExtensions: [
      ".web.tsx",
      ".web.ts",
      ".web.js",
      ".web.jsx",
      ".tsx",
      ".ts",
      ".js",
      ".jsx",
      ".json",
    ],
  },
};

export default nextConfig;
