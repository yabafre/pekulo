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

## E2E — Maestro on EAS Workflows (stories 10-5 iOS, 10-6 Android)

Flows live in `apps/mobile/.maestro/flows/`: `smoke`, `navigation`, `preview-guard`, and the generated `ds-gallery` (one iOS screenshot golden per `@pekulo/ui` component, rendered by the flag-gated route `app/ds/[case].tsx`). They run against the `e2e-test` profile: an iOS Simulator build in preview mode (no backend), DS gallery on.

```bash
# CI: runs automatically on PRs to main touching apps/mobile or packages/{ui,contracts,validators,types}
# (apps/mobile/.eas/workflows/e2e-ios.yml — non-required check).

# Run the E2E workflow manually
cd apps/mobile && bunx eas-cli@latest workflow:run .eas/workflows/e2e-ios.yml

# Regenerate both ds-gallery flows (iOS + Android) after adding/removing a parity case
cd apps/mobile && UPDATE_DS_FLOW=1 bunx jest --selectProjects ios __tests__/maestro-ds-gallery-flow.test.ts

# Refresh the iOS goldens after an INTENTIONAL visual change (EAS Workflows — custom macos-medium job, Free-plan compatible)
cd apps/mobile && bunx eas-cli@latest workflow:run .eas/workflows/e2e-ios-update-goldens.yml
# then download the "ios-ds-goldens" artifact from the run page and copy
# its *.png files into apps/mobile/.maestro/goldens/ios/, review, commit.

# Local Release Simulator build + Maestro run
cd apps/mobile && EXPO_PUBLIC_DS_GALLERY=1 bunx expo run:ios --configuration Release --no-bundler
maestro test apps/mobile/.maestro

# Local golden regeneration (captures 42 cropped PNGs then copies them into apps/mobile/.maestro/goldens/ios/)
maestro test -e MAESTRO_UPDATE_GOLDENS=true --test-output-dir /tmp/maestro-goldens apps/mobile/.maestro/flows/ds-gallery.yaml
find /tmp/maestro-goldens -path '*/goldens/ios/*.png' -exec cp {} apps/mobile/.maestro/goldens/ios/ \;
```

### Android (story 10-6)

`e2e-android.yml` builds the `e2e-test` profile as an **APK** and runs `smoke`, `navigation`, `preview-guard` and the generated `ds-gallery-android` flow on an Android emulator (`linux-medium-nested-virtualization` worker, `eas/start_android_emulator`, `system-images;android-35;default;x86_64`). Android goldens live in `apps/mobile/.maestro/goldens/android/` and are only valid for that emulator image.

```bash
# Run the Android E2E workflow manually
cd apps/mobile && bunx eas-cli@latest workflow:run .eas/workflows/e2e-android.yml

# Regenerate the Android goldens on the CI emulator image, then download the
# "android-ds-goldens" artifact into apps/mobile/.maestro/goldens/android/, review, commit.
cd apps/mobile && bunx eas-cli@latest workflow:run .eas/workflows/e2e-android-update-goldens.yml

# Local runs: the iOS and Android gallery flows assert different goldens.
maestro test --exclude-tags android-only apps/mobile/.maestro          # iOS Simulator
maestro test --exclude-tags ds-gallery apps/mobile/.maestro            # Android emulator
```

Android-specific surfaces (all covered by the `android` Jest project, `__tests__/android/`): tab header buttons through `headerRight` (`Stack.Toolbar` needs `@expo/ui` on Android), headerless form sheets with an in-content header row, row action menus in the DS `ActionSheetHost`, and account deletion in `sheets/delete-account` (no `Alert.prompt` on Android).
