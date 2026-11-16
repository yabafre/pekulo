# `@pekulo/mobile` — Pekulo V1.5 Native App (Expo Dev Build)

Expo SDK 58 + `expo-router` + Tamagui v2 (`@pekulo/ui` native entrypoint) on React 19.3.0.

## Prerequisites

- Xcode + iOS Simulator (macOS) and CocoaPods (`pod`)
- Bun (`bun@1.3.13`)
- Optional for E2E smoke: Maestro CLI (`curl -Ls "https://get.maestro.mobile.dev" | bash`)

## Launch from Repo Root

```bash
# Build & install Dev Client on a physical iPhone (USB / Xcode signing)
bun run mobile:ios:device

# Build & run Dev Client on iOS Simulator
bun run mobile:ios

# Start Metro for Dev Client (once installed on iPhone or Simulator)
bun run dev:mobile

# Start Metro in Expo Go mode
bun run dev:mobile:go
```

## Verification (from Repo Root)

```bash
# Unit & navigation tests
bun run test:mobile

# Typecheck (uses "react-native" export condition against @pekulo/ui)
bun --filter='@pekulo/mobile' run typecheck

# Lint
bun --filter='@pekulo/mobile' run lint

# Maestro E2E smoke (requires booted iOS Simulator with Dev Build installed)
maestro test .maestro/smoke.yaml
```
