const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withTamagui } = require("@tamagui/metro-plugin");

const config = withTamagui(getDefaultConfig(__dirname), {
  components: ["tamagui", "@pekulo/ui"],
  config: "./tamagui.config.ts",
});

// Strip the parity catalog and its unused DS components from non-gallery bundles.
const EMPTY_PARITY_STUB = path.resolve(__dirname, "lib/ds-gallery-empty-parity.ts");
const upstreamResolveRequest = config.resolver?.resolveRequest;

config.resolver = {
  ...config.resolver,
  resolveRequest(context, moduleName, platform) {
    if (moduleName === "@pekulo/ui/parity" && process.env.EXPO_PUBLIC_DS_GALLERY?.trim() !== "1") {
      return { type: "sourceFile", filePath: EMPTY_PARITY_STUB };
    }
    if (upstreamResolveRequest) {
      return upstreamResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
