# `@pekulo/mobile` — Pekulo V1.5 Native App (Expo Dev Build)

Expo SDK 58 + `expo-router` + Tamagui v2 (`@pekulo/ui` native entrypoint) on React 19.3.0.

## Prerequisites

- Xcode + iOS Simulator (macOS) and CocoaPods (`pod`)
- Bun (`bun@1.3.14`)
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

# Web ↔ native text-style parity gate (story 10-5)
cd apps/mobile && bunx jest __tests__/ds-token-parity.test.tsx
```

## E2E — Maestro on EAS Workflows (story 10-5)

Flows live in `apps/mobile/.maestro/flows/`: `smoke`, `navigation`, `preview-guard`, and the generated `ds-gallery` (one iOS screenshot golden per `@pekulo/ui` component, rendered by the flag-gated route `app/ds/[case].tsx`). They run against the `e2e-test` profile: an iOS Simulator build in preview mode (no backend), DS gallery on.

```bash
# CI: runs automatically on PRs to main touching apps/mobile or packages/{ui,contracts,validators,types}
# (apps/mobile/.eas/workflows/e2e-ios.yml — non-required check).

# Run the E2E workflow manually
cd apps/mobile && bunx eas-cli@latest workflow:run .eas/workflows/e2e-ios.yml

# Regenerate the ds-gallery flow after adding/removing a parity case
cd apps/mobile && UPDATE_DS_FLOW=1 bunx jest __tests__/maestro-ds-gallery-flow.test.ts

# Refresh the iOS goldens after an INTENTIONAL visual change
cd apps/mobile && bunx eas-cli@latest workflow:run .eas/workflows/e2e-ios-update-goldens.yml
# then download the "Maestro Test Results" artifact from the run page and copy
# its goldens/ios/*.png into apps/mobile/.maestro/goldens/ios/, review, commit.

# Local run (Maestro CLI + a Release simulator build with EXPO_PUBLIC_DS_GALLERY=1)
maestro test apps/mobile/.maestro
```
