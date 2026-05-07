// packages/ui/tamagui.config.ts — front-door for @tamagui/cli's config bundler.
// The CLI requires the config file at the package root ; the actual definition
// lives in src/config/tamagui.ts.
export { config as default } from "./src/config/tamagui";
