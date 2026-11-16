# `@pekulo/mobile` — Pekulo V1.5 Native App (Expo Dev Build)

Expo SDK 58 + `expo-router` + Tamagui v2 (`@pekulo/ui` native entrypoint) on React 19.3.0.

## Prerequisites

- Xcode + iOS Simulator (macOS) and CocoaPods (`pod`)
- Bun (`bun@1.3.13`)
- Optional for E2E smoke: Maestro CLI (`curl -Ls "https://get.maestro.mobile.dev" | bash`)

## Local Dev Build (iOS Simulator)

```bash
# 1. Generate native ios/ project (Expo CNG — gitignored) and build Dev Client
bun --filter='@pekulo/mobile' run ios

# 2. Start Metro with Dev Client + clear cache after babel/metro changes
bun --filter='@pekulo/mobile' run dev -- --clear
```

## Verification

```bash
# Unit & navigation tests (runs in CI via bun --filter='*' run test)
bun --filter='@pekulo/mobile' run test

# Typecheck (uses "react-native" export condition against @pekulo/ui)
bun --filter='@pekulo/mobile' run typecheck

# Lint
bun --filter='@pekulo/mobile' run lint

# Maestro E2E smoke (requires booted iOS Simulator with Dev Build installed)
maestro test .maestro/smoke.yaml
```
