This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Pre-commit hooks

This monorepo uses [lefthook](https://github.com/evilmartians/lefthook) + [gitleaks](https://github.com/gitleaks/gitleaks) + `oxlint` / `oxfmt` / `prisma format` to keep secrets out of git history and to keep formatting / lint stable across contributors. See `lefthook.yml` at the repo root for the canonical config and `docs/stories/0-11-precommit-secrets.md` for the design rationale.

### One-time setup

1. **Install gitleaks** (system binary — version `>= 8.18`):
   - macOS: `brew install gitleaks`
   - Linux: download the latest release tarball from <https://github.com/gitleaks/gitleaks/releases> and place the `gitleaks` binary on `$PATH`.
   - Verify: `gitleaks --version` prints `8.18.0` or newer.
2. **Run `bun install` from the repo root.** The `prepare` script auto-runs `lefthook install`, which writes `.git/hooks/pre-commit` pointing at lefthook. No manual hook wiring needed.

### What runs on `git commit`

| Hook            | What it does                                                                                               | When it runs                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `gitleaks`      | Scans the staged tree for secret patterns (AWS keys, JWTs, private keys, ...) — fails the commit on match. | Always.                                                          |
| `oxlint --fix`  | Applies oxlint auto-fixes to staged JS/TS files; re-stages the result via `stage_fixed: true`.             | Staged files match `*.{js,jsx,ts,tsx,mjs,cjs}`.                  |
| `oxfmt`         | Applies oxfmt formatting to staged formattable files; re-stages the result.                                | Staged files match `*.{js,jsx,ts,tsx,mjs,cjs,json,md,yml,yaml}`. |
| `prisma format` | Formats `apps/api/prisma/schema/*.prisma` files in place; re-stages them.                                  | A `*.prisma` file under `apps/api/prisma/**/` is staged.         |

### Bypass (emergencies only — DISCOURAGED)

```bash
LEFTHOOK=0 git commit -m "wip: ..."
```

Skips every hook. Use only when the dev machine cannot run gitleaks / lefthook (e.g. you are mid-rebase on a machine without the system binary). NEVER push a commit that bypassed gitleaks without re-running `gitleaks detect --source . --redact` first.
