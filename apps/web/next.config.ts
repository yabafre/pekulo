import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "tamagui",
    "@tamagui/core",
    "@tamagui/config",
    "@tamagui/next-theme",
    "react-native-web",
  ],
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
