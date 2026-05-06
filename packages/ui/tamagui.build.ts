// packages/ui/tamagui.build.ts — @tamagui/cli build options.
import type { TamaguiBuildOptions } from "@tamagui/core";

export default {
  components: ["tamagui"],
  config: "./tamagui.config.ts",
  outputCSS: "./public/tamagui.generated.css",
} satisfies TamaguiBuildOptions;
