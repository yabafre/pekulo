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

## E2E — Maestro on GitHub Actions (stories 10-5 iOS, 10-6 Android)

`.github/workflows/e2e-mobile.yml` runs on PRs to `main` touching `apps/mobile`, `packages/{ui,contracts,validators,types,zod}` or `bun.lock` (non-required check, `cancel-in-progress` per branch):

- **Builds once per platform** — iOS Simulator `.app` (`macos-26`, Xcode 26.6, Release, arm64, ccache + CocoaPods cache) and an x86_64 release APK (`ubuntu-24.04`, Gradle cache), in preview mode with the DS gallery on (`EXPO_PUBLIC_DS_GALLERY=1`, `EXPO_PUBLIC_ALLOW_PREVIEW=1`).
- **Core flows on every mobile PR** — `.maestro/flows/{smoke,navigation,preview-guard}.yaml` on an iPhone 17 Pro (iOS 26.5) simulator and an API 35 Pixel 7 emulator (1080×2400 @ 420, cached AVD snapshot), one retry per flow.
- **DS gallery only when it can change** — the 42 screenshot goldens run when the PR touches `packages/ui/**`, `apps/mobile/app/ds/**`, `apps/mobile/lib/ds-gallery*.ts`, `apps/mobile/.maestro/{gallery,goldens}/**` or the E2E workflow itself. They are split into 4 shards per platform (`.maestro/gallery/<platform>/shard-<n>.yaml`, one job each) and every golden case retries itself once (Maestro `retry`), so one flake costs one case, not the whole gallery.

Goldens (`.maestro/goldens/{ios,android}/`) are only valid for the pinned runner image, Xcode, simulator and emulator in the workflow — bump those together with a recapture.

```bash
# Regenerate the gallery shards after adding/removing a parity case
cd apps/mobile && UPDATE_DS_FLOW=1 bunx jest --selectProjects ios __tests__/maestro-ds-gallery-flow.test.ts

# Recapture goldens after an INTENTIONAL visual change: add the `maestro:update-goldens`
# label to the PR and push (or, once merged, run the workflow manually with update_goldens),
# then download the goldens-<platform>-shard-* artifacts into .maestro/goldens/<platform>/.
gh run download <run-id> --pattern 'goldens-ios-shard-*' --dir /tmp/goldens-ios
gh run download <run-id> --pattern 'goldens-android-shard-*' --dir /tmp/goldens-android

# Local runs (core flows only: the gallery lives outside .maestro/flows)
cd apps/mobile && EXPO_PUBLIC_DS_GALLERY=1 bunx expo run:ios --configuration Release --no-bundler
maestro test apps/mobile/.maestro
maestro test apps/mobile/.maestro/gallery/ios/shard-1.yaml   # one gallery shard
```

Android-specific surfaces (all covered by the `android` Jest project, `__tests__/android/`): tab header buttons through `headerRight` (`Stack.Toolbar` needs `@expo/ui` on Android), headerless form sheets with an in-content header row, row action menus in the DS `ActionSheetHost`, and account deletion in `sheets/delete-account` (no `Alert.prompt` on Android).

## Pre-Submission Compliance & Mobile Agent Testers (story 10-7)

- **Store compliance guard:** runs static App Store & Google Play checks against `apps/mobile` (`app.json` export compliance, `privacyManifests`, canonical 1024×1024 RGB no-alpha `assets/icon.png`, Keychain backup exclusion, `expo-haptics`, and `.app-review-readiness.json`).

  ```bash
  # Automated Jest compliance meta-test
  cd apps/mobile && bunx jest __tests__/store-compliance.test.ts

  # Static pre-submission compliance guard
  bash .agents/skills/app-store-compliance/hooks/app-store-compliance-guard.sh apps/mobile
  ```

- **Manual release-readiness kit:** update `apps/mobile/.app-review-readiness.json` and fill demo credentials + device recording URL in `apps/mobile/docs/REVIEW-NOTES.md` before submitting to App Store Connect or Google Play Console.
- **Public legal & deletion URLs (served by `apps/web`):** `/privacy`, `/terms` (including EAA Annex V accessibility notice), `/support`, and `/account-deletion` (canonical base `https://pekulo.app`, overridable via `EXPO_PUBLIC_WEB_BASE_URL`).
- **Mobile Agent Testers kit (`apps/mobile/.agent-testers/`):** ships 8 FR/EN personas (`personas.json`: 4 iOS + 4 Android), a Pekulo-tailored mission brief (`AGENT_BRIEF.md`), and Bun 1.3.14 monorepo GitHub Actions setup instructions (`README.md`). Run `./setup.sh` and `bash scripts/collect.sh <run-id>` exclusively in your local terminal.
