const { getDefaultConfig } = require("expo/metro-config");
const { withTamagui } = require("@tamagui/metro-plugin");

const config = getDefaultConfig(__dirname);

module.exports = withTamagui(config, {
  components: ["tamagui", "@pekulo/ui"],
  config: "./tamagui.config.ts",
});
