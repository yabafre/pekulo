const babelPresetExpo = require.resolve("babel-preset-expo", {
  paths: [require.resolve("expo/package.json")],
});

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [babelPresetExpo],
    plugins: [
      [
        "transform-inline-environment-variables",
        {
          include: ["TAMAGUI_TARGET", "EXPO_ROUTER_APP_ROOT"],
        },
      ],
      [
        "@tamagui/babel-plugin",
        {
          components: ["tamagui", "@pekulo/ui"],
          config: "./tamagui.config.ts",
          logTimings: true,
          disableExtraction: process.env.NODE_ENV === "development",
        },
      ],
    ],
  };
};
