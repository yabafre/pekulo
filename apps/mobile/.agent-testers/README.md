# Pekulo — Mobile Agent Testers Kit

Ready-to-run configuration for parallel headless AI persona testing of `apps/mobile` on GitHub Actions using [`pierridotite/mobile-agent-testers`](https://github.com/pierridotite/mobile-agent-testers) (vendored skill at `.agents/skills/mobile-agent-testers/`).

## Public Repo, Runner Cost & Privacy Rules

- **`yabafre/pekulo` is a PUBLIC repository.** GitHub-hosted Linux (Android emulator) and macOS (iOS Simulator) runners are **free** on public repositories (GitHub Free plan allows ~20 concurrent Linux jobs and **5 concurrent macOS jobs**), with zero GitHub Actions ToS grey zone because the tests exercise Pekulo itself.
- **Public logs → encryption is mandatory.** Workflow logs in a public repo are world-readable. Upstream's `results_public.pem` encrypts build logs, app binaries, screenshots, and persona reports before upload. Never add a debug step that prints decrypted outputs, `.env` values, or credentials.
- **Claude Pro/Max quota — batch 4–6 personas per run.** Running all 8+ agents simultaneously burns a 5-hour Claude window quickly. Dispatch **4–6 personas per batch** (for example iOS first, then Android).
- **Strict local-terminal security rule:** ALWAYS run `./setup.sh` and `bash scripts/collect.sh <run-id>` directly in your own local terminal — never through an AI coding agent. Never paste tokens or let an agent inspect `~/.mobile-agent-testers/` or your private decryption key.

## One-Time Setup (Run in Your Local Terminal)

```bash
# 1. Create the public testers repo from the upstream template
gh repo create yabafre/pekulo-agent-testers --public --template pierridotite/mobile-agent-testers --clone
cd pekulo-agent-testers

# 2. Run setup locally (creates RSA keypair in ~/.mobile-agent-testers/, pushes results_public.pem, prompts for Claude auth)
./setup.sh

# 3. Copy Pekulo's persona catalog and mission brief into the testers repo
cp ../pekulo/apps/mobile/.agent-testers/personas.json ./personas.json
cp ../pekulo/apps/mobile/.agent-testers/AGENT_BRIEF.md ./AGENT_BRIEF.md
git add personas.json AGENT_BRIEF.md
git commit -m "chore: configure Pekulo personas and mission brief"
git push
```

## Custom Bun 1.3.14 Monorepo Build Commands

Upstream's automatic Expo builder runs `npm ci`, which **fails** on Pekulo's Bun monorepo (`workspace:*` dependencies across `@pekulo/ui`, `@pekulo/contracts`, `@pekulo/validators`, `@pekulo/types`, and Prisma `postinstall` requiring `DATABASE_URL`).

Pass explicit Bun 1.3.14 build commands with `app_dir=.`, `source_repo=yabafre/pekulo`, and `app_id=app.pekulo.mobile`:

### Batch 1 — iOS (4 personas: `clara,sven_fr,jonas_ipad,noah_pro`)

```bash
gh workflow run agent-testers.yml \
  -f source_repo=yabafre/pekulo \
  -f ref=main \
  -f app_dir=. \
  -f app_id=app.pekulo.mobile \
  -f ios_personas=clara,sven_fr,jonas_ipad,noah_pro \
  -f android_personas=none \
  -f ios_build='curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.14" && export PATH="$HOME/.bun/bin:$PATH" && DATABASE_URL="postgresql://stub:stub@localhost:5432/stub" bun install --frozen-lockfile && cd apps/mobile && EXPO_PUBLIC_ALLOW_PREVIEW=1 bunx expo prebuild --platform ios --non-interactive && xcodebuild -workspace ios/Pekulo.xcworkspace -scheme Pekulo -configuration Release -sdk iphonesimulator -derivedDataPath ios/build CODE_SIGNING_ALLOWED=NO' \
  -f ios_app_path='apps/mobile/ios/build/Build/Products/Release-iphonesimulator/Pekulo.app'
```

### Batch 2 — Android (4 personas: `anna_fr,grace_a11y,malik_dark,lucia_tab`)

> Note: Run Android batches after story `10-6-android-parity-and-maestro` lands the Android prebuild and native-surface adaptations on `main`.

```bash
gh workflow run agent-testers.yml \
  -f source_repo=yabafre/pekulo \
  -f ref=main \
  -f app_dir=. \
  -f app_id=app.pekulo.mobile \
  -f ios_personas=none \
  -f android_personas=anna_fr,grace_a11y,malik_dark,lucia_tab \
  -f android_build='curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.14" && export PATH="$HOME/.bun/bin:$PATH" && DATABASE_URL="postgresql://stub:stub@localhost:5432/stub" bun install --frozen-lockfile && cd apps/mobile && EXPO_PUBLIC_ALLOW_PREVIEW=1 bunx expo prebuild --platform android --non-interactive && cd android && ./gradlew assembleRelease' \
  -f apk_path='apps/mobile/android/app/build/outputs/apk/release/app-release.apk'
```

## Collecting & Reviewing Encrypted Results (Local Terminal Only)

```bash
# Inside your local pekulo-agent-testers checkout:
bash scripts/collect.sh <github-run-id>
# Opens runs/<github-run-id>/SUMMARY.md and decrypted per-persona screenshots + findings.json
```

Always inspect the actual screenshots for every reported `blocker` / `major` finding before filing fixes — headless testers can occasionally misread a transient loading frame.

## Personas Included (`personas.json`)

| ID           | Platform | Locale  | Device & Settings                                         | Focus                                                  |
| ------------ | -------- | ------- | --------------------------------------------------------- | ------------------------------------------------------ |
| `clara`      | iOS      | `fr-FR` | iPhone SE (3rd gen), light, large text                    | Visual polish, compact viewport, legal links           |
| `sven_fr`    | iOS      | `fr-FR` | iPhone SE (3rd gen), dark, max Accessibility Dynamic Type | Extreme font scaling, button reachability              |
| `jonas_ipad` | iOS      | `en-GB` | iPad Pro 13-inch (M4), dark, accessibility XL             | Tablet layout (`supportsTablet: true`), charts         |
| `noah_pro`   | iOS      | `en-US` | iPhone 16 Pro Max, light, XXXL text                       | Settings theme/language, AI consent, fast navigation   |
| `anna_fr`    | Android  | `fr-FR` | Nexus 5 (API 30), light, 130% font                        | Compact Android, French labels, Settings & legal links |
| `grace_a11y` | Android  | `en-US` | Pixel 7 (API 34), light, 200% font                        | Maximum Android font scale, accessibility names        |
| `malik_dark` | Android  | `fr-FR` | Pixel 7 (API 34), dark, 100% font                         | Dark contrast, form sheets, Material Symbols           |
| `lucia_tab`  | Android  | `en-IE` | Pixel Tablet (API 34), light, 100% font                   | Android tablet viewport, keyboard insets               |
