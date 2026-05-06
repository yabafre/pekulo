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
